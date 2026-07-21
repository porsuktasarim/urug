const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const AttributeDefinition = require('../models/AttributeDefinition');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { extractAttributeValues, validateAttributes } = require('../utils/attributeFormHelper');
const { computeNameKey, reassignSlugsForNameGroup } = require('../utils/personSlug');
const { getPersonalNicknames, getFamilyLakab } = require('../utils/nicknames');
const { t } = require('../lang');
const { displayName } = require('../utils/displayName');

const router = express.Router();

async function getFamilyGroupsSorted() {
  return FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
}

// Kişi formunda gösterilecek dinamik alanlar: aktif + isSystem=false
// (ad/soyad zaten Person modelinde sabit alan olarak ayrı render ediliyor).
// "photo" tipi bu adımda henüz desteklenmiyor (görsel yükleme sonraki adımda).
async function getDynamicAttributeDefinitions() {
  return AttributeDefinition.find({ isActive: true, isSystem: false, type: { $ne: 'photo' } })
    .collation({ locale: 'tr' })
    .sort({ group: 1, order: 1 });
}

// Person.attributes bir Map olduğu için EJS'te doğrudan okumak yerine
// düz obje haline getirip forma öyle veriyoruz.
function attributesToPlainObject(person) {
  if (!person || !person.attributes) return {};
  if (person.attributes instanceof Map) return Object.fromEntries(person.attributes);
  return person.attributes; // form validasyon hatası sonrası zaten düz obje olabilir
}

// Form verisinden Person.nicknames dizisini üretir.
// personalNicknames: virgülle ayrılmış serbest metin -> birden fazla "personal" kaydı
// familyLakab: tek metin -> tek "familyLakab" kaydı, opsiyonel inheritedFrom ile
function buildNicknames(body) {
  const nicknames = [];
  const { personalNicknames, familyLakab, familyLakabInheritedFrom } = body;

  if (personalNicknames && personalNicknames.trim()) {
    personalNicknames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((value) => {
        nicknames.push({ type: 'personal', value, inheritedFrom: null, note: null });
      });
  }

  if (familyLakab && familyLakab.trim()) {
    nicknames.push({
      type: 'familyLakab',
      value: familyLakab.trim(),
      inheritedFrom: familyLakabInheritedFrom && familyLakabInheritedFrom.trim() ? familyLakabInheritedFrom.trim() : null,
      note: null,
    });
  }

  return nicknames;
}

// Liste — Türkçe alfabetik sıralama (ad'a göre)
router.get('/', async (req, res) => {
  const persons = await Person.find()
    .populate('familyGroupId')
    .collation({ locale: 'tr' })
    .sort({ officialFirstName: 1 });

  res.render('persons/index', { persons, t, displayName });
});

// Arama sayfası — genel amaçlı arama-ve-seç bileşeni.
// Bu adımda bağımsız bir sayfa; sonraki adımda ebeveyn/eş ekleme
// akışlarına (modal/inline) bağlanacak.
router.get('/ara', (req, res) => {
  res.render('persons/search', { t });
});

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// JSON arama API'si — ad-soyad + doğum yılı ile arar.
// MongoDB'nin varsayılan case-insensitive regex'i Türkçe karakterleri
// (ı/İ/ş/ğ/ç/ö/ü) doğru işlemediği için, sorgu metni de nameKey gibi
// toLocaleLowerCase('tr-TR') ile normalize edilip 'i' bayrağı OLMADAN
// karşılaştırılıyor (bkz. proje notları / MİS deneyimi).
router.get('/api/ara', async (req, res) => {
  const { q, excludeId } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ results: [] });
  }

  const normalizedQuery = q.trim().toLocaleLowerCase('tr-TR');
  const regex = new RegExp(escapeRegExp(normalizedQuery)); // 'i' bayrağı yok — bilinçli

  const filter = { nameKey: regex };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const persons = await Person.find(filter)
    .populate('familyGroupId')
    .limit(10);

  const results = persons.map((p) => ({
    id: p._id,
    displayName: displayName(p),
    birthYear: p.birthYear || null,
    familyGroupName: p.familyGroupId ? p.familyGroupId.name : null,
    familyGroupSlug: p.familyGroupId ? p.familyGroupId.slug : null,
    slug: p.slug || null,
  }));

  res.json({ results });
});

