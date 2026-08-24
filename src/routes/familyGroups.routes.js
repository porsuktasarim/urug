const express = require('express');
const fs = require('fs');
const path = require('path');
const FamilyGroup = require('../models/FamilyGroup');
const { slugify } = require('../utils/slugify');
const { randomAestheticHexColor } = require('../utils/familyColor');
const { familyPhotoUpload, processAndSaveImage, FAMILY_PHOTOS_DIR } = require('../config/uploadStorage');
const { t } = require('../lang');
const { requireLogin } = require('../middleware/auth');
const { requireFamilyEditAccess, requireFamilyCreateAccess } = require('../middleware/personAuthorization');

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
router.get('/new', requireLogin, requireFamilyCreateAccess, (req, res) => {
  res.render('family-groups/form', {
    t,
    familyGroup: null,
    suggestedColor: randomAestheticHexColor(),
    errorMessage: null,
  });
});

// Yeni kayıt oluşturma
router.post('/', requireLogin, requireFamilyCreateAccess, async (req, res) => {
  const { name, slug, colorCode, description } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    const familyGroup = new FamilyGroup({
      name,
      slug: finalSlug,
      colorCode: colorCode && colorCode.trim() ? colorCode.trim() : null,
      description: description && description.trim() ? description.trim() : null,
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
      familyGroup: { name, slug, colorCode, description },
      suggestedColor: randomAestheticHexColor(),
      errorMessage,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', requireLogin, requireFamilyEditAccess('id'), async (req, res) => {
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
router.post('/:id', requireLogin, requireFamilyEditAccess('id'), async (req, res) => {
  const { name, slug, colorCode, description } = req.body;

  try {
    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    await FamilyGroup.findByIdAndUpdate(req.params.id, {
      name,
      slug: finalSlug,
      colorCode: colorCode && colorCode.trim() ? colorCode.trim() : null,
      description: description && description.trim() ? description.trim() : null,
    });

    res.redirect('/aileler');
  } catch (err) {
    const errorMessage =
      err.code === 11000
        ? 'Bu slug zaten kullanılıyor, farklı bir slug seçin.'
        : err.message;

    res.status(400).render('family-groups/form', {
      t,
      familyGroup: { _id: req.params.id, name, slug, colorCode, description },
      suggestedColor: randomAestheticHexColor(),
      errorMessage,
    });
  }
});

// Fotoğraf yükleme
router.post(
  '/:id/foto-ekle',
  requireLogin,
  requireFamilyEditAccess('id'),
  familyPhotoUpload.single('photo'),
  async (req, res) => {
    const familyGroup = await FamilyGroup.findById(req.params.id);
    if (!familyGroup) {
      return res.status(404).send('Aile bulunamadı.');
    }
    if (!req.file) {
      return res.status(400).send('Dosya yüklenmedi.');
    }

    // Ham buffer sıkıştırılıp/boyutlandırılıp (WebP, max 1600px) DİSKE
    // BURADA yazılıyor — orijinal büyük dosya hiç diske inmiyor, kısıtlı
    // alan için önemli (bkz. utils/uploadStorage.js).
    let processed;
    try {
      processed = await processAndSaveImage(req.file.buffer, FAMILY_PHOTOS_DIR);
    } catch (err) {
      return res.status(400).send('Görsel işlenemedi: ' + err.message);
    }

    const { caption, tags } = req.body;
    const tagList = tags
      ? tags.split(',').map((t2) => t2.trim()).filter(Boolean)
      : [];

    familyGroup.photos.push({
      url: `/uploads/families/${processed.filename}`,
      caption: caption && caption.trim() ? caption.trim() : null,
      tags: tagList,
      uploadedBy: req.session.userId,
      uploadedAt: new Date(),
    });

    await familyGroup.save();
    res.redirect(`/aileler/${familyGroup._id}/duzenle`);
  }
);

// Fotoğraf silme
router.post('/:id/foto-sil/:photoId', requireLogin, requireFamilyEditAccess('id'), async (req, res) => {
  const familyGroup = await FamilyGroup.findById(req.params.id);
  if (!familyGroup) {
    return res.status(404).send('Aile bulunamadı.');
  }

  const photo = familyGroup.photos.id(req.params.photoId);
  if (photo) {
    const filePath = path.join(FAMILY_PHOTOS_DIR, path.basename(photo.url));
    fs.unlink(filePath, () => {}); // dosya yoksa/silinemezse sessizce geç, kayıt zaten kaldırılacak
    photo.deleteOne();
    await familyGroup.save();
  }

  res.redirect(`/aileler/${familyGroup._id}/duzenle`);
});

// Fotoğraf düzenleme — sonradan açıklama/etiket değiştirme (dosyaya dokunmaz).
router.post('/:id/foto-duzenle/:photoId', requireLogin, requireFamilyEditAccess('id'), async (req, res) => {
  const familyGroup = await FamilyGroup.findById(req.params.id);
  if (!familyGroup) {
    return res.status(404).send('Aile bulunamadı.');
  }

  const photo = familyGroup.photos.id(req.params.photoId);
  if (photo) {
    const { caption, tags } = req.body;
    photo.caption = caption && caption.trim() ? caption.trim() : null;
    photo.tags = tags ? tags.split(',').map((t2) => t2.trim()).filter(Boolean) : [];
    await familyGroup.save();
  }

  res.redirect(`/aileler/${familyGroup._id}/duzenle`);
});

// Silme
router.post('/:id/sil', requireLogin, requireFamilyEditAccess('id'), async (req, res) => {
  await FamilyGroup.findByIdAndDelete(req.params.id);
  res.redirect('/aileler');
});

module.exports = router;
