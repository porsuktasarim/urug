const Person = require('../models/Person');
const FamilyGroup = require('../models/FamilyGroup');
const { computeEffectiveSurname, computeNameKey, reassignSlugsForNameGroup } = require('../utils/personSlug');
const { computeSearchKey } = require('../utils/personSearch');

/**
 * Uygulama her açıldığında çalışır (idempotent — zaten doğruysa dokunmaz).
 *
 * Şu ihtiyacı karşılar: searchKey alanı ve soyad-yok fallback zinciri
 * (computeEffectiveSurname) sonradan eklendi. Bu değişikliklerden ÖNCE
 * oluşturulmuş kişilerde:
 *   - searchKey hiç yok → arama onları hiç bulamıyor
 *   - nameKey eski mantıkla (fallback'siz) üretilmiş → slug'ları
 *     evlilik soyadı/aile adı fallback'ini yansıtmıyor
 *
 * Bu script tüm kişileri tarar, searchKey/nameKey'i güncel mantıkla
 * yeniden hesaplar, değişenleri kaydeder, etkilenen ad-soyad gruplarının
 * slug'larını yeniden atar.
 *
 * NOT: Kişi sayısı çok büyürse (binlerce) her açılışta tüm koleksiyonu
 * taramak yavaşlayabilir — o noktada bunun yerine bir kerelik,
 * "migrationVersion" bayraklı bir sisteme geçilmeli. Şu an için (küçük/orta
 * ölçekli aile şeceresi) idempotent tarama yeterli ve daha basit.
 */
async function migratePersonSearchAndSlugKeys() {
  const persons = await Person.find({});
  if (persons.length === 0) return;

  const affectedNameKeys = new Set();
  let updatedCount = 0;

  for (const person of persons) {
    const effectiveSurname = await computeEffectiveSurname(person, FamilyGroup);
    const newNameKey = computeNameKey(person.officialFirstName, effectiveSurname);
    const newSearchKey = computeSearchKey(person);

    let changed = false;

    if (person.nameKey !== newNameKey) {
      affectedNameKeys.add(person.nameKey); // eski grup da yeniden hesaplanmalı (biri eksildi)
      person.nameKey = newNameKey;
      changed = true;
    }
    if (person.searchKey !== newSearchKey) {
      person.searchKey = newSearchKey;
      changed = true;
    }

    affectedNameKeys.add(newNameKey);

    if (changed) {
      await person.save();
      updatedCount += 1;
    }
  }

  for (const nameKey of affectedNameKeys) {
    await reassignSlugsForNameGroup(Person, nameKey);
  }

  if (updatedCount > 0) {
    console.log(`[migrate] ${updatedCount} kişinin searchKey/nameKey'i güncellendi, ${affectedNameKeys.size} grup için slug yeniden hesaplandı.`);
  }
}

module.exports = { migratePersonSearchAndSlugKeys };
