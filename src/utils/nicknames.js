/**
 * Person.nicknames dizisinden kart görünümü için gerekli parçaları çıkarır.
 * bkz. proje dokümanı 4.2 — kart düzeni:
 *   Resmi Ad Soyad  "Kişisel Lakap"
 *          (Sülale Lakabı)
 */

function getPersonalNicknames(person) {
  if (!person || !person.nicknames) return [];
  return person.nicknames.filter((n) => n.type === 'personal').map((n) => n.value);
}

function getFamilyLakab(person) {
  if (!person || !person.nicknames) return null;
  const found = person.nicknames.find((n) => n.type === 'familyLakab');
  return found || null;
}

module.exports = { getPersonalNicknames, getFamilyLakab };
