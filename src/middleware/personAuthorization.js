const {
  canEditPerson,
  canDeletePerson,
  canManageRelationshipsFor,
  canCreateStandalonePerson,
  canEditFamilyGroup,
  canCreateFamilyGroup,
} = require('../utils/authorizationScope');

/**
 * req.params[paramName] içindeki kişi id'sini DÜZENLEME yetkisi var mı
 * kontrol eder (canEditPeople izni). requireLogin'den SONRA kullanılmalı.
 */
function requirePersonEditAccess(paramName = 'id') {
  return async function (req, res, next) {
    const personId = req.params[paramName];
    const allowed = await canEditPerson(req.session.userId, personId);

    if (!allowed) {
      return res.status(403).send('Bu kişiyi düzenleme yetkin yok.');
    }
    next();
  };
}

/**
 * req.params[paramName] içindeki kişi id'sini SİLME yetkisi var mı
 * kontrol eder (canDeletePeople izni — canEditPeople'dan AYRI, bazı
 * roller düzenleyebilir ama silemeyebilir, ör. varsayılan "Üye" rolü).
 */
function requirePersonDeleteAccess(paramName = 'id') {
  return async function (req, res, next) {
    const personId = req.params[paramName];
    const allowed = await canDeletePerson(req.session.userId, personId);

    if (!allowed) {
      return res.status(403).send('Bu kişiyi silme yetkin yok.');
    }
    next();
  };
}

/**
 * req.params[paramName] içindeki (anchor) kişinin akrabalık bağlarını
 * (ebeveyn/eş/çocuk ekleme-kaldırma) yönetme yetkisi var mı kontrol eder.
 */
function requireRelationshipManageAccess(paramName = 'id') {
  return async function (req, res, next) {
    const personId = req.params[paramName];
    const allowed = await canManageRelationshipsFor(req.session.userId, personId);

    if (!allowed) {
      return res.status(403).send('Bu kişinin akrabalık bağlarını yönetme yetkin yok.');
    }
    next();
  };
}

/**
 * Yeni, bağımsız bir kişi oluşturma yetkisi var mı kontrol eder.
 */
async function requireStandaloneCreateAccess(req, res, next) {
  const allowed = await canCreateStandalonePerson(req.session.userId);

  if (!allowed) {
    return res.status(403).send('Yeni kişi oluşturma yetkin yok.');
  }
  next();
}

/**
 * req.params[paramName] içindeki AİLE id'sini düzenleme yetkisi var mı
 * kontrol eder (canEditFamily izni + kapsam).
 */
function requireFamilyEditAccess(paramName = 'id') {
  return async function (req, res, next) {
    const familyGroupId = req.params[paramName];
    const allowed = await canEditFamilyGroup(req.session.userId, familyGroupId);

    if (!allowed) {
      return res.status(403).send('Bu aileyi düzenleme yetkin yok.');
    }
    next();
  };
}

/**
 * Yeni bir aile oluşturma yetkisi var mı kontrol eder.
 */
async function requireFamilyCreateAccess(req, res, next) {
  const allowed = await canCreateFamilyGroup(req.session.userId);

  if (!allowed) {
    return res.status(403).send('Yeni aile oluşturma yetkin yok.');
  }
  next();
}

module.exports = {
  requirePersonEditAccess,
  requirePersonDeleteAccess,
  requireRelationshipManageAccess,
  requireStandaloneCreateAccess,
  requireFamilyEditAccess,
  requireFamilyCreateAccess,
};
