const express = require('express');
const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { computeEffectiveSurname, computeNameKey, reassignSlugsForNameGroup } = require('../utils/personSlug');
const { computeSearchKey } = require('../utils/personSearch');
const { t } = require('../lang');
const { displayName } = require('../utils/displayName');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Bu router'daki TÜM route'lar giriş gerektirir — akrabalık bağı kurma tamamen bir düzenleme işlemi.
router.use(requireLogin);

const RELATION_LABELS = {
  father: 'Baba',
  mother: 'Anne',
  child: 'Çocuk',
  spouse: 'Eş',
};

async function getSpousesOf(personId) {
  const unions = await Union.find({
    $or: [{ personAId: personId }, { personBId: personId }],
  }).populate([
    { path: 'personAId', populate: { path: 'familyGroupId' } },
    { path: 'personBId', populate: { path: 'familyGroupId' } },
  ]);

  return unions.map((u) =>
    String(u.personAId._id) === String(personId) ? u.personBId : u.personAId
  );
}

// İlişki ekleme sayfası — arama-ve-seç + "sistemde yok, yeni ekle" seçeneği
router.get('/:id/iliski-ekle', async (req, res) => {
  const { type } = req.query; // father | mother | child | spouse

  if (!RELATION_LABELS[type]) {
    return res.status(400).send('Geçersiz ilişki tipi.');
  }

  const anchorPerson = await Person.findById(req.params.id).populate('familyGroupId');
  if (!anchorPerson) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

  // Çocuk eklerken, eğer anchor kişinin aktif bir eşi/eşleri varsa,
  // "bu çocuğun diğer ebeveyni de bu eş olsun mu?" seçeneği sunulur.
  const anchorSpouses = type === 'child' ? await getSpousesOf(anchorPerson._id) : [];

  res.render('persons/relationship-add', {
    t,
    anchorPerson,
    displayName,
    type,
    relationLabel: RELATION_LABELS[type],
    familyGroups,
    anchorSpouses,
    errorMessage: null,
  });
});

// Var olan bir kişiyi seçip bağlama
router.post('/:id/iliski-baglantisi', async (req, res) => {
  const { type, selectedPersonId, parentSide, anchorGender, otherGender, otherParentId } = req.body;
  const anchorId = req.params.id;

  try {
    if (type === 'spouse') {
      await linkSpouse(anchorId, selectedPersonId, anchorGender, otherGender);
    } else {
      await linkParentChild(type, anchorId, selectedPersonId, parentSide, otherParentId);
    }
    res.redirect(`/kisiler/${anchorId}/duzenle`);
  } catch (err) {
    const anchorPerson = await Person.findById(anchorId).populate('familyGroupId');
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    const anchorSpouses = type === 'child' ? await getSpousesOf(anchorId) : [];

    res.status(400).render('persons/relationship-add', {
      t,
      anchorPerson,
      displayName,
      type,
      relationLabel: RELATION_LABELS[type],
      familyGroups,
      anchorSpouses,
      errorMessage: err.message,
    });
  }
});

// Sistemde olmayan yeni bir kişi oluşturup aynı anda bağlama
router.post('/:id/iliski-yeni-kisi', async (req, res) => {
  const {
    type, officialFirstName, officialLastName, hasNoLastName, birthYear,
    familyGroupId, parentSide, gender, anchorGender, otherParentId, personalNickname,
  } = req.body;
  const anchorId = req.params.id;

  async function rerenderWithError(message) {
    const anchorPerson = await Person.findById(anchorId).populate('familyGroupId');
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    const anchorSpouses = type === 'child' ? await getSpousesOf(anchorId) : [];

    return res.status(400).render('persons/relationship-add', {
      t,
      anchorPerson,
      displayName,
      type,
      relationLabel: RELATION_LABELS[type],
      familyGroups,
      anchorSpouses,
      errorMessage: message,
    });
  }

  if (!officialFirstName || !officialFirstName.trim()) {
    return rerenderWithError('Ad zorunludur.');
  }
  // Aile seçimi opsiyonel — dışarıdan gelen kişiler için boş bırakılabilir.
  if (hasNoLastName !== 'on' && (!officialLastName || !officialLastName.trim())) {
    return rerenderWithError('Soyadı zorunludur (ya da "Soyadı yok" seçeneğini işaretleyin).');
  }

  try {
    const finalFirstName = officialFirstName.trim();
    const finalLastName = hasNoLastName === 'on' ? null : officialLastName.trim();
    const finalFamilyGroupId = familyGroupId || null;

    const effectiveSurname = await computeEffectiveSurname(
      {
        officialLastName: finalLastName,
        hasNoLastName: hasNoLastName === 'on',
        marriedLastName: null,
        familyGroupId: finalFamilyGroupId,
      },
      FamilyGroup
    );

    const finalNicknames = personalNickname && personalNickname.trim()
      ? [{ type: 'personal', value: personalNickname.trim(), inheritedFrom: null, note: null }]
      : [];

    const newPerson = new Person({
      familyGroupId: finalFamilyGroupId,
      officialFirstName: finalFirstName,
      officialLastName: finalLastName,
      hasNoLastName: hasNoLastName === 'on',
      birthYear: birthYear ? Number(birthYear) : null,
      gender: gender || null,
      nicknames: finalNicknames,
      nameKey: computeNameKey(finalFirstName, effectiveSurname),
      searchKey: computeSearchKey({
        officialFirstName: finalFirstName,
        officialLastName: finalLastName,
        hasNoLastName: hasNoLastName === 'on',
        marriedLastName: null,
        nicknames: finalNicknames,
      }),
    });

    await newPerson.save();
    await reassignSlugsForNameGroup(Person, newPerson.nameKey);

    if (type === 'spouse') {
      await linkSpouse(anchorId, newPerson._id, anchorGender, gender);
    } else {
      await linkParentChild(type, anchorId, newPerson._id, parentSide, otherParentId);
    }

    res.redirect(`/kisiler/${anchorId}/duzenle`);
  } catch (err) {
    return rerenderWithError(err.message);
  }
});

