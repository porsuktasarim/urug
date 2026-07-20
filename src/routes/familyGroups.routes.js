const express = require('express');
const FamilyGroup = require('../models/FamilyGroup');
const { slugify } = require('../utils/slugify');
const { t } = require('../lang');

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
router.get('/new', (req, res) => {
  res.render('family-groups/form', {
    t,
    familyGroup: null,
    errorMessage: null,
  });
});

// Yeni kayıt oluşturma
router.post('/', async (req, res) => {
  const { name, slug } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    const familyGroup = new FamilyGroup({ name, slug: finalSlug });
    await familyGroup.save();

    res.redirect('/aileler');
  } catch (err) {
    const errorMessage =
      err.code === 11000
        ? 'Bu slug zaten kullanılıyor, farklı bir slug seçin.'
        : err.message;

    res.status(400).render('family-groups/form', {
      t,
      familyGroup: { name, slug },
      errorMessage,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', async (req, res) => {
  const familyGroup = await FamilyGroup.findById(req.params.id);

  if (!familyGroup) {
    return res.status(404).send('Aile bulunamadı.');
  }

  res.render('family-groups/form', { t, familyGroup, errorMessage: null });
});

// Güncelleme
router.post('/:id', async (req, res) => {
  const { name, slug } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    await FamilyGroup.findByIdAndUpdate(req.params.id, {
      name,
      slug: finalSlug,
    });

    res.redirect('/aileler');
  } catch (err) {
    const errorMessage =
      err.code === 11000
        ? 'Bu slug zaten kullanılıyor, farklı bir slug seçin.'
        : err.message;

    res.status(400).render('family-groups/form', {
      t,
      familyGroup: { _id: req.params.id, name, slug },
      errorMessage,
    });
  }
});

// Silme
router.post('/:id/sil', async (req, res) => {
  await FamilyGroup.findByIdAndDelete(req.params.id);
  res.redirect('/aileler');
});

module.exports = router;
