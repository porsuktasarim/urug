const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const { t } = require('../lang');

const router = express.Router();

async function getFamilyGroupsSorted() {
  return FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
}

function displayName(person) {
  if (person.officialLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }
  return person.officialFirstName;
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

  res.render('persons/form', {
    t,
    person: null,
    familyGroups,
    errorMessage: null,
  });
});

function validate(body) {
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
  const validationError = validate(req.body);

  if (validationError) {
    const familyGroups = await getFamilyGroupsSorted();
    return res.status(400).render('persons/form', {
      t,
      person: req.body,
      familyGroups,
      errorMessage: validationError,
    });
  }

  try {
    const person = new Person({
      familyGroupId,
      officialFirstName: officialFirstName.trim(),
      officialLastName: hasNoLastName === 'on' ? null : officialLastName.trim(),
      hasNoLastName: hasNoLastName === 'on',
    });

    await person.save();
    res.redirect('/kisiler');
  } catch (err) {
    const familyGroups = await getFamilyGroupsSorted();
    res.status(400).render('persons/form', {
      t,
      person: req.body,
      familyGroups,
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
  res.render('persons/form', { t, person, familyGroups, errorMessage: null });
});

// Güncelleme
router.post('/:id', async (req, res) => {
  const { officialFirstName, officialLastName, hasNoLastName, familyGroupId } = req.body;
  const validationError = validate(req.body);

  if (validationError) {
    const familyGroups = await getFamilyGroupsSorted();
    return res.status(400).render('persons/form', {
      t,
      person: { _id: req.params.id, ...req.body },
      familyGroups,
      errorMessage: validationError,
    });
  }

  try {
    await Person.findByIdAndUpdate(req.params.id, {
      familyGroupId,
      officialFirstName: officialFirstName.trim(),
      officialLastName: hasNoLastName === 'on' ? null : officialLastName.trim(),
      hasNoLastName: hasNoLastName === 'on',
    });

    res.redirect('/kisiler');
  } catch (err) {
    const familyGroups = await getFamilyGroupsSorted();
    res.status(400).render('persons/form', {
      t,
      person: { _id: req.params.id, ...req.body },
      familyGroups,
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
