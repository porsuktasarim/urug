const mongoose = require('mongoose');

/**
 * Person — Adım 9-11 ile genişletildi: gender (evlilik soyadı otomasyonu
 * için gerekli), marriedLastName, useCombinedLastName, nicknames (lakap
 * sistemi), TC şifreleme alanları.
 */
const nicknameSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    type: { type: String, enum: ['personal', 'familyLakab'], required: true },
    inheritedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null },
    note: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const personSchema = new mongoose.Schema(
  {
    familyGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyGroup',
      required: [true, 'Kişi bir aileye bağlı olmalıdır.'],
    },
    officialFirstName: {
      type: String,
      required: [true, 'Ad zorunludur.'],
      trim: true,
    },
    officialLastName: {
      type: String,
      trim: true,
      default: null,
      // Koşullu zorunluluk (hasNoLastName=false ise zorunlu) route katmanında kontrol edilir,
      // çünkü Mongoose'un kendi "required" fonksiyonu burada yeterince açık hata veremiyor.
      // Bu alan aynı zamanda "kızlık/doğuştan soyadı" rolünü üstlenir — evlilikle değişmez,
      // slug/nameKey hep buna göre üretilir (bkz. utils/displayName.js).
    },
    hasNoLastName: {
      type: Boolean,
      default: false,
    },
    birthYear: {
      type: Number,
      default: null,
      // Slug üretiminde "en yaşlı" belirlemek için kullanılır (bkz. utils/personSlug.js)
    },

    // Evlilik (Union) kurulduğunda otomatik doldurulur (kadın tarafı için,
    // bkz. relationships.routes.js), ama elle de düzenlenebilir.
    gender: {
      type: String,
      enum: ['female', 'male', null],
      default: null,
      // Otomatik evlilik-soyadı ataması için gerekli; başka hiçbir mantıkta kullanılmaz.
    },
    marriedLastName: {
      type: String,
      trim: true,
      default: null,
    },
    useCombinedLastName: {
      type: Boolean,
      default: false,
    },

    nicknames: [nicknameSchema],

    // Aynı ad-soyad'a sahip kişileri gruplamak için normalize edilmiş anahtar.
    // Türkçe karakterler için toLocaleLowerCase('tr-TR') kullanılır — MongoDB'nin
    // $regex/varsayılan sıralaması Türkçe karakterleri doğru işlemiyor (bkz. proje notları).
    nameKey: {
      type: String,
      index: true,
    },

    // Görünür/paylaşılabilir link için slug. Aynı ad-soyad grubunda en yaşlı
    // kişi düz slug alır, diğerleri yıl eklenmiş slug alır (bkz. utils/personSlug.js).
    slug: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Slug değiştiğinde eski slug buraya taşınır, eski linkler 301 ile yönlendirilir.
    slugAliases: [{ type: String }],

    // TC kimlik no — AES-256-GCM ile şifrelenmiş asıl değer + arama/uniqluk
    // için HMAC-SHA256 hash. Düz metin hiçbir yerde saklanmaz (bkz. utils/tcCrypto.js).
    // NOT: Bu adımda henüz gerçek bir kullanıcı/rol sistemi (auth) yok, bu yüzden
    // "sadece admin görsün" kuralı arayüz seviyesinde uygulanıyor ama route
    // seviyesinde zorlanmıyor — Yetki Modeli adımı tamamlanınca sıkılaştırılacak.
    // NOT: default:null KASITLI OLARAK yazılmıyor. Mongoose'da default:null
    // verilirse alan her kayıtta "null" değeriyle açıkça set edilir, bu da
    // sparse unique index'i bozar (sparse sadece alan HİÇ YOKSA/undefined
    // ise atlar, null değeri "var" sayılır) — TC girilmemiş 2. kişide bile
    // "tcHash: null" çakışması/duplicate key hatası oluşturur. default
    // verilmezse alan hiç dokunulmadığında tamamen yok (undefined) kalır.
    tcEncrypted: { type: String },
    tcHash: { type: String, unique: true, sparse: true },

    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Person', personSchema);
