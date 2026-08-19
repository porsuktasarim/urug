const { canEditPerson, canCreateStandalonePerson } = require('../utils/authorizationScope');

/**
 * req.params[paramName] içindeki kişi id'sini düzenleme yetkisi var mı
 * kontrol eder. requireLogin'den SONRA kullanılmalı (req.session.userId
 * zaten var olduğunu varsayar).
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
 * Yeni, bağımsız bir kişi oluşturma yetkisi var mı kontrol eder
 * (globalAdmin/familyAdmin — bkz. utils/authorizationScope.js).
 */
async function requireStandaloneCreateAccess(req, res, next) {
  const allowed = await canCreateStandalonePerson(req.session.userId);

  if (!allowed) {
    return res.status(403).send('Yeni kişi oluşturma yetkin yok.');
  }
  next();
}

module.exports = { requirePersonEditAccess, requireStandaloneCreateAccess };
