const express = require('express');
const Role = require('../models/Role');
const { requireGlobalAdmin } = require('../middleware/auth');
const { t } = require('../lang');

const router = express.Router();

// Bu router'daki TÜM route'lar global (Süper Admin) yetki gerektirir —
// rol tanımları sistem geneli bir ayar.
router.use(requireGlobalAdmin);

const PERMISSION_LABELS = {
  canCreatePeople: 'Yeni kişi oluşturabilir',
  canEditPeople: 'Kişileri düzenleyebilir',
  canDeletePeople: 'Kişileri silebilir',
  canManageRelationships: 'Akrabalık bağı kurabilir/kaldırabilir',
  canEditFamily: 'Aile bilgisi/rengini düzenleyebilir',
  canViewTc: 'TC kimlik no görebilir',
};

const SCOPE_TYPE_LABELS = {
  global: 'Global (her yerde geçerli)',
  family: 'Aile (belirli bir aileyle sınırlı)',
  personSubtree: 'Kişi + Altsoyu (belirli bir kişi ve onun altsoyuyla sınırlı)',
};

function parsePermissions(body) {
  const permissions = {};
  Object.keys(PERMISSION_LABELS).forEach((key) => {
    permissions[key] = body[key] === 'on';
  });
  return permissions;
}

router.get('/', async (req, res) => {
  const roles = await Role.find().sort({ isSystemRole: -1, name: 1 });
  res.render('admin/roles/index', { t, roles, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS });
});

router.get('/new', (req, res) => {
  res.render('admin/roles/form', {
    t,
    role: null,
    permissionLabels: PERMISSION_LABELS,
    scopeTypeLabels: SCOPE_TYPE_LABELS,
    errorMessage: null,
  });
});

router.post('/', async (req, res) => {
  const { name, scopeType } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).render('admin/roles/form', {
      t, role: req.body, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS,
      errorMessage: 'Rol adı zorunludur.',
    });
  }
  if (!SCOPE_TYPE_LABELS[scopeType]) {
    return res.status(400).render('admin/roles/form', {
      t, role: req.body, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS,
      errorMessage: 'Geçersiz kapsam tipi.',
    });
  }

  try {
    await Role.create({
      name: name.trim(),
      scopeType,
      isSystemRole: false,
      permissions: parsePermissions(req.body),
    });
    res.redirect('/admin/roller');
  } catch (err) {
    const errorMessage = err.code === 11000 ? 'Bu rol adı zaten kullanılıyor.' : err.message;
    res.status(400).render('admin/roles/form', {
      t, role: req.body, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS, errorMessage,
    });
  }
});

router.get('/:id/duzenle', async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).send('Rol bulunamadı.');
  }

  res.render('admin/roles/form', {
    t, role, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS, errorMessage: null,
  });
});

router.post('/:id', async (req, res) => {
  const { name } = req.body;

  const existing = await Role.findById(req.params.id);
  if (!existing) {
    return res.status(404).send('Rol bulunamadı.');
  }

  try {
    // Sistem rolleri: sadece izinler değişebilir, ad/kapsam tipi kilitli.
    if (existing.isSystemRole) {
      existing.permissions = parsePermissions(req.body);
    } else {
      if (!name || !name.trim()) {
        throw new Error('Rol adı zorunludur.');
      }
      existing.name = name.trim();
      existing.permissions = parsePermissions(req.body);
      // scopeType özel rollerde de değiştirilmiyor — mevcut Membership
      // kayıtlarının kapsam alanlarıyla (familyGroupId/scopePersonId)
      // tutarsızlık oluşmasın diye kasıtlı olarak kilitli.
    }

    await existing.save();
    res.redirect('/admin/roller');
  } catch (err) {
    const errorMessage = err.code === 11000 ? 'Bu rol adı zaten kullanılıyor.' : err.message;
    res.status(400).render('admin/roles/form', {
      t, role: { ...existing.toObject(), ...req.body }, permissionLabels: PERMISSION_LABELS, scopeTypeLabels: SCOPE_TYPE_LABELS, errorMessage,
    });
  }
});

router.post('/:id/sil', async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).send('Rol bulunamadı.');
  }
  if (role.isSystemRole) {
    return res.status(400).send('Sistem rolleri silinemez.');
  }

  await Role.findByIdAndDelete(req.params.id);
  res.redirect('/admin/roller');
});

module.exports = router;
