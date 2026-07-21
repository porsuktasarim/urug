const { slugify } = require('./slugify');

/**
 * Bir kişinin "soyadı yerine geçecek" ayırt edici parçasını belirler.
 * Öncelik sırası (bkz. proje notları):
 *   1) Kızlık/doğuştan soyadı (officialLastName, hasNoLastName değilse)
 *   2) Evlilik soyadı (marriedLastName)
 *   3) Aile adı (familyGroupId üzerinden, sadece yukarıdakiler yoksa DB'den çekilir)
 *   4) Hiçbiri yoksa null döner — çağıran taraf bu durumda doğum yılını
 *      (varsa) ya da rastgele kodu tek ayırt edici olarak kullanır.
 *
 * @param {object} person - officialLastName, hasNoLastName, marriedLastName, familyGroupId alanlarını içeren obje
 * @param {import('mongoose').Model} FamilyGroupModel
 */
async function computeEffectiveSurname(person, FamilyGroupModel) {
  if (!person.hasNoLastName && person.officialLastName) {
    return person.officialLastName;
  }
  if (person.marriedLastName) {
    return person.marriedLastName;
  }
  if (person.familyGroupId) {
    const familyGroup = await FamilyGroupModel.findById(person.familyGroupId);
    if (familyGroup) return familyGroup.name;
  }
  return null;
}

/**
 * Aynı ad-soyad'a sahip kişileri gruplamak için normalize edilmiş anahtar.
 * effectiveSurname null ise (hiçbir ayırt edici soyad/aile yoksa) sadece
 * ad kullanılır — bu durumda nameKey'de boşluk OLMAZ, reassignSlugsForNameGroup
 * bunu "soyadsız grup" olarak tanıyıp farklı bir kural uygular (bkz. aşağı).
 */
function computeNameKey(firstName, effectiveSurname) {
  const full = effectiveSurname ? `${firstName} ${effectiveSurname}` : firstName;
  return full.trim().toLocaleLowerCase('tr-TR');
}

function computeBaseSlug(firstName, effectiveSurname) {
  const full = effectiveSurname ? `${firstName} ${effectiveSurname}` : firstName;
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
 * İKİ FARKLI DURUM var:
 *
 * A) nameKey'de bir "soyad benzeri" parça VARSA (boşluk içeriyorsa —
 *    kızlık/evlilik soyadı ya da aile adından geliyor):
 *    - Doğum yılı bilinen en yaşlı kişi düz slug alır (ör. "sevda-turker").
 *    - Diğer yıl bilinenler "baseSlug-yıl" alır, aynı yılda çakışma -a/-b.
 *    - Yıl bilinmeyenler her zaman "baseSlug-<rastgele4>" alır.
 *
 * B) nameKey sadece ad'dan oluşuyorsa (soyad/evlilik soyadı/aile hiçbiri
 *    yoksa — boşluk yok): kimse düz slug ALMAZ, herkese mutlaka bir ek
 *    eklenir — yıl biliniyorsa "sevda-1923", bilinmiyorsa "sevda-<rastgele4>".
 *    Bu, hem okunabilirlik hem de çakışma riskini azaltmak için.
 *
 * Bir kişinin slug'ı değişirse, eski slug slugAliases'a eklenir (301 için).
 *
 * @param {import('mongoose').Model} PersonModel
 * @param {string} nameKey
 */
async function reassignSlugsForNameGroup(PersonModel, nameKey) {
  if (!nameKey) return;

  const group = await PersonModel.find({ nameKey }).sort({ createdAt: 1 });
  if (group.length === 0) return;

  const hasSurnameLikePart = nameKey.includes(' ');
  const baseSlug = slugify(nameKey); // nameKey zaten normalize edilmiş "ad [soyad]" biçiminde

  const plannedSlugs = new Map(); // personId -> yeni slug

  if (hasSurnameLikePart) {
    const withYear = group
      .filter((p) => p.birthYear !== null && p.birthYear !== undefined)
      .sort((a, b) => a.birthYear - b.birthYear || a.createdAt - b.createdAt);
    const withoutYear = group.filter((p) => p.birthYear === null || p.birthYear === undefined);

    if (withYear.length > 0) {
      plannedSlugs.set(String(withYear[0]._id), baseSlug);
    }

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
          const suffix = String.fromCharCode(97 + idx);
          plannedSlugs.set(String(p._id), `${baseSlug}-${year}-${suffix}`);
        });
      }
    });

    withoutYear.forEach((p) => {
      if (p.slug && p.slug.startsWith(`${baseSlug}-`)) {
        plannedSlugs.set(String(p._id), p.slug);
      } else {
        plannedSlugs.set(String(p._id), `${baseSlug}-${randomShortCode()}`);
      }
    });
  } else {
    // B durumu: soyad benzeri hiçbir parça yok — kimse düz slug almaz.
    const byYear = {};
    const withoutYear = [];

    group.forEach((p) => {
      if (p.birthYear !== null && p.birthYear !== undefined) {
        byYear[p.birthYear] = byYear[p.birthYear] || [];
        byYear[p.birthYear].push(p);
      } else {
        withoutYear.push(p);
      }
    });

    Object.keys(byYear).forEach((year) => {
      const people = byYear[year];
      if (people.length === 1) {
        plannedSlugs.set(String(people[0]._id), `${baseSlug}-${year}`);
      } else {
        people.forEach((p, idx) => {
          const suffix = String.fromCharCode(97 + idx);
          plannedSlugs.set(String(p._id), `${baseSlug}-${year}-${suffix}`);
        });
      }
    });

    withoutYear.forEach((p) => {
      if (p.slug && p.slug.startsWith(`${baseSlug}-`)) {
        plannedSlugs.set(String(p._id), p.slug);
      } else {
        plannedSlugs.set(String(p._id), `${baseSlug}-${randomShortCode()}`);
      }
    });
  }

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

module.exports = {
  computeEffectiveSurname,
  computeNameKey,
  computeBaseSlug,
  reassignSlugsForNameGroup,
};