/**
 * type'a göre childId/parentId/parentSide'ı doğru sıraya koyup
 * ParentChild kaydı oluşturur.
 *
 * OTOMATİK CİNSİYET DÜZELTMESİ: "father"/"mother" tipinde, bağlanacak
 * kişinin (parentId) cinsiyeti biliniyorsa ve tıklanan butonla (type)
 * çelişiyorsa, sistem sessizce doğru tarafa (cinsiyete göre) kaydeder —
 * ör. "Baba Ekle"ye tıklanıp kadın bir kişi seçilirse, otomatik "anne"
 * olarak bağlanır. Cinsiyet bilinmiyorsa tıklanan buton (type) esas alınır.
 *
 * "child" tipinde: chosenParentSide verilmemişse (veya boşsa), anchor
 * kişinin KENDİ cinsiyetinden otomatik çıkarılır (kadın->anne, erkek->baba).
 * İkisi de yoksa (cinsiyet bilinmiyor VE seçim yapılmamış) hata verir.
 *
 * otherParentId: "child" tipinde, anchor'ın aktif eşi seçildiyse
 * (bkz. relationship-add.ejs "Bu çocuğun diğer ebeveyni") o eş de
 * otomatik olarak karşı taraftan bağlanır — tek işlemde her iki ebeveyn
 * de kurulmuş olur.
 */
async function linkParentChild(type, anchorId, otherPersonId, chosenParentSide, otherParentId) {
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

    const parentPerson = await Person.findById(parentId);
    if (parentPerson && parentPerson.gender === 'female') {
      parentSide = 'mother';
    } else if (parentPerson && parentPerson.gender === 'male') {
      parentSide = 'father';
    }
    // Cinsiyet bilinmiyorsa (null) tıklanan buton (type) esas alınır — değişiklik yok.
  } else if (type === 'child') {
    let resolvedSide = chosenParentSide;

    if (resolvedSide !== 'father' && resolvedSide !== 'mother') {
      const anchorPerson = await Person.findById(anchorId);
      if (anchorPerson && anchorPerson.gender === 'female') {
        resolvedSide = 'mother';
      } else if (anchorPerson && anchorPerson.gender === 'male') {
        resolvedSide = 'father';
      }
    }

    if (resolvedSide !== 'father' && resolvedSide !== 'mother') {
      throw new Error('Çocuk eklerken anchor kişinin baba mı anne mi olduğu belirlenemedi (cinsiyet bilinmiyor) — kişi düzenleme sayfasından cinsiyeti gir ya da elle seç.');
    }

    childId = otherPersonId;
    parentId = anchorId;
    parentSide = resolvedSide;
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

  // Diğer ebeveyn (aktif eş) de belirtildiyse, karşı taraftan otomatik bağla.
  if (type === 'child' && otherParentId && otherParentId.trim()) {
    const secondSide = parentSide === 'father' ? 'mother' : 'father';
    const secondExisting = await ParentChild.findOne({ childId: otherPersonId, parentSide: secondSide });
    if (!secondExisting) {
      await ParentChild.create({ childId: otherPersonId, parentId: otherParentId.trim(), parentSide: secondSide });
    }
  }
}

