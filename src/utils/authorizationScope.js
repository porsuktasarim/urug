const Membership = require('../models/Membership');
const Person = require('../models/Person');
const ParentChild = require('../models/ParentChild');

/**
 * Bir kişinin TÜM altsoyunun (çocuk, torun, ...) id'lerini bulur —
 * kendisi dahil. "member" rolündeki kullanıcıların düzenleme kapsamını
 * ("kendisi ve altsoyu") hesaplamak için kullanılır.
 *
 * $graphLookup yerine iteratif BFS kullanılıyor çünkü ParentChild ayrı
 * bir koleksiyon (Person içinde gömülü değil) — Mongoose'ta bunu basit
 * ve okunabilir tutmak için düz JS döngüsü tercih edildi.
 */
async function getDescendantIdsIncludingSelf(rootPersonId) {
  const result = new Set([String(rootPersonId)]);
  let frontier = [rootPersonId];

  while (frontier.length > 0) {
    const links = await ParentChild.find({ parentId: { $in: frontier } });
    const nextFrontier = [];

    links.forEach((link) => {
      const childId = String(link.childId);
      if (!result.has(childId)) {
        result.add(childId);
        nextFrontier.push(link.childId);
      }
    });

    frontier = nextFrontier;
  }

  return result;
}

/**
 * Bir kullanıcının belirli bir kişiyi düzenleme yetkisi olup olmadığını
 * kontrol eder.
 *
 * Kurallar:
 * - globalAdmin: her zaman true.
 * - familyAdmin: personId'nin familyGroupId'si, membership'teki
 *   familyGroupId ile eşleşiyorsa true.
 * - member: personId, membership'teki scopePersonId'nin kendisi ya da
 *   altsoyundan biriyse true.
 * - Hiçbir membership uyuşmuyorsa false.
 *
 * @param {string} userId
 * @param {string} personId
 * @returns {Promise<boolean>}
 */
async function canEditPerson(userId, personId) {
  if (!userId || !personId) return false;

  const memberships = await Membership.find({ userId });
  if (memberships.length === 0) return false;

  if (memberships.some((m) => m.role === 'globalAdmin')) return true;

  const person = await Person.findById(personId);
  if (!person) return false;

  const familyAdminMemberships = memberships.filter((m) => m.role === 'familyAdmin');
  if (
    familyAdminMemberships.length > 0 &&
    person.familyGroupId &&
    familyAdminMemberships.some((m) => String(m.familyGroupId) === String(person.familyGroupId))
  ) {
    return true;
  }

  const memberMemberships = memberships.filter((m) => m.role === 'member' && m.scopePersonId);
  for (const m of memberMemberships) {
    const scopeIds = await getDescendantIdsIncludingSelf(m.scopePersonId);
    if (scopeIds.has(String(personId))) return true;
  }

  return false;
}

/**
 * Bir kullanıcının YENİ, bağımsız bir kişi oluşturma yetkisi olup
 * olmadığını kontrol eder (ör. /kisiler/new formu — bir "anchor" kişiye
 * bağlı olmayan, en baştan bir kayıt). Bu, globalAdmin ve familyAdmin'e
 * açık; "member" rolü sadece kendi altsoyunu YÖNETEBİLİR, sıfırdan
 * bağımsız kişi oluşturamaz (o akış her zaman bir ilişki üzerinden,
 * dolayısıyla canEditPerson üzerinden kontrol edilir).
 */
async function canCreateStandalonePerson(userId) {
  if (!userId) return false;
  const memberships = await Membership.find({ userId });
  return memberships.some((m) => m.role === 'globalAdmin' || m.role === 'familyAdmin');
}

module.exports = { canEditPerson, canCreateStandalonePerson, getDescendantIdsIncludingSelf };
