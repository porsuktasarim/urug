/**
 * Kişi adını görüntüleme kuralı (bkz. proje dokümanı 4.2/4.3):
 * - useCombinedLastName = false → "Ad (KızlıkSoyadı) EvlilikSoyadı"
 * - useCombinedLastName = true  → "Ad KızlıkSoyadı EvlilikSoyadı"
 * - Kızlık soyadı yoksa ama evlilik soyadı varsa (örn. evlenmeden önce
 *   soyadı hiç olmayan biri) → sadece "Ad EvlilikSoyadı" (parantez yok,
 *   çünkü gösterilecek bir kızlık soyadı yok)
 * - Ne kızlık ne evlilik soyadı yoksa → sadece "Ad"
 * - Evlenmemiş/soyadı olan biri için (evlilik soyadı yok) → "Ad Soyad"
 *
 * officialLastName burada "kızlık/doğuştan soyadı" rolünü üstlenir —
 * ayrı bir maidenLastName alanı yok, slug/nameKey de hep bu alana göre
 * üretildiği için evlilikle değişmez, kimlik kararlılığı korunur.
 */
function displayName(person) {
  if (!person) return '';

  const hasMaidenLastName = !person.hasNoLastName && !!person.officialLastName;
  const hasMarriedLastName = !!person.marriedLastName;

  if (!hasMaidenLastName && !hasMarriedLastName) {
    return person.officialFirstName;
  }

  if (!hasMarriedLastName) {
    return `${person.officialFirstName} ${person.officialLastName}`;
  }

  if (!hasMaidenLastName) {
    // Kızlık soyadı yok (hiç olmamış), sadece evlilik soyadı var — parantez gereksiz
    return `${person.officialFirstName} ${person.marriedLastName}`;
  }

  if (person.useCombinedLastName) {
    return `${person.officialFirstName} ${person.officialLastName} ${person.marriedLastName}`;
  }

  return `${person.officialFirstName} (${person.officialLastName}) ${person.marriedLastName}`;
}

module.exports = { displayName };
