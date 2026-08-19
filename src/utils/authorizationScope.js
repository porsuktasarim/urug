const Membership = require('../models/Membership');
const Person = require('../models/Person');
const ParentChild = require('../models/ParentChild');

/**
 * Bir kişinin TÜM altsoyunun (çocuk, torun, ...) id'lerini bulur —
 * kendisi dahil. "personSubtree" kapsamlı rollerin ("Üye" gibi) düzenleme
 * alanını ("kendisi ve altsoyu") hesaplamak için kullanılır.
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
 * Bir kullanıcının tüm Membership kayıtlarını, ilgili Role'leri populate
 * ederek döner. roleId'si boş olanlar (henüz migrate edilmemiş/bozuk
 * kayıtlar) güvenlik gereği yok sayılır.
 */
async function getPopulatedMemberships(userId) {
  const memberships = await Membership.find({ userId }).populate('roleId');
  return memberships.filter((m) => m.roleId); // roleId'si olmayan (geçersiz) kayıtları ele
}

/**
 * Kişi bazlı bir izin kontrolü (canEditPeople, canDeletePeople,
 * canManageRelationships gibi) — kullanıcının rollerinden HERHANGİ biri,
 * ilgili izne VE kapsam koşuluna (scopeType'a göre) uyuyorsa true döner.
 *
 * @param {string} userId
 * @param {string} personId
 * @param {'canCreatePeople'|'canEditPeople'|'canDeletePeople'|'canManageRelationships'|'canEditFamily'|'canViewTc'} permissionKey
 */
async function hasPersonPermission(userId, personId, permissionKey) {
  if (!userId || !personId) return false;

  const memberships = await getPopulatedMemberships(userId);
  if (memberships.length === 0) return false;

  // Global kapsamlı ve izni olan bir rol varsa kapsam kontrolüne hiç gerek yok.
  const hasGlobalPermission = memberships.some(
    (m) => m.roleId.scopeType === 'global' && m.roleId.permissions[permissionKey]
  );
  if (hasGlobalPermission) return true;

  const person = await Person.findById(personId);
  if (!person) return false;

  // family kapsamlı roller
  const familyScoped = memberships.filter(
    (m) => m.roleId.scopeType === 'family' && m.roleId.permissions[permissionKey]
  );
  if (
    familyScoped.length > 0 &&
    person.familyGroupId &&
    familyScoped.some((m) => String(m.familyGroupId) === String(person.familyGroupId))
  ) {
    return true;
  }

  // personSubtree kapsamlı roller
  const subtreeScoped = memberships.filter(
    (m) => m.roleId.scopeType === 'personSubtree' && m.roleId.permissions[permissionKey] && m.scopePersonId
  );
  for (const m of subtreeScoped) {
    const scopeIds = await getDescendantIdsIncludingSelf(m.scopePersonId);
    if (scopeIds.has(String(personId))) return true;
  }

  return false;
}

/**
 * Bir kişiyi düzenleme yetkisi var mı (canEditPeople izni + kapsam).
 */
async function canEditPerson(userId, personId) {
  return hasPersonPermission(userId, personId, 'canEditPeople');
}

/**
 * Bir kişiyi silme yetkisi var mı (canDeletePeople izni + kapsam).
 */
async function canDeletePerson(userId, personId) {
  return hasPersonPermission(userId, personId, 'canDeletePeople');
}

/**
 * Bir kişinin akrabalık bağlarını (ebeveyn/eş/çocuk) yönetme yetkisi var mı.
 */
async function canManageRelationshipsFor(userId, personId) {
  return hasPersonPermission(userId, personId, 'canManageRelationships');
}

/**
 * Bir kullanıcının YENİ, bağımsız bir kişi oluşturma yetkisi olup
 * olmadığını kontrol eder (ör. /kisiler/new formu). scopeType='global'
 * ya da 'family' olan ve canCreatePeople izni olan herhangi bir rolü
 * varsa yeterli — "personSubtree" (Üye) rolü bağımsız oluşturamaz,
 * sadece akrabalık akışı üzerinden (canManageRelationshipsFor) ekleyebilir.
 */
async function canCreateStandalonePerson(userId) {
  if (!userId) return false;
  const memberships = await getPopulatedMemberships(userId);

  return memberships.some(
    (m) =>
      (m.roleId.scopeType === 'global' || m.roleId.scopeType === 'family') &&
      m.roleId.permissions.canCreatePeople
  );
}

/**
 * Bir kullanıcının belirli bir aileyi düzenleme yetkisi var mı
 * (canEditFamily izni + kapsam: global her zaman, family ise sadece o
 * spesifik aile için).
 */
async function canEditFamilyGroup(userId, familyGroupId) {
  if (!userId || !familyGroupId) return false;

  const memberships = await getPopulatedMemberships(userId);
  if (memberships.length === 0) return false;

  const hasGlobalPermission = memberships.some(
    (m) => m.roleId.scopeType === 'global' && m.roleId.permissions.canEditFamily
  );
  if (hasGlobalPermission) return true;

  return memberships.some(
    (m) =>
      m.roleId.scopeType === 'family' &&
      m.roleId.permissions.canEditFamily &&
      String(m.familyGroupId) === String(familyGroupId)
  );
}

/**
 * Yeni bir aile OLUŞTURMA yetkisi var mı — sadece global kapsamlı ve
 * canEditFamily izni olan roller (ör. Süper Admin). Aile admini kendi
 * ailesini düzenleyebilir ama yeni, ilgisiz bir aile oluşturamaz.
 */
async function canCreateFamilyGroup(userId) {
  if (!userId) return false;
  const memberships = await getPopulatedMemberships(userId);

  return memberships.some(
    (m) => m.roleId.scopeType === 'global' && m.roleId.permissions.canEditFamily
  );
}

module.exports = {
  canEditPerson,
  canDeletePerson,
  canManageRelationshipsFor,
  canCreateStandalonePerson,
  canEditFamilyGroup,
  canCreateFamilyGroup,
  getDescendantIdsIncludingSelf,
  hasPersonPermission,
};
