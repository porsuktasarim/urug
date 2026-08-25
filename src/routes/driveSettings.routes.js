const express = require('express');
const { requireGlobalAdmin } = require('../middleware/auth');
const DriveConfig = require('../models/DriveConfig');
const {
  getAuthUrl,
  completeOAuthConnection,
  disconnectDrive,
} = require('../utils/googleDrive');
const { t } = require('../lang');

const router = express.Router();

router.use(requireGlobalAdmin);

router.get('/', async (req, res) => {
  const config = await DriveConfig.findOne();
  res.render('admin/drive-settings', { t, config, errorMessage: null });
});

router.get('/baglan', async (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    const config = await DriveConfig.findOne();
    res.status(400).render('admin/drive-settings', { t, config, errorMessage: err.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    const config = await DriveConfig.findOne();
    return res.status(400).render('admin/drive-settings', {
      t, config, errorMessage: 'Google izin ekranı iptal edildi ya da bir hata oluştu.',
    });
  }

  try {
    await completeOAuthConnection(code, req.session.username);
    res.redirect('/ayarlar/drive');
  } catch (err) {
    const config = await DriveConfig.findOne();
    res.status(400).render('admin/drive-settings', { t, config, errorMessage: err.message });
  }
});

router.post('/baglantiyi-kes', async (req, res) => {
  await disconnectDrive();
  res.redirect('/ayarlar/drive');
});

// Bağlı olmak ile kullanılıyor olmak ayrı — kullanıcı bağlansa bile
// sadece görseller/sadece yedekler/ikisi de/hiçbiri (ileride lazım olur
// diye) seçebilir.
router.post('/kullanim-ayarlari', async (req, res) => {
  const config = await DriveConfig.findOne();
  if (!config || !config.connected) {
    return res.status(400).send('Önce Google Drive\'a bağlanmalısın.');
  }

  config.useForImages = req.body.useForImages === 'on';
  config.useForBackups = req.body.useForBackups === 'on';
  await config.save();

  res.redirect('/ayarlar/drive');
});

module.exports = router;
