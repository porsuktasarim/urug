/**
 * Türkçe karakterleri sadeleştirip URL-uyumlu slug üretir.
 * FamilyGroup.slug için varsayılan değer üretiminde kullanılır.
 * Kullanıcı isterse ürettiği slug'ı sonradan elle değiştirebilir.
 */
const TR_CHAR_MAP = {
  ş: 's', Ş: 's',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i',
  İ: 'i',
  ç: 'c', Ç: 'c',
  ö: 'o', Ö: 'o',
  ü: 'u', Ü: 'u',
};

function slugify(text) {
  if (!text) return '';

  const replaced = text
    .split('')
    .map((ch) => TR_CHAR_MAP[ch] || ch)
    .join('');

  return replaced
    .toLocaleLowerCase('en-US') // TR_CHAR_MAP'ten sonra kalan harfler için standart küçültme
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // harf/rakam/boşluk/tire dışını at
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { slugify };
