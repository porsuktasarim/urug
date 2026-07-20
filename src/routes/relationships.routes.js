const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const ParentChild = require('../models/ParentChild');
const { computeNameKey, reassignSlugsForNameGroup } = require('../utils/personSlug');
const { t } = require('../lang');

const router = express.Router();

function displayName(person) {
  if (person.officialLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }
  return person.officialFirstName;
}

const RELATION_LABELS = {
  father: 'Baba',
  mother: 'Anne',
  child: 'Çocuk',
};

// İlişki ekleme sayfası — arama-ve-seç + "sistemde yok, yeni ekle" seçeneği
router.get('/:id/iliski-ekle', async (req, res) => {
  const { type } = req.query; // father | mother | child

  if (!RELATION_LABELS[type]) {
    return res.status(400).send('Geçersiz ilişki tipi.');
  }

  const anchorPerson = await Person.findById(req.params.id).populate('familyGroupId');
  if (!anchorPerson) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

  res.render('persons/relationship-add', {
    t,
    anchorPerson,
    displayName,
    type,
    relationLabel: RELATION_LABELS[type],
    familyGroups,
    errorMessage: null,
  });
});

// Var olan bir kişiyi seçip bağlama
router.post('/:id/iliski-baglantisi', async (req, res) => {
  const { type, selectedPersonId, parentSide } = req.body;
  const anchorId = req.params.id;

  try {
    await linkRelationship(type, anchorId, selectedPersonId, parentSide);
    res.redirect(`/kisiler/${anchorId}/duzenle`);
  } catch (err) {
    const anchorPerson = await Person.findById(anchorId).populate('familyGroupId');
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

    res.status(400).render('persons/relationship-add', {
      t,
      anchorPerson,
      displayName,
      type,
      relationLabel: RELATION_LABELS[type],
      familyGroups,
      errorMessage: err.message,
    });
  }
});

// Sistemde olmayan yeni bir kişi oluşturup aynı anda bağlama
router.post('/:id/iliski-yeni-kisi', async (req, res) => {
  const { type, officialFirstName, officialLastName, hasNoLastName, birthYear, familyGroupId, parentSide } = req.body;
  const anchorId = req.params.id;

  async function rerenderWithError(message) {
    const anchorPerson = await Person.findById(anchorId).populate('familyGroupId');
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

    return res.status(400).render('persons/relationship-add', {
      t,
      anchorPerson,
      displayName,
      type,
      relationLabel: RELATION_LABELS[type],
      familyGroups,
      errorMessage: message,
    });
  }

  if (!officialFirstName || !officialFirstName.trim()) {
    return rerenderWithError('Ad zorunludur.');
  }
  if (!familyGroupId) {
    return rerenderWithError('Aile seçimi zorunludur.');
  }
  if (hasNoLastName !== 'on' && (!officialLastName || !officialLastName.trim())) {
    return rerenderWithError('Soyadı zorunludur (ya da "Soyadı yok" seçeneğini işaretleyin).');
  }

  try {
    const finalFirstName = officialFirstName.trim();
    const finalLastName = hasNoLastName === 'on' ? null : officialLastName.trim();

    const newPerson = new Person({
      familyGroupId,
      officialFirstName: finalFirstName,
      officialLastName: finalLastName,
      hasNoLastName: hasNoLastName === 'on',
      birthYear: birthYear ? Number(birthYear) : null,
      nameKey: computeNameKey(finalFirstName, finalLastName),
    });

    await newPerson.save();
    await reassignSlugsForNameGroup(Person, newPerson.nameKey);

    await linkRelationship(type, anchorId, newPerson._id, parentSide);

    res.redirect(`/kisiler/${anchorId}/duzenle`);
  } catch (err) {
    return rerenderWithError(err.message);
  }
});

/**
 * type'a göre childId/parentId/parentSide'ı doğru sıraya koyup
 * ParentChild kaydı oluşturur. "child" tipinde anchor = ebeveyn,
 * selectedPerson = çocuk (parentSide formdan gelir: hangi taraftan
 * bağlandığı, "father" ya da "mother"); "father"/"mother" tipinde
 * anchor = çocuk, selectedPerson = ebeveyn (parentSide = type).
 */
async function linkRelationship(type, anchorId, otherPersonId, chosenParentSide) {
  if (String(anchorId) === String(otherPersonId)) {
    throw new Error('Bir kişi kendisiyle ilişkilendirilemez.');
  }

  let childId;
  let parentId;
  let parentSide;

  if (type === 'father' || type === 'mother') {
    childId = anchorId;
    parentId = otherPersonId;
    parentSide = type;
  } else if (type === 'child') {
    if (chosenParentSide !== 'father' && chosenParentSide !== 'mother') {
      throw new Error('Çocuk eklerken anchor kişinin baba mı anne mi olduğunu seçmelisin.');
    }
    childId = otherPersonId;
    parentId = anchorId;
    parentSide = chosenParentSide;
  } else {
    throw new Error('Geçersiz ilişki tipi.');
  }

  const existing = await ParentChild.findOne({ childId, parentSide });
  if (existing) {
    throw new Error(`Bu kişinin zaten kayıtlı bir ${parentSide === 'father' ? 'babası' : 'annesi'} var.`);
  }

  const duplicate = await ParentChild.findOne({ childId, parentId });
  if (duplicate) {
    throw new Error('Bu ilişki zaten kayıtlı.');
  }

  await ParentChild.create({ childId, parentId, parentSide });
}

module.exports = router;
