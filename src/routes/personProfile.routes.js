const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { t } = require('../lang');
const { formatHistoricalYear } = require('../utils/historicalDateDisplay');
const { displayName, displayNameHtml } = require('../utils/displayName');
const { getPersonalNicknames, getFamilyLakab } = require('../utils/nicknames');
const { personProfileUrl } = require('../utils/personLink');
const { sortByBirthYear, childRelationLabel, getSiblings } = require('../utils/familyRelations');

const router = express.Router();

/**
 * Bir kişi bulunduktan sonra profil sayfasını render eden ortak mantık.
 * Hem /:familySlug/:personSlug (aileli) hem /kisi/:personSlug (ailesiz)
 * route'ları tarafından kullanılır.
 */
async function renderProfile(res, person) {
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

  const unions = await Union.find({
    $or: [{ personAId: person._id }, { personBId: person._id }],
  }).populate([
    { path: 'personAId', populate: { path: 'familyGroupId' } },
    { path: 'personBId', populate: { path: 'familyGroupId' } },
  ]);
  const spouses = unions.map((u) =>
    String(u.personAId._id) === String(person._id) ? u.personBId : u.personAId
  );

  const siblings = await getSiblings(
    ParentChild,
    person._id,
    fatherPerson ? fatherPerson._id : null,
    motherPerson ? motherPerson._id : null
  );

  res.render('persons/show', {
    t,
    person,
    displayName,
    displayNameHtml,
    formatHistoricalYear,
    personProfileUrl,
    childRelationLabel,
    father: fatherPerson,
    mother: motherPerson,
    spouses,
    children: sortByBirthYear(childLinks.map((l) => l.childId)),
    siblings: sortByBirthYear(siblings),
    personalNicknames: getPersonalNicknames(person),
    familyLakab: getFamilyLakab(person),
  });
}

/**
 * GET /kisi/:personSlug — aile bağlantısı OLMAYAN kişiler için
 * (bkz. Person.familyGroupId artık opsiyonel). Bu route, aşağıdaki
 * /:familySlug/:personSlug route'undan ÖNCE tanımlanmalı; "kisi" adında
 * bir aile slug'ı hiç olmayacağı için pratikte çakışma riski yok ama
 * yine de netlik için önce tanımlanıyor.
 */
router.get('/kisi/:personSlug', async (req, res, next) => {
  const { personSlug } = req.params;

  const person = await Person.findOne({
    familyGroupId: null,
    $or: [{ slug: personSlug }, { slugAliases: personSlug }],
  }).populate('familyGroupId');

  if (!person) return next();

  if (person.slug !== personSlug) {
    return res.redirect(301, `/kisi/${person.slug}`);
  }

  await renderProfile(res, person);
});

/**
 * GET /:familySlug/:personSlug — aile bağlantısı olan kişiler için.
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

  if (person.slug !== personSlug) {
    return res.redirect(301, `/${familyGroup.slug}/${person.slug}`);
  }

  await renderProfile(res, person);
});

module.exports = router;
