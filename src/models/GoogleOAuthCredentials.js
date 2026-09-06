const mongoose = require('mongoose');

/**
 * GoogleOAuthCredentials — sistemde TEK bir kayıt. Google Cloud
 * Console'dan alınan OAuth istemci kimliğini (Client ID/Secret) ve
 * yönlendirme adresini saklar — artık .env dosyasına gerek yok, admin
 * panelinden (bkz. routes/driveSettings.routes.js) girilebiliyor.
 *
 * ÖNEMLİ: Bu kimlik bilgileri TÜM Drive bağlantıları (bkz. models/
 * DriveConnection.js) için ORTAKTIR — Google Cloud'daki tek bir "OAuth
 * app" ile birden fazla Google hesabı bağlanabilir, bu yüzden ayrı bir
 * kayıt (DriveConnection'ların her birine tekrarlanmıyor).
 *
 * clientSecret ŞİFRELİ saklanır (aynı AES-256-GCM mekanizması, bkz.
 * utils/tcCrypto.js).
 */
const googleOAuthCredentialsSchema = new mongoose.Schema(
  {
    clientId: { type: String, trim: true, default: null },
    clientSecretEncrypted: { type: String, default: null },
    redirectUri: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GoogleOAuthCredentials', googleOAuthCredentialsSchema);
