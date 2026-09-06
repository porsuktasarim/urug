const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const AttributeDefinition = require('../models/AttributeDefinition');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { extractAttributeValues, validateAttributes } = require('../utils/attributeFormHelper');
const { computeEffectiveSurname, computeNameKey, reassignSlugsForNameGroup } = require('../utils/personSlug');
const { computeSearchKey } = require('../utils/personSearch');
const { parseDateFields } = require('../utils/dateFieldParser');
const { getPersonalNicknames, getFamilyLakab } = require('../utils/nicknames');
const { formatHistoricalYear } = require('../utils/historicalDateDisplay');
const { sortByBirthYear, childRelationLabel, getSiblings } = require('../utils/familyRelations');
const { personProfileUrl } = require('../utils/personLink');
const { encryptTc, hashTc } = require('../utils/tcCrypto');
const { t } = require('../lang');
const { displayName, displayNameHtml } = require('../utils/displayName');
const { requireLogin } = require('../middleware/auth');
const { requirePersonEditAccess, requirePersonDeleteAccess, requireStandaloneCreateAccess } = require('../middleware/personAuthorization');

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

// Kişi formundaki TÜM alanları (çekirdek/sistem alanları + admin'in
// eklediği dinamik özellikler) TEK bir sıralı liste olarak döner.
// Sıralama tamamen "order" alanına göre yapılır (grup sadece başlık
// gösterimi için kullanılır) — admin panelinden hem sistem alanlarının
// hem özel alanların sırası tek bir yerden yönetilebilsin diye.
async function getOrderedFormFields() {
  return AttributeDefinition.find({
    $or: [
      { isSystem: true },
      { isSystem: false, isActive: true, type: { $ne: 'photo' } },
    ],
  }).sort({ order: 1 });
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

// Form verisinden gelen TC'yi şifreleyip Person'a uygular.
// Boş bırakılırsa mevcut tcEncrypted/tcHash DOKUNULMADAN kalır (değiştirilmez).
// NOT: Henüz gerçek bir kullanıcı/rol sistemi yok — bu yüzden "sadece admin
// düzenleyebilsin" kuralı burada zorlanmıyor, sadece arayüzde TC değeri
// asla düz metin olarak client'a geri gönderilmiyor (bkz. form.ejs).
async function applyTcUpdate(person, rawTc, PersonModel) {
  if (!rawTc || !rawTc.trim()) return; // dokunma

  const trimmed = rawTc.trim();
  const hash = hashTc(trimmed);

  const clash = await PersonModel.findOne({ tcHash: hash, _id: { $ne: person._id } });
  if (clash) {
    throw new Error('Bu TC kimlik no zaten başka bir kişide kayıtlı.');
  }

  person.tcEncrypted = encryptTc(trimmed);
  person.tcHash = hash;
}

// Liste — Türkçe alfabetik sıralama (ad'a göre)
router.get('/', async (req, res) => {
  const persons = await Person.find()
    .populate('familyGroupId')
    .collation({ locale: 'tr' })
    .sort({ officialFirstName: 1 });

  const personIds = persons.map((p) => p._id);

  // N+1 sorgudan kaçınmak için eş ve çocuk ilişkilerini TOPLU çekip
  // kişi başına lookup map'i olarak hazırlıyoruz.
  const unions = await Union.find({
    $or: [{ personAId: { $in: personIds } }, { personBId: { $in: personIds } }],
  }).populate([
    { path: 'personAId', populate: { path: 'familyGroupId' } },
    { path: 'personBId', populate: { path: 'familyGroupId' } },
  ]);

  const spousesByPersonId = new Map();
  unions.forEach((u) => {
    const aId = String(u.personAId._id);
    const bId = String(u.personBId._id);
    if (!spousesByPersonId.has(aId)) spousesByPersonId.set(aId, []);
    if (!spousesByPersonId.has(bId)) spousesByPersonId.set(bId, []);
    spousesByPersonId.get(aId).push(u.personBId);
    spousesByPersonId.get(bId).push(u.personAId);
  });

  const parentChildLinks = await ParentChild.find({ parentId: { $in: personIds } }).populate('childId');
  const childrenByParentId = new Map();
  parentChildLinks.forEach((link) => {
    const pid = String(link.parentId);
    if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
    childrenByParentId.get(pid).push(link.childId);
  });

  const personsWithExtras = persons.map((p) => {
    const spouses = spousesByPersonId.get(String(p._id)) || [];
    const children = sortByBirthYear(childrenByParentId.get(String(p._id)) || []);
    return {
      person: p,
      spouses,
      eldestChild: children.length > 0 ? children[0] : null,
      personalNicknames: getPersonalNicknames(p),
      familyLakab: getFamilyLakab(p),
    };
  });

  res.render('persons/index', {
    persons: personsWithExtras,
    t,
    displayName,
    displayNameHtml,
    personProfileUrl,
    formatHistoricalYear,
  });
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

  const filter = { searchKey: regex };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const persons = await Person.find(filter)
    .populate('familyGroupId')
    .limit(10);

  // Aynı ad-soyad'lı ama kan bağı olmayan kişileri ayırt etmek için
  // (ör. iki farklı ailenin ebeveynleri aynı isimde ama akraba değil),
  // her sonucun en büyük çocuğu da gösteriliyor.
  const results = await Promise.all(
    persons.map(async (p) => {
      const childLinks = await ParentChild.find({ parentId: p._id }).populate('childId');
      const children = sortByBirthYear(childLinks.map((l) => l.childId));
      const eldestChild = children.length > 0 ? children[0] : null;

      return {
        id: p._id,
        displayName: displayName(p),
        birthYear: p.birthYear || null,
        familyGroupName: p.familyGroupId ? p.familyGroupId.name : null,
        familyGroupSlug: p.familyGroupId ? p.familyGroupId.slug : null,
        slug: p.slug || null,
        eldestChildName: eldestChild ? displayName(eldestChild) : null,
      };
    })
  );

  res.json({ results });
});

// Yeni ekleme formu
router.get('/new', requireLogin, requireStandaloneCreateAccess, async (req, res) => {
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();
  const formFields = await getOrderedFormFields();

  res.render('persons/form', {
    t,
    person: null,
    familyGroups,
    dynamicAttributes,
    formFields,
    attributeValues: {},
    errorMessage: null,
  });
});

function validateBase(body) {
  const { officialFirstName, officialLastName, hasNoLastName } = body;

  if (!officialFirstName || !officialFirstName.trim()) {
    return 'Ad zorunludur.';
  }
  // Aile seçimi artık opsiyonel — dışarıdan (evlilik yoluyla) gelen ve
  // doğum ailesi sistemde kayıtlı olmayan kişiler için familyGroupId boş bırakılabilir.
  // Koşullu zorunluluk: hasNoLastName işaretli değilse soyadı zorunlu
  if (hasNoLastName !== 'on' && (!officialLastName || !officialLastName.trim())) {
    return 'Soyadı zorunludur (ya da "Soyadı yok" seçeneğini işaretleyin).';
  }

  const birthDate = parseDateFields('birth', body);
  if (birthDate.error) return `Doğum tarihi: ${birthDate.error}`;

  const deathDate = parseDateFields('death', body);
  if (deathDate.error) return `Ölüm tarihi: ${deathDate.error}`;

  return null;
}

// Yeni kayıt oluşturma
router.post('/', requireLogin, requireStandaloneCreateAccess, async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId, middleName, gender, marriedLastName, useCombinedLastName, birthPlace, burialPlace } = req.body;
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();
  const formFields = await getOrderedFormFields();

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
      formFields,
      attributeValues,
      errorMessage,
    });
  }

  try {
    const finalFirstName = officialFirstName.trim();
    const finalLastName = hasNoLastName === 'on' ? null : officialLastName.trim();
    const finalMarriedLastName = marriedLastName && marriedLastName.trim() ? marriedLastName.trim() : null;
    const finalFamilyGroupId = familyGroupId || null;
    const finalNicknames = buildNicknames(req.body);
    const birthDate = parseDateFields('birth', req.body);
    const deathDate = parseDateFields('death', req.body);

    const effectiveSurname = await computeEffectiveSurname(
      {
        officialLastName: finalLastName,
        hasNoLastName: hasNoLastName === 'on',
        marriedLastName: finalMarriedLastName,
        familyGroupId: finalFamilyGroupId,
      },
      FamilyGroup
    );

    const person = new Person({
      familyGroupId: finalFamilyGroupId,
      officialFirstName: finalFirstName,
      middleName: middleName && middleName.trim() ? middleName.trim() : null,
      officialLastName: finalLastName,
      hasNoLastName: hasNoLastName === 'on',
      birthYear: birthDate.year,
      birthDay: birthDate.day,
      birthMonth: birthDate.month,
      birthCalendarType: birthDate.calendarType,
      birthOriginalYear: birthDate.originalYear,
      birthPlace: birthPlace && birthPlace.trim() ? birthPlace.trim() : null,
      deathYear: deathDate.year,
      deathDay: deathDate.day,
      deathMonth: deathDate.month,
      deathCalendarType: deathDate.calendarType,
      deathOriginalYear: deathDate.originalYear,
      burialPlace: burialPlace && burialPlace.trim() ? burialPlace.trim() : null,
      gender: gender || null,
      marriedLastName: finalMarriedLastName,
      useCombinedLastName: useCombinedLastName === 'on',
      nicknames: finalNicknames,
      nameKey: computeNameKey(finalFirstName, effectiveSurname),
      searchKey: computeSearchKey({
        officialFirstName: finalFirstName,
        middleName: middleName && middleName.trim() ? middleName.trim() : null,
        officialLastName: finalLastName,
        hasNoLastName: hasNoLastName === 'on',
        marriedLastName: finalMarriedLastName,
        nicknames: finalNicknames,
      }),
      attributes: attributeValues,
    });

    await applyTcUpdate(person, req.body.tcNumber, Person);
    await person.save();
    await reassignSlugsForNameGroup(Person, person.nameKey);

    res.redirect('/kisiler');
  } catch (err) {
    res.status(400).render('persons/form', {
      t,
      person: req.body,
      familyGroups,
      dynamicAttributes,
      formFields,
      attributeValues,
      errorMessage: err.message,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', requireLogin, requirePersonEditAccess('id'), async (req, res) => {
  const person = await Person.findById(req.params.id).populate('familyGroupId');

  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();
  const formFields = await getOrderedFormFields();

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
  const fatherPerson = father ? father.parentId : null;
  const motherPerson = mother ? mother.parentId : null;

  const siblings = await getSiblings(
    ParentChild,
    person._id,
    fatherPerson ? fatherPerson._id : null,
    motherPerson ? motherPerson._id : null
  );

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
    formFields,
    attributeValues: attributesToPlainObject(person),
    father: fatherPerson,
    mother: motherPerson,
    spouses,
    children: sortByBirthYear(childLinks.map((l) => l.childId)),
    siblings: sortByBirthYear(siblings),
    childRelationLabel,
    displayName,
    personalNicknamesValue,
    familyLakabValue: familyLakabEntry ? familyLakabEntry.value : '',
    familyLakabInheritedFromId: familyLakabEntry ? familyLakabEntry.inheritedFrom : null,
    familyLakabInheritedFromName: familyLakabInheritedFromPerson ? displayName(familyLakabInheritedFromPerson) : '',
    errorMessage: null,
  });
});

