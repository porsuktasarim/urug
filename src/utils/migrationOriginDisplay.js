const { slugify } = require('./slugify');

/**
 * Boş olmayan seviyeleri sırayla döner (ör. ["Selanik", "Kavala", "Sarışaban", "Koçoğlu"]).
 */
function getFromLevels(origin) {
  return [origin.fromEyalet, origin.fromSancak, origin.fromKaza, origin.fromKoy].filter(Boolean);
}

function getToLevels(origin) {
  return [origin.toIl, origin.toIlce, origin.toKasaba, origin.toKoyMahalle].filter(Boolean);
}

/**
 * Kişi kartında gösterilecek KISA etiket: en dar "nereden" seviyesi +
 * en dar "nereye" seviyesi. Ör: "Koçoğlu → Ovacık".
 * Hiçbir seviye girilmemişse null döner.
 */
function getShortLabel(origin) {
  const fromLevels = getFromLevels(origin);
  const toLevels = getToLevels(origin);

  const fromPart = fromLevels[fromLevels.length - 1];
  const toPart = toLevels[toLevels.length - 1];

  if (!fromPart && !toPart) return null;
  if (!fromPart) return toPart;
  if (!toPart) return fromPart;
  return `${fromPart} → ${toPart}`;
}

/**
 * Mübadele sayfasında (bkz. routes/migrationOrigin.routes.js) gösterilecek
 * tam breadcrumb: "Selanik > Kavala > Sarışaban > Koçoğlu" biçiminde.
 */
function getFromFullLabel(origin) {
  return getFromLevels(origin).join(' > ') || 'Bilinmiyor';
}

function getToFullLabel(origin) {
  return getToLevels(origin).join(' > ') || 'Bilinmiyor';
}

/**
 * Tüm seviyeleri birleştirip slug üretir — benzersizlik garantisi
 * çağıran tarafta (routes) sağlanmalı (çakışırsa rastgele ek eklenir).
 */
function buildSlugBase(origin) {
  const allLevels = [...getFromLevels(origin), ...getToLevels(origin)];
  return slugify(allLevels.join(' ')) || 'yer';
}

module.exports = {
  getFromLevels,
  getToLevels,
  getShortLabel,
  getFromFullLabel,
  getToFullLabel,
  buildSlugBase,
};
