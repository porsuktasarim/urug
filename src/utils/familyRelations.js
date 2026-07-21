/**
 * Alt soy/kardeş listeleri için ortak yardımcılar (bkz. proje dokümanı 4.6).
 */

// Doğum yılına göre artan sıralama (küçük yaş = büyük/yaşlı önce).
// Yılı bilinmeyenler listenin sonuna düşer.
function sortByBirthYear(persons) {
  return [...persons].sort((a, b) => {
    const ay = a.birthYear;
    const by = b.birthYear;
    if (ay == null && by == null) return 0;
    if (ay == null) return 1;
    if (by == null) return -1;
    return ay - by;
  });
}

// Çocuk listesinde isim yanında gösterilecek "oğlu"/"kızı" etiketi.
// Cinsiyet bilinmiyorsa boş string döner (etiket basılmaz).
function childRelationLabel(child) {
  if (child.gender === 'male') return 'oğlu';
  if (child.gender === 'female') return 'kızı';
  return '';
}

/**
 * Bir kişinin kardeşlerini bulur: aynı babaya VEYA aynı anneye bağlı,
 * kendisi hariç tüm diğer çocuklar (tekrarsız). Baba/anne bilinmiyorsa
 * boş dizi döner (kardeş hesaplanamaz).
 */
async function getSiblings(ParentChildModel, personId, fatherId, motherId) {
  const parentIds = [fatherId, motherId].filter(Boolean);
  if (parentIds.length === 0) return [];

  const links = await ParentChildModel.find({
    parentId: { $in: parentIds },
    childId: { $ne: personId },
  }).populate({ path: 'childId', populate: { path: 'familyGroupId' } });

  const seen = new Set();
  const siblings = [];

  links.forEach((link) => {
    const id = String(link.childId._id);
    if (!seen.has(id)) {
      seen.add(id);
      siblings.push(link.childId);
    }
  });

  return siblings;
}

module.exports = { sortByBirthYear, childRelationLabel, getSiblings };
