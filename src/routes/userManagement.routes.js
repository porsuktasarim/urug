const express = require('express');
const User = require('../models/User');
const Membership = require('../models/Membership');
const FamilyGroup = require('../models/FamilyGroup');
const Person = require('../models/Person');
const { requireGlobalAdmin } = require('../middleware/auth');
const { displayName } = require('../utils/displayName');
const { t } = require('../lang');

const router = express.Router();

// Bu router'daki TÜM route'lar global admin gerektirir — kullanıcı/rol
// yönetimi tamamen sistem geneli bir ayar.
router.use(requireGlobalAdmin);

const ROLE_LABELS = {
  globalAdmin: 'Global Admin',
  familyAdmin: 'Aile Admini',
  member: 'Üye',
};

// Liste — her kullanıcının rolü (varsa) ile birlikte
router.get('/', async (req, res) => {
  const users = await User.find().sort({ username: 1 });
  const memberships = await Membership.find().populate('familyGroupId').populate('scopePersonId');

  const membershipByUserId = new Map();
  memberships.forEach((m) => membershipByUserId.set(String(m.userId), m));

  const usersWithRole = users.map((u) => ({
    user: u,
    membership: membershipByUserId.get(String(u._id)) || null,
  }));

  res.render('admin/users/index', { t, usersWithRole, roleLabels: ROLE_LABELS, displayName });
});

router.get('/new', async (req, res) => {
  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

  res.render('admin/users/form', {
    t,
    targetUser: null,
    membership: null,
    familyGroups,
    roleLabels: ROLE_LABELS,
    scopePersonName: '',
    errorMessage: null,
  });
});

router.post('/', async (req, res) => {
  const { username, password, role, familyGroupId, scopePersonId } = req.body;

  async function rerenderWithError(message) {
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    return res.status(400).render('admin/users/form', {
      t,
      targetUser: { username },
      membership: { role, familyGroupId, scopePersonId },
      familyGroups,
      roleLabels: ROLE_LABELS,
      scopePersonName: '',
      errorMessage: message,
    });
  }

  if (!username || !username.trim() || !password) {
    return rerenderWithError('Kullanıcı adı ve şifre zorunludur.');
  }
  if (password.length < 8) {
    return rerenderWithError('Şifre en az 8 karakter olmalıdır.');
  }
  if (!ROLE_LABELS[role]) {
    return rerenderWithError('Geçersiz rol.');
  }
  if (role === 'familyAdmin' && !familyGroupId) {
    return rerenderWithError('Aile admini için bir aile seçilmelidir.');
  }
  if (role === 'member' && !scopePersonId) {
    return rerenderWithError('Üye için bir kişi (kapsam) seçilmelidir.');
  }

  try {
    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({ username: username.trim(), passwordHash });

    await Membership.create({
      userId: newUser._id,
      role,
      familyGroupId: role === 'familyAdmin' ? familyGroupId : null,
      scopePersonId: role === 'member' ? scopePersonId : null,
    });

    res.redirect('/admin/kullanicilar');
  } catch (err) {
    const message = err.code === 11000 ? 'Bu kullanıcı adı zaten alınmış.' : err.message;
    return rerenderWithError(message);
  }
});

router.get('/:id/duzenle', async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    return res.status(404).send('Kullanıcı bulunamadı.');
  }

  const membership = await Membership.findOne({ userId: targetUser._id }).populate('scopePersonId');
  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });

  res.render('admin/users/form', {
    t,
    targetUser,
    membership,
    familyGroups,
    roleLabels: ROLE_LABELS,
    scopePersonName: membership && membership.scopePersonId ? displayName(membership.scopePersonId) : '',
    errorMessage: null,
  });
});

router.post('/:id', async (req, res) => {
  const { role, familyGroupId, scopePersonId } = req.body;

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    return res.status(404).send('Kullanıcı bulunamadı.');
  }

  async function rerenderWithError(message) {
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    return res.status(400).render('admin/users/form', {
      t,
      targetUser,
      membership: { role, familyGroupId, scopePersonId },
      familyGroups,
      roleLabels: ROLE_LABELS,
      scopePersonName: '',
      errorMessage: message,
    });
  }

  if (!ROLE_LABELS[role]) {
    return rerenderWithError('Geçersiz rol.');
  }
  if (role === 'familyAdmin' && !familyGroupId) {
    return rerenderWithError('Aile admini için bir aile seçilmelidir.');
  }
  if (role === 'member' && !scopePersonId) {
    return rerenderWithError('Üye için bir kişi (kapsam) seçilmelidir.');
  }

  await Membership.findOneAndDelete({ userId: targetUser._id });
  await Membership.create({
    userId: targetUser._id,
    role,
    familyGroupId: role === 'familyAdmin' ? familyGroupId : null,
    scopePersonId: role === 'member' ? scopePersonId : null,
  });

  res.redirect('/admin/kullanicilar');
});

router.post('/:id/sil', async (req, res) => {
  if (String(req.params.id) === String(req.session.userId)) {
    return res.status(400).send('Kendi hesabını silemezsin.');
  }

  await Membership.deleteMany({ userId: req.params.id });
  await User.findByIdAndDelete(req.params.id);

  res.redirect('/admin/kullanicilar');
});

module.exports = router;
