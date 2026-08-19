const express = require('express');
const FamilyGroup = require('../models/FamilyGroup');
const { slugify } = require('../utils/slugify');
const { randomAestheticHexColor } = require('../utils/familyColor');
const { t } = require('../lang');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Liste — Türkçe alfabetik sıralama (collation: locale 'tr')
// MongoDB'nin varsayılan $regex/sort davranışı Türkçe karakterleri
// (ı/İ/ş/ğ/ç/ö/ü) doğru sıralamaz, bu yüzden collation zorunlu.
router.get('/', async (req, res) => {
  const familyGroups = await FamilyGroup.find()
    .collation({ locale: 'tr' })
    .sort({ name: 1 });

  res.render('family-groups/index', { familyGroups, t });
});

// Yeni ekleme formu
router.get('/new', requireLogin, (req, res) => {
  res.render('family-groups/form', {
    t,
    familyGroup: null,
    suggestedColor: randomAestheticHexColor(), // renk seçmezse bile boş kutuya bir öneri gelsin
    errorMessage: null,
  });
});

// Yeni kayıt oluşturma
router.post('/', requireLogin, async (req, res) => {
  const { name, slug, colorCode } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    const familyGroup = new FamilyGroup({
      name,
      slug: finalSlug,
      colorCode: colorCode && colorCode.trim() ? colorCode.trim() : null,
    });
    await familyGroup.save();

    res.redirect('/aileler');
  } catch (err) {
    const errorMessage =
      err.code === 11000
        ? 'Bu slug zaten kullanılıyor, farklı bir slug seçin.'
        : err.message;

    res.status(400).render('family-groups/form', {
      t,
      familyGroup: { name, slug, colorCode },
      suggestedColor: randomAestheticHexColor(),
      errorMessage,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', requireLogin, async (req, res) => {
  const familyGroup = await FamilyGroup.findById(req.params.id);

  if (!familyGroup) {
    return res.status(404).send('Aile bulunamadı.');
  }

  res.render('family-groups/form', {
    t,
    familyGroup,
    suggestedColor: randomAestheticHexColor(),
    errorMessage: null,
  });
});

// Güncelleme
router.post('/:id', requireLogin, async (req, res) => {
  const { name, slug, colorCode } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    await FamilyGroup.findByIdAndUpdate(req.params.id, {
      name,
      slug: finalSlug,
      colorCode: colorCode && colorCode.trim() ? colorCode.trim() : null,
    });

    res.redirect('/aileler');
  } catch (err) {
    const errorMessage =
      err.code === 11000
        ? 'Bu slug zaten kullanılıyor, farklı bir slug seçin.'
        : err.message;

    res.status(400).render('family-groups/form', {
      t,
      familyGroup: { _id: req.params.id, name, slug, colorCode },
      suggestedColor: randomAestheticHexColor(),
      errorMessage,
    });
  }
});

// Silme
router.post('/:id/sil', requireLogin, async (req, res) => {
  await FamilyGroup.findByIdAndDelete(req.params.id);
  res.redirect('/aileler');
});

module.exports = router;