// Güncelleme
router.post('/:id', requireLogin, requirePersonEditAccess('id'), async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId, middleName, gender, marriedLastName, useCombinedLastName, birthPlace, burialPlace } = req.body;
  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();
  const formFields = await getOrderedFormFields();

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
      formFields,
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
    const finalMarriedLastName = marriedLastName && marriedLastName.trim() ? marriedLastName.trim() : null;
    const finalFamilyGroupId = familyGroupId || null;
    const finalNicknames = buildNicknames(req.body);
    const birthDate = parseDateFields('birth', req.body);
    const deathDate = parseDateFields('death', req.body);

    const effectiveSurname = await computeEffectiveSurname(
      {
        officialLastName: finalLastName,
        hasNoLastName: hasNoLastName === 'on',
        marriedLastName: finalMarriedLastName,
        familyGroupId: finalFamilyGroupId,
      },
      FamilyGroup
    );
    const newNameKey = computeNameKey(finalFirstName, effectiveSurname);

    existing.familyGroupId = finalFamilyGroupId;
    existing.officialFirstName = finalFirstName;
    existing.middleName = middleName && middleName.trim() ? middleName.trim() : null;
    existing.officialLastName = finalLastName;
    existing.hasNoLastName = hasNoLastName === 'on';
    existing.birthYear = birthDate.year;
    existing.birthDay = birthDate.day;
    existing.birthMonth = birthDate.month;
    existing.birthCalendarType = birthDate.calendarType;
    existing.birthOriginalYear = birthDate.originalYear;
    existing.birthPlace = birthPlace && birthPlace.trim() ? birthPlace.trim() : null;
    existing.deathYear = deathDate.year;
    existing.deathDay = deathDate.day;
    existing.deathMonth = deathDate.month;
    existing.deathCalendarType = deathDate.calendarType;
    existing.deathOriginalYear = deathDate.originalYear;
    existing.burialPlace = burialPlace && burialPlace.trim() ? burialPlace.trim() : null;
    existing.gender = gender || null;
    existing.marriedLastName = finalMarriedLastName;
    existing.useCombinedLastName = useCombinedLastName === 'on';
    existing.nicknames = finalNicknames;
    existing.nameKey = newNameKey;
    existing.searchKey = computeSearchKey({
      officialFirstName: finalFirstName,
      middleName: middleName && middleName.trim() ? middleName.trim() : null,
      officialLastName: finalLastName,
      hasNoLastName: hasNoLastName === 'on',
      marriedLastName: finalMarriedLastName,
      nicknames: finalNicknames,
    });
    existing.attributes = attributeValues;

    await applyTcUpdate(existing, req.body.tcNumber, Person);
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
      formFields,
      attributeValues,
      errorMessage: err.message,
    });
  }
});

// Silme
router.post('/:id/sil', requireLogin, requirePersonDeleteAccess('id'), async (req, res) => {
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
