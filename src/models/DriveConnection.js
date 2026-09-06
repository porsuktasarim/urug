const mongoose = require('mongoose');

/**
 * DriveConnection — DriveConfig'in yerini alır, ARTIK BİRDEN FAZLA kayıt
 * olabilir (ör. bir hesap görseller için, ayrı bir hesap yedekler için,
 * ya da yedeklilik için birden fazla yedek hedefi).
 *
 * isPrimaryForImages: yeni fotoğraf yüklemeleri HER ZAMAN tek bir bağlantıya
 * gider — bu yüzden bu alan en fazla BİR kayıtta true olabilir (uygulama
 * katmanında garanti edilir, bkz. routes/driveSettings.routes.js).
 *
 * useForBackups: BİRDEN FAZLA kayıtta true olabilir — yedekleme sistemi
 * (gelecek adım) useForBackups=true olan TÜM bağlantılara yedek gönderebilir
 * (yedek çeşitliliği/güvenliği için).
 */
const driveConnectionSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true }, // ör. "Ana Hesap", "Yedek Hesap"
    connected: { type: Boolean, default: true },
    connectedByUsername: { type: String, default: null },
    refreshTokenEncrypted: { type: String, default: null },
    driveAccountEmail: { type: String, default: null },
    uploadsFolderId: { type: String, default: null },
    isPrimaryForImages: { type: Boolean, default: false },
    useForBackups: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriveConnection', driveConnectionSchema);
