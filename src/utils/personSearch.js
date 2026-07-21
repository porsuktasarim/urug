/**
 * Arama endpoint'i (/kisiler/api/ara) için kullanılan geniş kapsamlı anahtar.
 * nameKey'den farklıdır: nameKey sadece doğum adına (slug gruplama için)
 * dayanır ve evlilikle değişmez; searchKey ise evlilik soyadı ve lakapları
 * da kapsar, böylece "Güler" (evlilik soyadı) ile arayınca da bulunabilir.
 *
 * Türkçe karakterler için toLocaleLowerCase('tr-TR') kullanılır (bkz. proje notları).
 */
function computeSearchKey(person) {
  const parts = [
    person.officialFirstName,
    !person.hasNoLastName ? person.officialLastName : null,
    person.marriedLastName,
    ...((person.nicknames || []).map((n) => n.value)),
  ].filter(Boolean);

  return parts.join(' ').trim().toLocaleLowerCase('tr-TR');
}

module.exports = { computeSearchKey };
