const Membership = require('../models/Membership');
const Role = require('../models/Role');

const LEGACY_ROLE_NAME_MAP = {
  globalAdmin: 'Süper Admin',
  familyAdmin: 'Aile Admini',
  member: 'Üye',
};

/**
 * Uygulama her açıldığında çalışır (idempotent). roleId'si boş ama eski
 * `role` string alanı dolu olan Membership kayıtlarını, karşılık gelen
 * yeni Role dokümanına bağlar.
 */
async function migrateMembershipRoles() {
  const legacyMemberships = await Membership.find({
    roleId: null,
    role: { $ne: null },
  });

  if (legacyMemberships.length === 0) return;

  let migratedCount = 0;

  for (const membership of legacyMemberships) {
    const roleName = LEGACY_ROLE_NAME_MAP[membership.role];
    if (!roleName) continue;

    const role = await Role.findOne({ name: roleName });
    if (!role) continue; // seedRoles henüz çalışmadıysa (sıralama app.js'te garanti ediliyor)

    membership.roleId = role._id;
    await membership.save();
    migratedCount += 1;
  }

  if (migratedCount > 0) {
    console.log(`[migrate] ${migratedCount} Membership kaydı eski role'den yeni roleId'ye taşındı.`);
  }
}

module.exports = { migrateMembershipRoles };
