const express = require('express');
const Person = require('../models/Person');
const {
  personPhotoUpload,
  processNewPersonPhoto,
  recropPersonPhoto,
  deletePersonPhotoFiles,
} = require('../config/personPhotoStorage');
const { requireLogin } = require('../middleware/auth');
const { requirePersonEditAccess } = require('../middleware/personAuthorization');

const router = express.Router();

// ÖNEMLİ: requirePersonEditAccess ARTIK blanket router.use('/:id', ...) ile
// DEĞİL, her route'a AYRI AYRI uygulanıyor (aşağıda). Sebep: bu router
// /kisiler prefix'inde BAŞKA router'larla (ör. treeView.routes.js —
// GET /:id/agac herkese açık olmalı) birlikte mount ediliyor. Blanket bir
// '/:id' middleware'i, o path deseniyle eşleşen ama bu router'da hiç
// tanımlı olmayan istekleri de yanlışlıkla yakalayıp reddedebiliyordu
// (gerçek Express testiyle doğrulandı — ör. ağaç görüntüleme yanlışlıkla
// düzenleme yetkisi ister hale geliyordu).
router.use(requireLogin);

// Yeni fotoğraf yükleme — otomatik ortadan kırpılıp vesikalık boyutuna getirilir.
router.post('/:id/foto-ekle', requirePersonEditAccess('id'), personPhotoUpload.single('photo'), async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }
  if (!req.file) {
    return res.status(400).send('Dosya yüklenmedi.');
  }

  let processed;
  try {
    processed = await processNewPersonPhoto(req.file.buffer);
  } catch (err) {
    return res.status(400).send('Görsel işlenemedi: ' + err.message);
  }

  // Eski fotoğraf(lar) varsa diskten temizle (yenisiyle değiştiriliyor).
  deletePersonPhotoFiles([person.photo, person.photoOriginal]);

  person.photo = processed.photoUrl;
  person.photoOriginal = processed.photoOriginalUrl;
  person.photoCropData = processed.cropData;
  await person.save();

  res.redirect(`/kisiler/${person._id}/duzenle`);
});

// Elle kırpma — orijinale dokunmadan sadece vesikalık (photo) yeniden üretilir.
router.post('/:id/foto-kirp', requirePersonEditAccess('id'), async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }
  if (!person.photoOriginal) {
    return res.status(400).send('Önce bir fotoğraf yüklenmeli.');
  }

  const { x, y, width, height } = req.body;
  const cropRect = {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  };

  if (
    Number.isNaN(cropRect.x) || Number.isNaN(cropRect.y) ||
    Number.isNaN(cropRect.width) || Number.isNaN(cropRect.height) ||
    cropRect.width <= 0 || cropRect.height <= 0
  ) {
    return res.status(400).send('Geçersiz kırpma verisi.');
  }

  try {
    const newPhotoUrl = await recropPersonPhoto(person.photoOriginal, cropRect);
    deletePersonPhotoFiles([person.photo]); // sadece eski vesikalık siliniyor, orijinal kalıyor
    person.photo = newPhotoUrl;
    person.photoCropData = cropRect;
    await person.save();
  } catch (err) {
    return res.status(400).send('Kırpma uygulanamadı: ' + err.message);
  }

  res.redirect(`/kisiler/${person._id}/duzenle`);
});

// Fotoğrafı tamamen kaldırma (hem vesikalık hem orijinal).
router.post('/:id/foto-sil', requirePersonEditAccess('id'), async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  deletePersonPhotoFiles([person.photo, person.photoOriginal]);
  person.photo = null;
  person.photoOriginal = null;
  person.photoCropData = { x: null, y: null, width: null, height: null };
  await person.save();

  res.redirect(`/kisiler/${person._id}/duzenle`);
});

module.exports = router;
