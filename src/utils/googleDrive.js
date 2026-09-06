const { google } = require('googleapis');
const DriveConnection = require('../models/DriveConnection');
const GoogleOAuthCredentials = require('../models/GoogleOAuthCredentials');
const { getSiteConfig } = require('./siteConfig');
const { encryptTc, decryptTc } = require('./tcCrypto'); // isme aldanma — genel AES-256-GCM şifreleme

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
// "drive.file" kapsamı BİLİNÇLİ seçildi: sadece BU UYGULAMANIN oluşturduğu
// dosyalara erişim verir, kullanıcının tüm Drive'ını görmez — en dar/güvenli kapsam.

/**
 * OAuth istemci kimlik bilgilerini ÖNCE veritabanından (admin panelinden
 * girilmiş), yoksa ortam değişkenlerinden (.env / Coolify) okur — DB
 * her zaman öncelikli, böylece admin panelden girilen değer .env'i geçersiz
 * kılabilir.
 */
async function getOAuthCredentials() {
  const dbCreds = await GoogleOAuthCredentials.findOne();

  const clientId = (dbCreds && dbCreds.clientId) || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = dbCreds && dbCreds.clientSecretEncrypted
    ? decryptTc(dbCreds.clientSecretEncrypted)
    : process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = (dbCreds && dbCreds.redirectUri) || process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth kimlik bilgileri tanımlı değil — Ayarlar → Google Drive üzerinden gir ya da GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI ortam değişkenlerini ayarla.'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

async function getOAuthClient() {
  const { clientId, clientSecret, redirectUri } = await getOAuthCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Admin panelinden girilen OAuth kimlik bilgilerini kaydeder (clientSecret şifreli).
 */
async function saveOAuthCredentials(clientId, clientSecret, redirectUri) {
  let creds = await GoogleOAuthCredentials.findOne();
  if (!creds) creds = new GoogleOAuthCredentials();

  creds.clientId = clientId.trim();
  creds.clientSecretEncrypted = encryptTc(clientSecret.trim());
  creds.redirectUri = redirectUri.trim();
  await creds.save();

  return creds;
}

/**
 * Kullanıcıyı Google'ın izin ekranına yönlendirecek URL'i üretir.
 */
async function getAuthUrl() {
  const oauth2Client = await getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh token almak için ZORUNLU
    prompt: 'consent', // her seferinde refresh token dönmesini garanti eder
    scope: SCOPES,
  });
}

/**
 * OAuth callback'te gelen "code" ile token değişimi yapar, YENİ bir
 * DriveConnection kaydı oluşturur (mevcut bağlantıların üzerine YAZMAZ —
 * artık birden fazla hesap bağlanabiliyor), "<Site Adı> Yüklemeleri"
 * klasörünü oluşturur.
 */
