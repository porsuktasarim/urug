const FamilyGroup = require('../models/FamilyGroup');

/**
 * HSL -> HEX dönüşümü, estetik açıdan tutarlı (ne çok soluk ne çok koyu)
 * rastgele renkler üretmek için kullanılıyor.
 */
function hslToHex(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Rastgele ama okunabilir/estetik bir renk üretir (orta doygunluk/parlaklık
 * aralığında) — çok soluk pastel ya da çok koyu/siyaha yakın renklerden kaçınır.
 */
function randomAestheticHexColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 55 + Math.floor(Math.random() * 15); // 55-70%
  const lightness = 45 + Math.floor(Math.random() * 10); // 45-55%
  return hslToHex(hue, saturation, lightness);
}

/**
 * Bir FamilyGroup'un rengini döner. Elle seçilmişse (colorCode dolu) onu
 * kullanır. Boşsa, mevcut tüm renklerle çakışmayan rastgele bir renk
 * üretip KALICI olarak kaydeder (bir daha çağrıldığında aynı rengi döner —
 * ör. "Şekerci" gibi sadece evlilik yoluyla değinilen, admin tarafından
 * hiç renk seçilmemiş bir aile için).
 *
 * @param {import('mongoose').Document} familyGroup - FamilyGroup dokümanı
 * @returns {Promise<string>} hex renk kodu
 */
async function getOrAssignFamilyColor(familyGroup) {
  if (!familyGroup) return '#94a3b8'; // aile hiç yoksa (ailesiz kişi) nötr gri

  if (familyGroup.colorCode) return familyGroup.colorCode;

  const existingColors = await FamilyGroup.distinct('colorCode');
  const existingSet = new Set(existingColors.filter(Boolean));

  let color;
  let attempts = 0;
  do {
    color = randomAestheticHexColor();
    attempts += 1;
  } while (existingSet.has(color) && attempts < 20);

  familyGroup.colorCode = color;
  await familyGroup.save();
  return color;
}

module.exports = { getOrAssignFamilyColor, randomAestheticHexColor, hslToHex };
