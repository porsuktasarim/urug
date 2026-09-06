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
 * Bir kişinin kardeşlerini bulur — İKİ kaynaktan birleştirilir:
 *   1) Ortak ebeveyn üzerinden hesaplanan (aynı babaya VEYA aynı anneye
 *      bağlı) kardeşler. Ebeveyn bilinmiyorsa bu kaynak boş kalır.
 *   2) Ebeveyn bilinmese de doğrudan "kardeş" olarak işaretlenmiş
 *      SiblingLink kayıtları (bkz. models/SiblingLink.js).
 * İki kaynaktan gelen sonuçlar tekrarsız (aynı kişi iki kez görünmez)
 * birleştirilir.
 */
async function getSiblings(ParentChildModel, personId, fatherId, motherId, SiblingLinkModel) {
  const seen = new Set();
  const siblings = [];

  const parentIds = [fatherId, motherId].filter(Boolean);
  if (parentIds.length > 0) {
    const links = await ParentChildModel.find({
      parentId: { $in: parentIds },
      childId: { $ne: personId },
    }).populate({ path: 'childId', populate: { path: 'familyGroupId' } });

    links.forEach((link) => {
      const id = String(link.childId._id);
      if (!seen.has(id)) {
        seen.add(id);
        siblings.push(link.childId);
      }
    });
  }

  if (SiblingLinkModel) {
    const directLinks = await SiblingLinkModel.find({
      $or: [{ personAId: personId }, { personBId: personId }],
    }).populate([
      { path: 'personAId', populate: { path: 'familyGroupId' } },
      { path: 'personBId', populate: { path: 'familyGroupId' } },
    ]);

    directLinks.forEach((link) => {
      const other = String(link.personAId._id) === String(personId) ? link.personBId : link.personAId;
      const id = String(other._id);
      if (!seen.has(id)) {
        seen.add(id);
        siblings.push(other);
      }
    });
  }

  return siblings;
}

module.exports = { sortByBirthYear, childRelationLabel, getSiblings };
