/**
 * Bir kişinin profil URL'ini üretir.
 * - Aile bağlantısı varsa: /aile-slug/kisi-slug
 * - Aile bağlantısı yoksa (dışarıdan gelen kişi): /kisi/kisi-slug
 * Slug hiç yoksa (henüz atanmamışsa) null döner, çağıran taraf linksiz
 * göstermeli.
 */
function personProfileUrl(person) {
  if (!person || !person.slug) return null;

  if (person.familyGroupId && person.familyGroupId.slug) {
    return `/${person.familyGroupId.slug}/${person.slug}`;
  }

  return `/kisi/${person.slug}`;
}

module.exports = { personProfileUrl };
