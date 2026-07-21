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
      key: 'familyGroupId',
      label: 'Aile',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Kimlik Bilgileri',
      order: 0,
    },
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
    {
      key: 'birthYear',
      label: 'Doğum Tarihi',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Kimlik Bilgileri',
      order: 3,
    },
    {
      key: 'tcNumber',
      label: 'TC Kimlik No',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Kimlik Bilgileri',
      order: 4,
    },
    {
      key: 'nicknames',
      label: 'Lakaplar',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Lakaplar',
      order: 5,
    },
    {
      key: 'marriedLastNameSection',
      label: 'Evlilik Soyadı Bilgisi',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Evlilik Soyadı Bilgisi',
      order: 6,
    },
    {
      key: 'relationships',
      label: 'Akrabalık Bağları',
      type: 'text',
      isRequired: false,
      isActive: true,
      isSystem: true,
      group: 'Akrabalık Bağları',
      order: 100,
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
