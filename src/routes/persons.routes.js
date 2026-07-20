const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const AttributeDefinition = require('../models/AttributeDefinition');
const { extractAttributeValues, validateAttributes } = require('../utils/attributeFormHelper');
const { t } = require('../lang');

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

function displayName(person) {
  if (person.officialLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }
  return person.officialFirstName;
}

// Person.attributes bir Map olduğu için EJS'te doğrudan okumak yerine
// düz obje haline getirip forma öyle veriyoruz.
function attributesToPlainObject(person) {
  if (!person || !person.attributes) return {};
  if (person.attributes instanceof Map) return Object.fromEntries(person.attributes);
  return person.attributes; // form validasyon hatası sonrası zaten düz obje olabilir
}

// Liste — Türkçe alfabetik sıralama (ad'a göre)
router.get('/', async (req, res) => {
  const persons = await Person.find()
    .populate('familyGroupId')
    .collation({ locale: 'tr' })
    .sort({ officialFirstName: 1 });

  res.render('persons/index', { persons, t, displayName });
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
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId } = body;

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
  return null;
}

// Yeni kayıt oluşturma
router.post('/', async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId } = req.body;
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
    const person = new Person({
      familyGroupId,
      officialFirstName: officialFirstName.trim(),
      officialLastName: hasNoLastName === 'on' ? null : officialLastName.trim(),
      hasNoLastName: hasNoLastName === 'on',
      attributes: attributeValues,
    });

    await person.save();
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
  const person = await Person.findById(req.params.id);

  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const familyGroups = await getFamilyGroupsSorted();
  const dynamicAttributes = await getDynamicAttributeDefinitions();

  res.render('persons/form', {
    t,
    person,
    familyGroups,
    dynamicAttributes,
    attributeValues: attributesToPlainObject(person),
    errorMessage: null,
  });
});

// Güncelleme
router.post('/:id', async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId } = req.body;
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
    await Person.findByIdAndUpdate(req.params.id, {
      familyGroupId,
      officialFirstName: officialFirstName.trim(),
      officialLastName: hasNoLastName === 'on' ? null : officialLastName.trim(),
      hasNoLastName: hasNoLastName === 'on',
      attributes: attributeValues,
    });

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
  await Person.findByIdAndDelete(req.params.id);
  res.redirect('/kisiler');
});

module.exports = router;
