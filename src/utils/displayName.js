/**
 * ⚠️ ÖNEMLİ TANIM UYARISI — GÖBEK ADI (middleName) resmi bir ikinci ad
 * DEĞİLDİR. Türkiye'de göbek adı, ailesi/çevresi tarafından bilinen ve
 * seslenilen ama RESMİ KAYITLARDA (nüfus cüzdanı vb.) YER ALMAYAN bir
 * addır. Bu yüzden:
 *   - Kişisel lakaptan farklıdır (lakap sonradan da kazanılabilir,
 *     göbek adı doğumda ailece verilir ve genelde tek/sabittir)
 *   - "İkinci resmi ad" DEĞİLDİR — resmiyette hiç görünmez
 * Bu ayrımı bozacak şekilde middleName'i "resmi" bir alanmış gibi
 * ele almayın (ör. TC/nüfus kaydı bağlamlarında kullanmayın).
 *
 * Kişi adını görüntüleme kuralı (bkz. proje dokümanı 4.2/4.3):
 * - Sıra her zaman: Resmi Ad, (varsa) Göbek Adı, Soyad(lar)ı
 * - Göbek adı varsa HTML bağlamında İTALİK gösterilir (bkz. displayNameHtml)
 * - useCombinedLastName = false → "... (KızlıkSoyadı) EvlilikSoyadı"
 * - useCombinedLastName = true  → "... KızlıkSoyadı EvlilikSoyadı"
 * - Kızlık soyadı yoksa ama evlilik soyadı varsa → sadece "... EvlilikSoyadı" (parantez yok)
 * - Ne kızlık ne evlilik soyadı yoksa → soyad bölümü hiç eklenmez
 *
 * officialLastName burada "kızlık/doğuştan soyadı" rolünü üstlenir —
 * ayrı bir maidenLastName alanı yok, slug/nameKey de hep bu alana göre
 * üretildiği için evlilikle değişmez, kimlik kararlılığı korunur.
 */

function buildSurnameSection(person) {
  const hasMaidenLastName = !person.hasNoLastName && !!person.officialLastName;
  const hasMarriedLastName = !!person.marriedLastName;

  if (!hasMaidenLastName && !hasMarriedLastName) return '';
  if (!hasMarriedLastName) return person.officialLastName;
  if (!hasMaidenLastName) return person.marriedLastName; // parantez gereksiz

  return person.useCombinedLastName
    ? `${person.officialLastName} ${person.marriedLastName}`
    : `(${person.officialLastName}) ${person.marriedLastName}`;
}

/**
 * Düz metin ad gösterimi — HTML işaretleme İÇERMEZ. <title>, JS
 * textContent, alt metin gibi HTML render edilmeyen bağlamlarda kullanılır.
 */
function displayName(person) {
  if (!person) return '';

  const parts = [person.officialFirstName];
  if (person.middleName) parts.push(person.middleName);

  const surnameSection = buildSurnameSection(person);
  if (surnameSection) parts.push(surnameSection);

  return parts.join(' ');
}

/**
 * HTML gösterimi — göbek adı varsa <em> ile italik sarılır. SADECE EJS'te
 * unescaped çıktı (`<%- %>`) ile, gerçek HTML render edilen bir bağlamda
 * kullanılmalı (ör. kişi kartı başlığı) — <title> etiketi veya JS
 * textContent gibi yerlerde KULLANILMAMALI (etiketler düz metin olarak görünür).
 */
function displayNameHtml(person) {
  if (!person) return '';

  const parts = [escapeHtml(person.officialFirstName)];
  if (person.middleName) parts.push(`<em>${escapeHtml(person.middleName)}</em>`);

  const surnameSection = buildSurnameSection(person);
  if (surnameSection) parts.push(escapeHtml(surnameSection));

  return parts.join(' ');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { displayName, displayNameHtml };
