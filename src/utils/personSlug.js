const { slugify } = require('./slugify');

/**
 * Aynı ad-soyad'a sahip kişileri gruplamak için normalize edilmiş anahtar.
 * Türkçe karakterler için toLocaleLowerCase('tr-TR') kullanılır çünkü
 * MongoDB'nin varsayılan karşılaştırması Türkçe karakterleri doğru işlemiyor.
 */
function computeNameKey(firstName, lastName) {
  const full = lastName ? `${firstName} ${lastName}` : firstName;
  return full.trim().toLocaleLowerCase('tr-TR');
}

function computeBaseSlug(firstName, lastName) {
  const full = lastName ? `${firstName} ${lastName}` : firstName;
  return slugify(full);
}

function randomShortCode() {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * baseSlug/candidate üretilen bir slug'ın DB'de (bu grup dışında da)
 * başka biri tarafından kullanılıp kullanılmadığını kontrol eder ve
 * gerekirse rastgele ek ekleyerek benzersiz hale getirir.
 */
async function ensureUniqueSlug(PersonModel, candidate, excludePersonId) {
  let finalSlug = candidate;
  // Küçük bir olasılık için birkaç deneme yeterli
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await PersonModel.findOne({
      slug: finalSlug,
      _id: { $ne: excludePersonId },
    });
    if (!clash) return finalSlug;
    finalSlug = `${candidate}-${randomShortCode()}`;
  }
  return `${candidate}-${randomShortCode()}-${randomShortCode()}`;
}

/**
 * Belirli bir nameKey grubundaki TÜM kişilere slug atar/yeniden atar.
 *
 * Kural:
 * - Doğum yılı bilinen kişiler arasında en yaşlısı (en küçük yıl) düz slug alır.
 * - Doğum yılı bilinen diğer kişiler "baseSlug-yıl" alır; aynı yılda birden
 *   fazla kişi varsa (plain slug alan hariç) "baseSlug-yıl-a", "-b" ... eklenir.
 * - Doğum yılı bilinmeyen kişiler her zaman "baseSlug-<rastgele4>" alır
 *   (yaş sıralamasına giremezler, hiçbir zaman düz slug almazlar).
 * - Bir kişinin slug'ı değişirse, eski slug slugAliases'a eklenir (301 için).
 *
 * @param {import('mongoose').Model} PersonModel
 * @param {string} nameKey
 */
async function reassignSlugsForNameGroup(PersonModel, nameKey) {
  if (!nameKey) return;

  const group = await PersonModel.find({ nameKey }).sort({ createdAt: 1 });
  if (group.length === 0) return;

  const baseSlug = computeBaseSlug(group[0].officialFirstName, group[0].officialLastName);

  const withYear = group
    .filter((p) => p.birthYear !== null && p.birthYear !== undefined)
    .sort((a, b) => a.birthYear - b.birthYear || a.createdAt - b.createdAt);

  const withoutYear = group.filter((p) => p.birthYear === null || p.birthYear === undefined);

  const plannedSlugs = new Map(); // personId -> yeni slug

  // En yaşlı -> düz slug
  if (withYear.length > 0) {
    plannedSlugs.set(String(withYear[0]._id), baseSlug);
  }

  // Geri kalan yıl bilinenler -> yıl bazlı, aynı yılda çakışma varsa -a/-b
  const remaining = withYear.slice(1);
  const byYear = {};
  remaining.forEach((p) => {
    byYear[p.birthYear] = byYear[p.birthYear] || [];
    byYear[p.birthYear].push(p);
  });

  Object.keys(byYear).forEach((year) => {
    const people = byYear[year];
    if (people.length === 1) {
      plannedSlugs.set(String(people[0]._id), `${baseSlug}-${year}`);
    } else {
      people.forEach((p, idx) => {
        const suffix = String.fromCharCode(97 + idx); // a, b, c...
        plannedSlugs.set(String(p._id), `${baseSlug}-${year}-${suffix}`);
      });
    }
  });

  // Yıl bilinmeyenler -> her zaman rastgele kod, düz slug'a hiç aday olmaz
  withoutYear.forEach((p) => {
    // Eğer zaten daha önce üretilmiş ve hâlâ makul bir slug'ı varsa (kendi
    // rastgele kodunu taşıyorsa) koru; yoksa yeni üret. Basitlik için burada
    // her zaman mevcut slug'ı koruyoruz (zaten benzersiz), yoksa yeni üretiriz.
    if (p.slug && p.slug.startsWith(`${baseSlug}-`)) {
      plannedSlugs.set(String(p._id), p.slug);
    } else {
      plannedSlugs.set(String(p._id), `${baseSlug}-${randomShortCode()}`);
    }
  });

  // Planlanan slug'ları uygula
  for (const person of group) {
    const desired = plannedSlugs.get(String(person._id));
    if (!desired || desired === person.slug) continue;

    const finalSlug = await ensureUniqueSlug(PersonModel, desired, person._id);

    if (person.slug && person.slug !== finalSlug) {
      person.slugAliases = Array.from(new Set([...(person.slugAliases || []), person.slug]));
    }
    person.slug = finalSlug;
    await person.save();
  }
}

module.exports = { computeNameKey, computeBaseSlug, reassignSlugsForNameGroup };
