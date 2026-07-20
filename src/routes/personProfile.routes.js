const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const ParentChild = require('../models/ParentChild');
const { t } = require('../lang');

const router = express.Router();

function displayName(person) {
  if (person.officialLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }
  return person.officialFirstName;
}

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

  // Üst soy / alt soy — bkz. proje dokümanı Bölüm 4.6.
  // Eş bilgisi Union modeli henüz eklenmediği için burada yok (sonraki adım).
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

  res.render('persons/show', {
    t,
    person,
    displayName,
    father: father ? father.parentId : null,
    mother: mother ? mother.parentId : null,
    children: childLinks.map((l) => l.childId),
  });
});

module.exports = router;
