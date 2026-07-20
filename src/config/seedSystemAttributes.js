const AttributeDefinition = require('../models/AttributeDefinition');

/**
 * Uygulama her açıldığında, isSystem=true olması gereken temel alanların
 * (ad, soyad) veritabanında var olduğunu garanti eder. Zaten varsa
 * dokunmaz — sadece eksikse oluşturur.
 *
 * Not: Bu adımda (Adım 3) sadece AttributeDefinition kayıtları
 * garanti ediliyor; Person şeması henüz yok, bu yüzden bu kayıtlar
 * şu an sadece admin ekranında "sistem alanı" olarak görünür.
 */
async function ensureSystemAttributes() {
  const systemDefaults = [
    {
      key: 'officialFirstName',
      label: 'Ad',
      type: 'text',
      isRequired: true,
      isActive: true,
      isSystem: true,
      group: 'Kimlik Bilgileri',
      order: 1,
    },
    {
      key: 'officialLastName',
      label: 'Soyadı',
      type: 'text',
      isRequired: true,
      isActive: true,
      isSystem: true,
      group: 'Kimlik Bilgileri',
      order: 2,
      conditionalRequirement: {
        dependsOn: 'hasNoLastName',
        requiredWhen: false,
      },
    },
  ];

  for (const def of systemDefaults) {
    const exists = await AttributeDefinition.findOne({ key: def.key });
    if (!exists) {
      await AttributeDefinition.create(def);
      console.log(`[seed] Sistem alanı oluşturuldu: ${def.key}`);
    }
  }
}

module.exports = { ensureSystemAttributes };
