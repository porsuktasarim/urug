const express = require('express');
const AttributeDefinition = require('../models/AttributeDefinition');
const { t } = require('../lang');

const router = express.Router();

// Liste — grup ve sıraya göre
router.get('/', async (req, res) => {
  const attributes = await AttributeDefinition.find()
    .collation({ locale: 'tr' })
    .sort({ group: 1, order: 1 });

  res.render('attribute-definitions/index', { attributes, t });
});

// Yeni ekleme formu
router.get('/new', (req, res) => {
  res.render('attribute-definitions/form', {
    t,
    attribute: null,
    types: AttributeDefinition.TYPES,
    errorMessage: null,
  });
});

function parseOptions(rawOptions) {
  if (!rawOptions) return [];
  return rawOptions
    .split(',')
    .map((opt) => opt.trim())
    .filter(Boolean);
}

// Yeni kayıt oluşturma
router.post('/', async (req, res) => {
  const {
    key, label, type, options, isRequired, isActive,
    group, order, dependsOn, requiredWhen,
  } = req.body;

  try {
    const attribute = new AttributeDefinition({
      key,
      label,
      type,
      options: parseOptions(options),
      isRequired: isRequired === 'on',
      isActive: isActive === 'on',
      group: group || 'Genel',
      order: Number(order) || 0,
      conditionalRequirement: dependsOn
        ? { dependsOn, requiredWhen: requiredWhen === 'true' }
        : { dependsOn: null, requiredWhen: null },
    });

    await attribute.save();
    res.redirect('/admin/ozellikler');
  } catch (err) {
    const errorMessage =
      err.code === 11000 ? 'Bu key zaten kullanılıyor.' : err.message;

    res.status(400).render('attribute-definitions/form', {
      t,
      attribute: req.body,
      types: AttributeDefinition.TYPES,
      errorMessage,
    });
  }
});

// Düzenleme formu
router.get('/:id/duzenle', async (req, res) => {
  const attribute = await AttributeDefinition.findById(req.params.id);

  if (!attribute) {
    return res.status(404).send('Özellik bulunamadı.');
  }

  res.render('attribute-definitions/form', {
    t,
    attribute,
    types: AttributeDefinition.TYPES,
    errorMessage: null,
  });
});

// Güncelleme
router.post('/:id', async (req, res) => {
  const {
    key, label, type, options, isRequired, isActive,
    group, order, dependsOn, requiredWhen,
  } = req.body;

  try {
    const existing = await AttributeDefinition.findById(req.params.id);

    if (!existing) {
      return res.status(404).send('Özellik bulunamadı.');
    }

    // isSystem alanlar: key/type değiştirilemez, pasifleştirilemez, zorunluluğu kaldırılamaz
    const update = existing.isSystem
      ? {
          label,
          group: group || 'Genel',
          order: Number(order) || 0,
        }
      : {
          key,
          label,
          type,
          options: parseOptions(options),
          isRequired: isRequired === 'on',
          isActive: isActive === 'on',
          group: group || 'Genel',
          order: Number(order) || 0,
          conditionalRequirement: dependsOn
            ? { dependsOn, requiredWhen: requiredWhen === 'true' }
            : { dependsOn: null, requiredWhen: null },
        };

    await AttributeDefinition.findByIdAndUpdate(req.params.id, update);
    res.redirect('/admin/ozellikler');
  } catch (err) {
    const errorMessage =
      err.code === 11000 ? 'Bu key zaten kullanılıyor.' : err.message;

    res.status(400).render('attribute-definitions/form', {
      t,
      attribute: { _id: req.params.id, ...req.body },
      types: AttributeDefinition.TYPES,
      errorMessage,
    });
  }
});

// Aktif/Pasif hızlı değiştirme
router.post('/:id/aktiflik', async (req, res) => {
  const attribute = await AttributeDefinition.findById(req.params.id);

  if (!attribute) {
    return res.status(404).send('Özellik bulunamadı.');
  }

  if (attribute.isSystem) {
    return res.status(400).send('Sistem alanları pasifleştirilemez.');
  }

  attribute.isActive = !attribute.isActive;
  await attribute.save();
  res.redirect('/admin/ozellikler');
});

// Silme (isSystem korumalı)
router.post('/:id/sil', async (req, res) => {
  const attribute = await AttributeDefinition.findById(req.params.id);

  if (!attribute) {
    return res.status(404).send('Özellik bulunamadı.');
  }

  if (attribute.isSystem) {
    return res.status(400).send('Sistem alanları silinemez.');
  }

  await AttributeDefinition.findByIdAndDelete(req.params.id);
  res.redirect('/admin/ozellikler');
});

module.exports = router;
