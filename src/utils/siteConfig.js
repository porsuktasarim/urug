const SiteConfig = require('../models/SiteConfig');

/**
 * Site ayarlarını döner — hiç kayıt yoksa şemadaki varsayılanları
 * (siteName: 'Uruğ') taşıyan sahte bir obje döner, DB'ye yazmaz.
 * Her yerde (klasör adlandırma, temada vb.) bu fonksiyon kullanılmalı.
 */
async function getSiteConfig() {
  const config = await SiteConfig.findOne();
  if (config) return config;
  return { siteName: 'Uruğ', tagline: null };
}

module.exports = { getSiteConfig };
