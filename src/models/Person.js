const mongoose = require('mongoose');

/**
 * Person — Adım 6 ile genişletildi: birthYear, nameKey, slug, slugAliases.
 * Lakap, TC, görsel gibi alanlar sonraki adımlarda eklenecek
 * (bkz. proje dokümanı Bölüm 9).
 */
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

    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Person', personSchema);