// Yeni ekleme formu
router.get('/new', async (req, res) => {
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();

  res.render('persons/form', {
    t,
    person: null,
    familyGroups,
    dynamicAttributes,
    attributeValues: {},
    errorMessage: null,
  });
});

function validateBase(body) {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId, birthYear } = body;

  if (!officialFirstName || !officialFirstName.trim()) {
    return 'Ad zorunludur.';
  }
  if (!familyGroupId) {
    return 'Aile seçimi zorunludur.';
  }
  // Koşullu zorunluluk: hasNoLastName işaretli değilse soyadı zorunlu
  if (hasNoLastName !== 'on' && (!officialLastName || !officialLastName.trim())) {
    return 'Soyadı zorunludur (ya da "Soyadı yok" seçeneğini işaretleyin).';
  }
  if (birthYear && Number.isNaN(Number(birthYear))) {
    return 'Doğum yılı sayı olmalıdır.';
  }
  return null;
}

// Yeni kayıt oluşturma
router.post('/', async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId, birthYear, gender, marriedLastName, useCombinedLastName } = req.body;
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();

  const baseError = validateBase(req.body);
  const attributeValues = extractAttributeValues(dynamicAttributes, req.body);
  const attributeError = validateAttributes(dynamicAttributes, attributeValues, {
    hasNoLastName: hasNoLastName === 'on',
  });
  const errorMessage = baseError || attributeError;

  if (errorMessage) {
    return res.status(400).render('persons/form', {
      t,
      person: req.body,
      familyGroups,
      dynamicAttributes,
      attributeValues,
      errorMessage,
    });
  }

  try {
    const finalFirstName = officialFirstName.trim();
    const finalLastName = hasNoLastName === 'on' ? null : officialLastName.trim();

    const person = new Person({
      familyGroupId,
      officialFirstName: finalFirstName,
      officialLastName: finalLastName,
      hasNoLastName: hasNoLastName === 'on',
      birthYear: birthYear ? Number(birthYear) : null,
      gender: gender || null,
      marriedLastName: marriedLastName && marriedLastName.trim() ? marriedLastName.trim() : null,
      useCombinedLastName: useCombinedLastName === 'on',
      nicknames: buildNicknames(req.body),
      nameKey: computeNameKey(finalFirstName, finalLastName),
      attributes: attributeValues,
    });

    await person.save();
    await reassignSlugsForNameGroup(Person, person.nameKey);

    res.redirect('/kisiler');
  } catch (err) {
    res.status(400).render('persons/form', {
      t,
      person: req.body,
      familyGroups,
      dynamicAttributes,
      attributeValues,
      errorMessage: err.message,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', async (req, res) => {
  const person = await Person.findById(req.params.id).populate('familyGroupId');

  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();

  // Mevcut akrabalık bağları (üst soy/alt soy) — form altında gösteriliyor.
  const parentLinks = await ParentChild.find({ childId: person._id }).populate({
    path: 'parentId',
    populate: { path: 'familyGroupId' },
  });
  const childLinks = await ParentChild.find({ parentId: person._id }).populate({
    path: 'childId',
    populate: { path: 'familyGroupId' },
  });

  const father = parentLinks.find((l) => l.parentSide === 'father');
  const mother = parentLinks.find((l) => l.parentSide === 'mother');

  // Eş(ler) — çoklu evlilik desteklenir, birden fazla Union kaydı olabilir.
  const unions = await Union.find({
    $or: [{ personAId: person._id }, { personBId: person._id }],
  }).populate([
    { path: 'personAId', populate: { path: 'familyGroupId' } },
    { path: 'personBId', populate: { path: 'familyGroupId' } },
  ]);
  const spouses = unions.map((u) =>
    String(u.personAId._id) === String(person._id) ? u.personBId : u.personAId
  );

  // Lakap bilgileri — form önceden doldurulsun diye.
  const personalNicknamesValue = getPersonalNicknames(person).join(', ');
  const familyLakabEntry = getFamilyLakab(person);
  let familyLakabInheritedFromPerson = null;
  if (familyLakabEntry && familyLakabEntry.inheritedFrom) {
    familyLakabInheritedFromPerson = await Person.findById(familyLakabEntry.inheritedFrom);
  }

  res.render('persons/form', {
    t,
    person,
    familyGroups,
    dynamicAttributes,
    attributeValues: attributesToPlainObject(person),
    father: father ? father.parentId : null,
    mother: mother ? mother.parentId : null,
    spouses,
    children: childLinks.map((l) => l.childId),
    displayName,
    personalNicknamesValue,
    familyLakabValue: familyLakabEntry ? familyLakabEntry.value : '',
    familyLakabInheritedFromId: familyLakabEntry ? familyLakabEntry.inheritedFrom : null,
    familyLakabInheritedFromName: familyLakabInheritedFromPerson ? displayName(familyLakabInheritedFromPerson) : '',
    errorMessage: null,
  });
});

// Güncelleme
router.post('/:id', async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId, birthYear, gender, marriedLastName, useCombinedLastName } = req.body;
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();

  const baseError = validateBase(req.body);
  const attributeValues = extractAttributeValues(dynamicAttributes, req.body);
  const attributeError = validateAttributes(dynamicAttributes, attributeValues, {
    hasNoLastName: hasNoLastName === 'on',
  });
  const errorMessage = baseError || attributeError;

  if (errorMessage) {
    return res.status(400).render('persons/form', {
      t,
      person: { _id: req.params.id, ...req.body },
      familyGroups,
      dynamicAttributes,
      attributeValues,
      errorMessage,
    });
  }

  try {
    const existing = await Person.findById(req.params.id);
    if (!existing) {
      return res.status(404).send('Kişi bulunamadı.');
    }

    const oldNameKey = existing.nameKey;
    const finalFirstName = officialFirstName.trim();
    const finalLastName = hasNoLastName === 'on' ? null : officialLastName.trim();
    const newNameKey = computeNameKey(finalFirstName, finalLastName);

    existing.familyGroupId = familyGroupId;
    existing.officialFirstName = finalFirstName;
    existing.officialLastName = finalLastName;
    existing.hasNoLastName = hasNoLastName === 'on';
    existing.birthYear = birthYear ? Number(birthYear) : null;
    existing.gender = gender || null;
    existing.marriedLastName = marriedLastName && marriedLastName.trim() ? marriedLastName.trim() : null;
    existing.useCombinedLastName = useCombinedLastName === 'on';
    existing.nicknames = buildNicknames(req.body);
    existing.nameKey = newNameKey;
    existing.attributes = attributeValues;

    await existing.save();

    // İsim değiştiyse hem eski hem yeni grup yeniden hesaplanmalı
    // (eski gruptan biri eksildi, yeni gruba biri katıldı).
    if (oldNameKey && oldNameKey !== newNameKey) {
      await reassignSlugsForNameGroup(Person, oldNameKey);
    }
    await reassignSlugsForNameGroup(Person, newNameKey);

    res.redirect('/kisiler');
  } catch (err) {
    res.status(400).render('persons/form', {
      t,
      person: { _id: req.params.id, ...req.body },
      familyGroups,
      dynamicAttributes,
      attributeValues,
      errorMessage: err.message,
    });
  }
});

// Silme
router.post('/:id/sil', async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    return res.redirect('/kisiler');
  }

  const { nameKey } = person;
  await Person.findByIdAndDelete(req.params.id);

  // Grup küçüldü, kalan kişilerin slug'ı (özellikle plain slug) yeniden hesaplanmalı
  await reassignSlugsForNameGroup(Person, nameKey);

  res.redirect('/kisiler');
});

module.exports = router;