/**
 * Eş (Union) ilişkisi kurar ve otomatik evlilik soyadı ataması yapar.
 *
 * anchorGenderOverride / otherGenderOverride: ilişki ekleme sayfasında
 * o an için elle seçilmiş cinsiyet değerleri (opsiyonel) — sayfa tek
 * seferde hem ilişkiyi kurar hem de eksik/yanlış cinsiyet bilgisini
 * günceller, çünkü otomatik soyadı ataması buna bağlı.
 *
 * Kural: gender='female' olan taraf, eğer marriedLastName'i henüz boşsa,
 * diğer tarafın officialLastName'ini otomatik olarak marriedLastName
 * olarak alır. Hiçbir taraf 'female' değilse (ya da bilinmiyorsa)
 * otomatik atama yapılmaz — kullanıcı isterse elle girer.
 *
 * marriedLastName değiştiğinde nameKey/slug ve searchKey de yeniden
 * hesaplanır (evlilik soyadı artık aramada bulunabilir olsun diye).
 */
async function linkSpouse(anchorId, otherPersonId, anchorGenderOverride, otherGenderOverride) {
  if (String(anchorId) === String(otherPersonId)) {
    throw new Error('Bir kişi kendisiyle ilişkilendirilemez.');
  }

  const existing = await Union.findOne({
    $or: [
      { personAId: anchorId, personBId: otherPersonId },
      { personAId: otherPersonId, personBId: anchorId },
    ],
  });
  if (existing) {
    throw new Error('Bu eş ilişkisi zaten kayıtlı.');
  }

  const anchorPerson = await Person.findById(anchorId);
  const otherPerson = await Person.findById(otherPersonId);

  if (anchorGenderOverride === 'female' || anchorGenderOverride === 'male') {
    anchorPerson.gender = anchorGenderOverride;
  }
  if (otherGenderOverride === 'female' || otherGenderOverride === 'male') {
    otherPerson.gender = otherGenderOverride;
  }

  let marriedSurnameChanged = null; // hangi taraf değişti: 'anchor' | 'other' | null

  if (anchorPerson.gender === 'female' && !anchorPerson.marriedLastName && otherPerson.officialLastName) {
    anchorPerson.marriedLastName = otherPerson.officialLastName;
    marriedSurnameChanged = 'anchor';
  } else if (otherPerson.gender === 'female' && !otherPerson.marriedLastName && anchorPerson.officialLastName) {
    otherPerson.marriedLastName = anchorPerson.officialLastName;
    marriedSurnameChanged = 'other';
  }

  if (marriedSurnameChanged === 'anchor') {
    const effectiveSurname = await computeEffectiveSurname(anchorPerson, FamilyGroup);
    anchorPerson.nameKey = computeNameKey(anchorPerson.officialFirstName, effectiveSurname);
    anchorPerson.searchKey = computeSearchKey(anchorPerson);
  } else if (marriedSurnameChanged === 'other') {
    const effectiveSurname = await computeEffectiveSurname(otherPerson, FamilyGroup);
    otherPerson.nameKey = computeNameKey(otherPerson.officialFirstName, effectiveSurname);
    otherPerson.searchKey = computeSearchKey(otherPerson);
  }

  await anchorPerson.save();
  await otherPerson.save();

  if (marriedSurnameChanged === 'anchor') {
    await reassignSlugsForNameGroup(Person, anchorPerson.nameKey);
  } else if (marriedSurnameChanged === 'other') {
    await reassignSlugsForNameGroup(Person, otherPerson.nameKey);
  }

  await Union.create({ personAId: anchorId, personBId: otherPersonId, type: 'marriage' });
}

// Ebeveyn bağını kaldır (yanlış taraf girildiyse: kaldır, doğru tarafla yeniden ekle)
router.post('/:id/iliski-kaldir/ebeveyn/:parentSide', async (req, res) => {
  const { id, parentSide } = req.params;

  if (parentSide !== 'father' && parentSide !== 'mother') {
    return res.status(400).send('Geçersiz taraf.');
  }

  await ParentChild.findOneAndDelete({ childId: id, parentSide });
  res.redirect(`/kisiler/${id}/duzenle`);
});

// Çocuk bağını kaldır
router.post('/:id/iliski-kaldir/cocuk/:childId', async (req, res) => {
  const { id, childId } = req.params;

  await ParentChild.findOneAndDelete({ parentId: id, childId });
  res.redirect(`/kisiler/${id}/duzenle`);
});

// Eş bağını kaldır
router.post('/:id/iliski-kaldir/es/:spouseId', async (req, res) => {
  const { id, spouseId } = req.params;

  await Union.findOneAndDelete({
    $or: [
      { personAId: id, personBId: spouseId },
      { personAId: spouseId, personBId: id },
    ],
  });
  res.redirect(`/kisiler/${id}/duzenle`);
});

module.exports = router;
