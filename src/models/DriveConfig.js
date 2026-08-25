const mongoose = require('mongoose');

/**
 * DriveConfig — sistemde TEK bir kayıt olacak şekilde kullanılır (bkz.
 * routes/driveSettings.routes.js, her zaman findOne() ile çekilir).
 * Google Drive OAuth bağlantısının durumunu ve refresh token'ını saklar.
 *
 * refreshToken ŞİFRELİ saklanır (bkz. utils/tcCrypto.js — aynı AES-256-GCM
 * mekanizması TC şifreleme için de kullanılıyor, burada da tekrar kullanıyoruz).
 */
const driveConfigSchema = new mongoose.Schema(
  {
    connected: { type: Boolean, default: false },
    connectedByUsername: { type: String, default: null }, // hangi kullanıcı bağladı (bilgi amaçlı)
    refreshTokenEncrypted: { type: String, default: null },
    driveAccountEmail: { type: String, default: null }, // bağlı Google hesabının e-postası (bilgi amaçlı)
    uploadsFolderId: { type: String, default: null }, // Drive'da oluşturulan "Uruğ Yüklemeleri" klasörünün id'si

    // Bağlı olmak, kullanılıyor olmak anlamına gelmez — kullanıcı sadece
    // "ileride lazım olur" diye bağlayıp ikisini de kapalı bırakabilir,
    // ya da sadece birini açabilir. Her ikisi de bağımsız birer anahtar.
    useForImages: { type: Boolean, default: false }, // yeni fotoğraf yüklemeleri Drive'a mı gitsin
    useForBackups: { type: Boolean, default: false }, // yedekleme sistemi Drive'ı hedef olarak kullansın mı (bkz. gelecek "yedekleme" adımı)
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriveConfig', driveConfigSchema);
