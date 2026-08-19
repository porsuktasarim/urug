const express = require('express');
const User = require('../models/User');
const Membership = require('../models/Membership');
const Role = require('../models/Role');
const { t } = require('../lang');

const router = express.Router();

/**
 * İlk kurulum: sistemde hiç kullanıcı yoksa /kurulum-admin sayfası açık
 * kalır, ilk oluşturulan kullanıcı otomatik globalAdmin olur ve bu sayfa
 * kendini kilitler (bir daha kimse buradan admin oluşturamaz). Yeni
 * kullanıcı eklemek için bundan sonra bir globalAdmin, admin panelinden
 * elle eklemeli (ileride ayrı bir küçük adımda).
 */
router.get('/kurulum-admin', async (req, res) => {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return res.status(403).send('İlk admin zaten oluşturulmuş. Bu sayfa artık kullanılamaz.');
  }
  res.render('auth/kurulum-admin', { t, errorMessage: null });
});

router.post('/kurulum-admin', async (req, res) => {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return res.status(403).send('İlk admin zaten oluşturulmuş. Bu sayfa artık kullanılamaz.');
  }

  const { username, password, passwordConfirm } = req.body;

  if (!username || !username.trim() || !password) {
    return res.status(400).render('auth/kurulum-admin', {
      t,
      errorMessage: 'Kullanıcı adı ve şifre zorunludur.',
    });
  }
  if (password.length < 8) {
    return res.status(400).render('auth/kurulum-admin', {
      t,
      errorMessage: 'Şifre en az 8 karakter olmalıdır.',
    });
  }
  if (password !== passwordConfirm) {
    return res.status(400).render('auth/kurulum-admin', {
      t,
      errorMessage: 'Şifreler eşleşmiyor.',
    });
  }

  try {
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ username: username.trim(), passwordHash });

    // "Süper Admin" rolü uygulama açılışında seedRoles ile garanti oluşturuluyor.
    const superAdminRole = await Role.findOne({ name: 'Süper Admin' });
    await Membership.create({ userId: user._id, roleId: superAdminRole ? superAdminRole._id : null });

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.isGlobalAdmin = true;

    res.redirect('/');
  } catch (err) {
    const errorMessage = err.code === 11000 ? 'Bu kullanıcı adı zaten alınmış.' : err.message;
    res.status(400).render('auth/kurulum-admin', { t, errorMessage });
  }
});

router.get('/giris', async (req, res) => {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    return res.redirect('/kurulum-admin');
  }
  res.render('auth/giris', { t, errorMessage: null, next: req.query.next || '/' });
});

router.post('/giris', async (req, res) => {
  const { username, password } = req.body;
  const next = req.body.next || '/';

  const user = await User.findOne({ username: (username || '').trim().toLowerCase() });
  const passwordOk = user ? await user.checkPassword(password || '') : false;

  if (!user || !passwordOk) {
    return res.status(400).render('auth/giris', {
      t,
      errorMessage: 'Kullanıcı adı veya şifre hatalı.',
      next,
    });
  }

  const memberships = await Membership.find({ userId: user._id }).populate('roleId');
  const hasGlobalScope = memberships.some((m) => m.roleId && m.roleId.scopeType === 'global');

  req.session.userId = user._id;
  req.session.username = user.username;
  req.session.isGlobalAdmin = hasGlobalScope;

  res.redirect(next);
});

router.post('/cikis', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
