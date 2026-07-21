/**
 * Kişi adını görüntüleme kuralı (bkz. proje dokümanı 4.2/4.3):
 * - useCombinedLastName = false → "Ad (KızlıkSoyadı) EvlilikSoyadı"
 * - useCombinedLastName = true  → "Ad KızlıkSoyadı EvlilikSoyadı"
 * - Soyadı yoksa (hasNoLastName) ilgili bölüm hiç render edilmez.
 * - Evlilik soyadı yoksa (henüz evlenmemiş/erkek/otomatik atanmamış)
 *   sadece "Ad Soyad" gösterilir.
 *
 * officialLastName burada "kızlık/doğuştan soyadı" rolünü üstlenir —
 * ayrı bir maidenLastName alanı yok, slug/nameKey de hep bu alana göre
 * üretildiği için evlilikle değişmez, kimlik kararlılığı korunur.
 */
function displayName(person) {
  if (!person) return '';

  if (person.hasNoLastName || !person.officialLastName) {
    return person.officialFirstName;
  }

  if (!person.marriedLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }

  if (person.useCombinedLastName) {
    return `${person.officialFirstName} ${person.officialLastName} ${person.marriedLastName}`;
  }

  return `${person.officialFirstName} (${person.officialLastName}) ${person.marriedLastName}`;
}

module.exports = { displayName };
