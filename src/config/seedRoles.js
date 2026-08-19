const Role = require('../models/Role');

/**
 * Uygulama her açıldığında çalışır (idempotent — sadece eksik olanları
 * oluşturur, var olanların İZİNLERİNE dokunmaz çünkü admin bunları
 * panelden değiştirmiş olabilir).
 */
async function ensureSystemRoles() {
  const systemRoles = [
    {
      name: 'Süper Admin',
      scopeType: 'global',
      isSystemRole: true,
      permissions: {
        canCreatePeople: true,
        canEditPeople: true,
        canDeletePeople: true,
        canManageRelationships: true,
        canEditFamily: true,
        canViewTc: true,
      },
    },
    {
      name: 'Aile Admini',
      scopeType: 'family',
      isSystemRole: true,
      permissions: {
        canCreatePeople: true,
        canEditPeople: true,
        canDeletePeople: true,
        canManageRelationships: true,
        canEditFamily: true,
        canViewTc: false,
      },
    },
    {
      name: 'Üye',
      scopeType: 'personSubtree',
      isSystemRole: true,
      permissions: {
        canCreatePeople: true, // sadece akrabalık akışı üzerinden, kendi kapsamında
        canEditPeople: true,
        canDeletePeople: false,
        canManageRelationships: true,
        canEditFamily: false,
        canViewTc: false,
      },
    },
  ];

  for (const roleDef of systemRoles) {
    const exists = await Role.findOne({ name: roleDef.name });
    if (!exists) {
      await Role.create(roleDef);
      console.log(`[seed] Sistem rolü oluşturuldu: ${roleDef.name}`);
    }
  }
}

module.exports = { ensureSystemRoles };
