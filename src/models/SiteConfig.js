const mongoose = require('mongoose');

/**
 * SiteConfig — sistemde TEK bir kayıt olacak şekilde kullanılır (her zaman
 * findOne() ile çekilir, yoksa varsayılan değerlerle davranılır).
 * Site adı hem görsel temada (gelecek adım) hem de bazı işlevsel yerlerde
 * (ör. Google Drive yükleme klasörü adı: "<siteName> Yüklemeleri") kullanılır.
 */
const siteConfigSchema = new mongoose.Schema(
  {
    siteName: { type: String, trim: true, default: 'Uruğ' },
    tagline: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
