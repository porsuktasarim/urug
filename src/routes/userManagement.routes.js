const express = require('express');
const User = require('../models/User');
const Membership = require('../models/Membership');
const FamilyGroup = require('../models/FamilyGroup');
const Role = require('../models/Role');
const { requireGlobalAdmin } = require('../middleware/auth');
const { displayName } = require('../utils/displayName');
const { t } = require('../lang');

const router = express.Router();

// Bu router'daki TÜM route'lar global admin gerektirir — kullanıcı/rol
// yönetimi tamamen sistem geneli bir ayar.
router.use(requireGlobalAdmin);

async function getRolesSorted() {
  return Role.find().sort({ isSystemRole: -1, name: 1 });
}

// Liste — her kullanıcının rolü (varsa) ile birlikte
router.get('/', async (req, res) => {
  const users = await User.find().sort({ username: 1 });
  const memberships = await Membership.find()
    .populate('roleId')
    .populate('familyGroupId')
    .populate('scopePersonId');

  const membershipByUserId = new Map();
  memberships.forEach((m) => membershipByUserId.set(String(m.userId), m));

  const usersWithRole = users.map((u) => ({
    user: u,
    membership: membershipByUserId.get(String(u._id)) || null,
  }));

  res.render('admin/users/index', { t, usersWithRole, displayName });
});

router.get('/new', async (req, res) => {
  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
  const roles = await getRolesSorted();

  res.render('admin/users/form', {
    t,
    targetUser: null,
    membership: null,
    familyGroups,
    roles,
    scopePersonName: '',
    errorMessage: null,
  });
});

router.post('/', async (req, res) => {
  const { username, password, roleId, familyGroupId, scopePersonId } = req.body;

  async function rerenderWithError(message) {
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    const roles = await getRolesSorted();
    return res.status(400).render('admin/users/form', {
      t,
      targetUser: { username },
      membership: { roleId, familyGroupId, scopePersonId },
      familyGroups,
      roles,
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

  const selectedRole = roleId ? await Role.findById(roleId) : null;
  if (!selectedRole) {
    return rerenderWithError('Geçersiz rol.');
  }
  if (selectedRole.scopeType === 'family' && !familyGroupId) {
    return rerenderWithError('Bu rol için bir aile seçilmelidir.');
  }
  if (selectedRole.scopeType === 'personSubtree' && !scopePersonId) {
    return rerenderWithError('Bu rol için bir kişi (kapsam) seçilmelidir.');
  }

  try {
    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({ username: username.trim(), passwordHash });

    await Membership.create({
      userId: newUser._id,
      roleId: selectedRole._id,
      familyGroupId: selectedRole.scopeType === 'family' ? familyGroupId : null,
      scopePersonId: selectedRole.scopeType === 'personSubtree' ? scopePersonId : null,
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

  const membership = await Membership.findOne({ userId: targetUser._id })
    .populate('roleId')
    .populate('scopePersonId');
  const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
  const roles = await getRolesSorted();

  res.render('admin/users/form', {
    t,
    targetUser,
    membership,
    familyGroups,
    roles,
    scopePersonName: membership && membership.scopePersonId ? displayName(membership.scopePersonId) : '',
    errorMessage: null,
  });
});

router.post('/:id', async (req, res) => {
  const { roleId, familyGroupId, scopePersonId } = req.body;

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    return res.status(404).send('Kullanıcı bulunamadı.');
  }

  async function rerenderWithError(message) {
    const familyGroups = await FamilyGroup.find().collation({ locale: 'tr' }).sort({ name: 1 });
    const roles = await getRolesSorted();
    return res.status(400).render('admin/users/form', {
      t,
      targetUser,
      membership: { roleId, familyGroupId, scopePersonId },
      familyGroups,
      roles,
      scopePersonName: '',
      errorMessage: message,
    });
  }

  const selectedRole = roleId ? await Role.findById(roleId) : null;
  if (!selectedRole) {
    return rerenderWithError('Geçersiz rol.');
  }
  if (selectedRole.scopeType === 'family' && !familyGroupId) {
    return rerenderWithError('Bu rol için bir aile seçilmelidir.');
  }
  if (selectedRole.scopeType === 'personSubtree' && !scopePersonId) {
    return rerenderWithError('Bu rol için bir kişi (kapsam) seçilmelidir.');
  }

  await Membership.findOneAndDelete({ userId: targetUser._id });
  await Membership.create({
    userId: targetUser._id,
    roleId: selectedRole._id,
    familyGroupId: selectedRole.scopeType === 'family' ? familyGroupId : null,
    scopePersonId: selectedRole.scopeType === 'personSubtree' ? scopePersonId : null,
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
