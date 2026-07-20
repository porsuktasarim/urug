const tr = require('./tr');

/**
 * Aktif dil paketi. Şimdilik sadece "tr" var; ileride başka bir dil
 * eklenmek istenirse buraya yeni bir dosya (örn. en.js) eklenip
 * ACTIVE_LOCALE ortam değişkeniyle seçilebilir hale getirilir.
 * Kod tarafında değişiklik gerekmez.
 */
const locales = { tr };
const activeLocale = process.env.ACTIVE_LOCALE || 'tr';
const dict = locales[activeLocale] || locales.tr;

/**
 * Nokta ile ayrılmış bir anahtar yolunu (örn. "common.actions.save")
 * dil dosyasından çözer. Parametrik metinlerde {alan} gibi yer
 * tutucular params objesiyle değiştirilir.
 *
 * @param {string} key - örn. "system.serverStarted"
 * @param {object} [params] - örn. { port: 3000 }
 * @returns {string}
 */
function t(key, params = {}) {
  const value = key
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);

  if (value === undefined) {
    console.warn(`[lang] Eksik anahtar: "${key}"`);
    return key;
  }

  return value.replace(/\{(\w+)\}/g, (match, paramKey) =>
    Object.prototype.hasOwnProperty.call(params, paramKey) ? params[paramKey] : match
  );
}

module.exports = { t };
