const express = require('express');
const { requireGlobalAdmin } = require('../middleware/auth');
const DriveConnection = require('../models/DriveConnection');
const GoogleOAuthCredentials = require('../models/GoogleOAuthCredentials');
const {
  getAuthUrl,
  completeOAuthConnection,
  saveOAuthCredentials,
  setPrimaryImagesConnection,
  disconnectDriveConnection,
} = require('../utils/googleDrive');
const { t } = require('../lang');

const router = express.Router();

router.use(requireGlobalAdmin);

async function renderPage(res, errorMessage, statusCode) {
  const connections = await DriveConnection.find().sort({ createdAt: 1 });
  const oauthCredentials = await GoogleOAuthCredentials.findOne();
  const hasEnvCredentials = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
  );

  const render = statusCode ? res.status(statusCode) : res;
  render.render('admin/drive-settings', {
    t, connections, oauthCredentials, hasEnvCredentials, errorMessage: errorMessage || null,
  });
}

router.get('/', async (req, res) => {
  await renderPage(res);
});

// OAuth istemci kimlik bilgilerini kaydet (web arayüzünden).
router.post('/kimlik-bilgileri', async (req, res) => {
  const { clientId, clientSecret, redirectUri } = req.body;

  if (!clientId || !clientId.trim() || !redirectUri || !redirectUri.trim()) {
    return renderPage(res, 'İstemci kimliği ve yönlendirme adresi zorunludur.', 400);
  }
  // clientSecret boş bırakılırsa (ör. sadece redirectUri güncelleniyorsa)
  // mevcut şifreli değeri koru.
  const existing = await GoogleOAuthCredentials.findOne();
  const finalSecret = clientSecret && clientSecret.trim()
    ? clientSecret.trim()
    : (existing ? null : null); // aşağıda ayrıca kontrol ediliyor

  if (!finalSecret && !(existing && existing.clientSecretEncrypted)) {
    return renderPage(res, 'İstemci gizli anahtarı zorunludur.', 400);
  }

  try {
    if (finalSecret) {
      await saveOAuthCredentials(clientId, finalSecret, redirectUri);
    } else {
      existing.clientId = clientId.trim();
      existing.redirectUri = redirectUri.trim();
      await existing.save();
    }
    res.redirect('/ayarlar/drive');
  } catch (err) {
    await renderPage(res, err.message, 400);
  }
});

router.get('/baglan', async (req, res) => {
  try {
    const url = await getAuthUrl();
    res.redirect(url);
  } catch (err) {
    await renderPage(res, err.message, 400);
  }
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return renderPage(res, 'Google izin ekranı iptal edildi ya da bir hata oluştu.', 400);
  }

  try {
    await completeOAuthConnection(code, req.session.username, req.query.state);
    res.redirect('/ayarlar/drive');
  } catch (err) {
    await renderPage(res, err.message, 400);
  }
});

router.post('/:id/birincil-yap', async (req, res) => {
  await setPrimaryImagesConnection(req.params.id);
  res.redirect('/ayarlar/drive');
});

router.post('/:id/yedek-kullanimi', async (req, res) => {
  await DriveConnection.findByIdAndUpdate(req.params.id, {
    useForBackups: req.body.useForBackups === 'on',
  });
  res.redirect('/ayarlar/drive');
});

router.post('/:id/baglantiyi-kes', async (req, res) => {
  await disconnectDriveConnection(req.params.id);
  res.redirect('/ayarlar/drive');
});

module.exports = router;
