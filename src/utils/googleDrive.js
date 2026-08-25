const { google } = require('googleapis');
const DriveConfig = require('../models/DriveConfig');
const { encryptTc, decryptTc } = require('./tcCrypto'); // isme aldanma — genel AES-256-GCM şifreleme

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
// "drive.file" kapsamı BİLİNÇLİ seçildi: sadece BU UYGULAMANIN oluşturduğu
// dosyalara erişim verir, kullanıcının tüm Drive'ını görmez — en dar/güvenli kapsam.

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI ortam değişkenleri tanımlı değil.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Kullanıcıyı Google'ın izin ekranına yönlendirecek URL'i üretir.
 */
function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh token almak için ZORUNLU
    prompt: 'consent', // her seferinde refresh token dönmesini garanti eder
    scope: SCOPES,
  });
}

/**
 * OAuth callback'te gelen "code" ile token değişimi yapar, refresh token'ı
 * şifreleyip DriveConfig'e kaydeder, gerekirse "Uruğ Yüklemeleri" klasörünü oluşturur.
 */
async function completeOAuthConnection(code, connectedByUsername) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google refresh token döndürmedi — muhtemelen daha önce bu hesap bağlanmıştı, Google hesap izinlerinden Uruğ erişimini kaldırıp tekrar dene.'
    );
  }

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
  const { data: userInfo } = await oauth2.userinfo.get();

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const folder = await drive.files.create({
    requestBody: {
      name: 'Uruğ Yüklemeleri',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  let config = await DriveConfig.findOne();
  if (!config) config = new DriveConfig();

  config.connected = true;
  config.connectedByUsername = connectedByUsername;
  config.refreshTokenEncrypted = encryptTc(tokens.refresh_token);
  config.driveAccountEmail = userInfo.email || null;
  config.uploadsFolderId = folder.data.id;
  await config.save();

  return config;
}

/**
 * Kayıtlı refresh token ile kimliği doğrulanmış bir Drive istemcisi döner.
 * Bağlantı yoksa null döner (çağıran taraf yerel diske düşmeli).
 */
async function getAuthenticatedDriveClient() {
  const config = await DriveConfig.findOne();
  if (!config || !config.connected || !config.refreshTokenEncrypted) {
    return null;
  }

  const oauth2Client = getOAuthClient();
  const refreshToken = decryptTc(config.refreshTokenEncrypted);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { drive: google.drive({ version: 'v3', auth: oauth2Client }), config };
}

/**
 * Bellekteki bir dosya buffer'ını Drive'daki uploads klasörüne yükler.
 * @returns {Promise<string>} Drive dosya id'si
 */
async function uploadBufferToDrive(buffer, filename, mimeType) {
  const client = await getAuthenticatedDriveClient();
  if (!client) throw new Error('Google Drive bağlı değil.');

  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  const { data } = await client.drive.files.create({
    requestBody: {
      name: filename,
      parents: [client.config.uploadsFolderId],
    },
    media: { mimeType, body: stream },
    fields: 'id',
  });

  return data.id;
}

/**
 * Bir Drive dosyasını okunabilir bir stream olarak döner — sunucu bunu
 * doğrudan HTTP response'a pipe eder (bkz. routes personPhoto/familyGroups
 * "/uploads/drive/:fileId" proxy route'u), Drive linki hiç istemciye
 * verilmez.
 */
async function getDriveFileStream(fileId) {
  const client = await getAuthenticatedDriveClient();
  if (!client) throw new Error('Google Drive bağlı değil.');

  const response = await client.drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return response.data;
}

async function deleteDriveFile(fileId) {
  const client = await getAuthenticatedDriveClient();
  if (!client) return; // bağlantı yoksa sessizce geç
  try {
    await client.drive.files.delete({ fileId });
  } catch (err) {
    console.warn('[drive] Dosya silinemedi (muhtemelen zaten yok):', fileId, err.message);
  }
}

async function isDriveConnected() {
  const config = await DriveConfig.findOne();
  return !!(config && config.connected);
}

/**
 * "Bağlı olmak" ile "görseller için kullanılıyor olmak" AYRI şeylerdir —
 * kullanıcı bağlanıp sadece yedekler için (ya da hiçbiri için, ileride
 * lazım olur diye) kullanmayı seçebilir. Görsel yükleme akışları bu
 * fonksiyonu kullanmalı, isDriveConnected()'ı DEĞİL.
 */
async function isDriveEnabledForImages() {
  const config = await DriveConfig.findOne();
  return !!(config && config.connected && config.useForImages);
}

/**
 * Yedekleme sistemi (gelecek adım) bu fonksiyonu kullanacak.
 */
async function isDriveEnabledForBackups() {
  const config = await DriveConfig.findOne();
  return !!(config && config.connected && config.useForBackups);
}

async function disconnectDrive() {
  const config = await DriveConfig.findOne();
  if (config) {
    config.connected = false;
    config.refreshTokenEncrypted = null;
    await config.save();
  }
}

module.exports = {
  getAuthUrl,
  completeOAuthConnection,
  getAuthenticatedDriveClient,
  uploadBufferToDrive,
  getDriveFileStream,
  deleteDriveFile,
  isDriveConnected,
  isDriveEnabledForImages,
  isDriveEnabledForBackups,
  disconnectDrive,
};