async function completeOAuthConnection(code, connectedByUsername, label) {
  const oauth2Client = await getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google refresh token döndürmedi — muhtemelen bu hesap daha önce bağlanmıştı, Google hesap izinlerinden Uruğ erişimini kaldırıp tekrar dene.'
    );
  }

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
  const { data: userInfo } = await oauth2.userinfo.get();

  const siteConfig = await getSiteConfig();
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const folder = await drive.files.create({
    requestBody: {
      name: `${siteConfig.siteName} Yüklemeleri`,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const existingCount = await DriveConnection.countDocuments();

  const connection = await DriveConnection.create({
    label: label && label.trim() ? label.trim() : (userInfo.email || `Bağlantı ${existingCount + 1}`),
    connected: true,
    connectedByUsername,
    refreshTokenEncrypted: encryptTc(tokens.refresh_token),
    driveAccountEmail: userInfo.email || null,
    uploadsFolderId: folder.data.id,
    // İlk bağlanan hesap otomatik olarak görseller için birincil olsun —
    // sonrakiler admin panelinden elle birincil yapılabilir.
    isPrimaryForImages: existingCount === 0,
  });

  return connection;
}

/**
 * Belirli bir DriveConnection için kimliği doğrulanmış bir Drive istemcisi döner.
 */
async function getAuthenticatedDriveClient(connectionId) {
  const connection = await DriveConnection.findById(connectionId);
  if (!connection || !connection.connected || !connection.refreshTokenEncrypted) {
    return null;
  }

  const oauth2Client = await getOAuthClient();
  const refreshToken = decryptTc(connection.refreshTokenEncrypted);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { drive: google.drive({ version: 'v3', auth: oauth2Client }), connection };
}

/**
 * Görseller için BİRİNCİL olan bağlantıyı döner (yoksa null).
 */
async function getPrimaryImagesConnection() {
  return DriveConnection.findOne({ connected: true, isPrimaryForImages: true });
}

/**
 * Yedekleme için işaretlenmiş TÜM bağlantıları döner (gelecek adım —
 * yedekleme sistemi — burayı kullanacak).
 */
async function getBackupConnections() {
  return DriveConnection.find({ connected: true, useForBackups: true });
}

/**
 * Bellekteki bir dosya buffer'ını belirtilen bağlantının uploads
 * klasörüne yükler.
 * @returns {Promise<string>} Drive dosya id'si
 */
async function uploadBufferToDrive(connectionId, buffer, filename, mimeType) {
  const client = await getAuthenticatedDriveClient(connectionId);
  if (!client) throw new Error('Belirtilen Google Drive bağlantısı geçerli değil.');

  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  const { data } = await client.drive.files.create({
    requestBody: {
      name: filename,
      parents: [client.connection.uploadsFolderId],
    },
    media: { mimeType, body: stream },
    fields: 'id',
  });

  return data.id;
}

/**
 * Bir Drive dosyasını okunabilir bir stream olarak döner — sunucu bunu
 * doğrudan HTTP response'a pipe eder, Drive linki hiç istemciye verilmez.
 */
async function getDriveFileStream(connectionId, fileId) {
  const client = await getAuthenticatedDriveClient(connectionId);
  if (!client) throw new Error('Belirtilen Google Drive bağlantısı geçerli değil.');

  const response = await client.drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return response.data;
}

async function deleteDriveFile(connectionId, fileId) {
  const client = await getAuthenticatedDriveClient(connectionId);
  if (!client) return; // bağlantı yoksa sessizce geç
  try {
    await client.drive.files.delete({ fileId });
  } catch (err) {
    console.warn('[drive] Dosya silinemedi (muhtemelen zaten yok):', fileId, err.message);
  }
}

/**
 * "Bağlı olmak" ile "görseller için kullanılıyor olmak" AYRI şeylerdir.
 * Görsel yükleme akışları bu fonksiyonu kullanmalı.
 */
async function isDriveEnabledForImages() {
  const primary = await getPrimaryImagesConnection();
  return !!primary;
}

async function isDriveEnabledForBackups() {
  const connections = await getBackupConnections();
  return connections.length > 0;
}

/**
 * Bir bağlantıyı görseller için BİRİNCİL yapar — aynı anda sadece bir
 * tanesi birincil olabileceği için diğerlerini otomatik false'a çeker.
 */
async function setPrimaryImagesConnection(connectionId) {
  await DriveConnection.updateMany({}, { isPrimaryForImages: false });
  await DriveConnection.findByIdAndUpdate(connectionId, { isPrimaryForImages: true });
}

async function disconnectDriveConnection(connectionId) {
  await DriveConnection.findByIdAndDelete(connectionId);
}

module.exports = {
  getAuthUrl,
  completeOAuthConnection,
  saveOAuthCredentials,
  getAuthenticatedDriveClient,
  getPrimaryImagesConnection,
  getBackupConnections,
  uploadBufferToDrive,
  getDriveFileStream,
  deleteDriveFile,
  isDriveEnabledForImages,
  isDriveEnabledForBackups,
  setPrimaryImagesConnection,
  disconnectDriveConnection,
};
