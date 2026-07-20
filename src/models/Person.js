const mongoose = require('mongoose');

/**
 * Person — Adım 4 kapsamı: sadece kimlik temeli.
 * Lakap, TC, görsel, dinamik attribute, slug gibi alanlar
 * sonraki adımlarda eklenecek (bkz. proje dokümanı Bölüm 9).
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Person', personSchema);
