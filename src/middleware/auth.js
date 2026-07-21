/**
 * requireLogin: oturum açmamış kullanıcıyı /giris'e yönlendirir.
 * Görüntüleme (GET) route'ları genelde herkese açık kalıyor (aile ağacı
 * paylaşılabilir olsun diye); bu middleware sadece değişiklik yapan
 * (POST/create/edit/delete) route'lara uygulanıyor.
 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect(`/giris?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

/**
 * requireGlobalAdmin: sadece globalAdmin rolündeki kullanıcılar geçebilir.
 * Kişi özellikleri (AttributeDefinition) yönetimi gibi sistem geneli
 * ayarlar için kullanılıyor.
 */
function requireGlobalAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect(`/giris?next=${encodeURIComponent(req.originalUrl)}`);
  }
  if (!req.session.isGlobalAdmin) {
    return res.status(403).send('Bu işlem için global admin yetkisi gerekiyor.');
  }
  next();
}

module.exports = { requireLogin, requireGlobalAdmin };
