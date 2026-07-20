const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
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

  res.render('persons/show', { t, person, displayName });
});

module.exports = router;
