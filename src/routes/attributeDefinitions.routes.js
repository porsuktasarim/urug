const express = require('express');
const AttributeDefinition = require('../models/AttributeDefinition');
const { t } = require('../lang');
const { requireGlobalAdmin } = require('../middleware/auth');

const router = express.Router();

// Bu router'daki TÜM route'lar global admin gerektirir — kişi özellikleri
// yönetimi tamamen sistem geneli bir ayar, herkese açık değil.
router.use(requireGlobalAdmin);

// Liste — grup ve sıraya göre
router.get('/', async (req, res) => {
  const attributes = await AttributeDefinition.find()
    .collation({ locale: 'tr' })
    .sort({ group: 1, order: 1 });

  res.render('attribute-definitions/index', { attributes, t });
});

// Var olan tüm grup adlarını (tekrarsız, TR alfabetik) döner —
// form ekranında datalist önerisi olarak kullanılır.
async function getDistinctGroups() {
  const groups = await AttributeDefinition.distinct('group');
  return groups.filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
}

// Yeni ekleme formu
router.get('/new', async (req, res) => {
  const existingGroups = await getDistinctGroups();

  res.render('attribute-definitions/form', {
    t,
    attribute: null,
    types: AttributeDefinition.TYPES,
    existingGroups,
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

    const existingGroups = await getDistinctGroups();
    res.status(400).render('attribute-definitions/form', {
      t,
      attribute: req.body,
      types: AttributeDefinition.TYPES,
      existingGroups,
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

  const existingGroups = await getDistinctGroups();

  res.render('attribute-definitions/form', {
    t,
    attribute,
    types: AttributeDefinition.TYPES,
    existingGroups,
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

    const existingGroups = await getDistinctGroups();
    res.status(400).render('attribute-definitions/form', {
      t,
      attribute: { _id: req.params.id, ...req.body },
      types: AttributeDefinition.TYPES,
      existingGroups,
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
