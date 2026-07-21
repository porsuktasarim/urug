const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { t } = require('../lang');
const { displayName } = require('../utils/displayName');

const router = express.Router();

/**
 * GET /:familySlug/:personSlug
 *
 * Bu route en son mount edilmeli (app.js'te diğer tüm route'lardan sonra),
 * çünkü /aileler, /kisiler, /admin gibi sabit path'lerle path segment
 * sayısı bakımından çakışabilir. Express, ilk eşleşen route'u kullandığı
 * için sabit route'lar önce mount edilirse buraya hiç düşmezler.
 *
 * Eski bir slug (slugAliases içinde) ile gelinirse 301 ile güncel
 * slug'a yönlendirilir — bkz. proje dokümanı Bölüm 4.4.
 */
router.get('/:familySlug/:personSlug', async (req, res, next) => {
  const { familySlug, personSlug } = req.params;

  const familyGroup = await FamilyGroup.findOne({ slug: familySlug });
  if (!familyGroup) return next(); // 404'e düşsün, genel route'larla karışmasın

  const person = await Person.findOne({
    familyGroupId: familyGroup._id,
    $or: [{ slug: personSlug }, { slugAliases: personSlug }],
  }).populate('familyGroupId');

  if (!person) return next();

  // Eski slug ile gelindiyse güncel adrese kalıcı yönlendirme
  if (person.slug !== personSlug) {
    return res.redirect(301, `/${familyGroup.slug}/${person.slug}`);
  }

  // Üst soy / alt soy / eş — bkz. proje dokümanı Bölüm 4.6.
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

  const unions = await Union.find({
    $or: [{ personAId: person._id }, { personBId: person._id }],
  }).populate([
    { path: 'personAId', populate: { path: 'familyGroupId' } },
    { path: 'personBId', populate: { path: 'familyGroupId' } },
  ]);
  const spouses = unions.map((u) =>
    String(u.personAId._id) === String(person._id) ? u.personBId : u.personAId
  );

  res.render('persons/show', {
    t,
    person,
    displayName,
    father: father ? father.parentId : null,
    mother: mother ? mother.parentId : null,
    spouses,
    children: childLinks.map((l) => l.childId),
  });
});

module.exports = router;
