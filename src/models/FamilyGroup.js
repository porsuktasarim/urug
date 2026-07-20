const mongoose = require('mongoose');

/**
 * FamilyGroup — Adım 2 kapsamı: sadece ad + slug.
 * photo/description/colorCode gibi alanlar sonraki adımlarda eklenecek
 * (bkz. proje dokümanı Bölüm 3.1 ve Bölüm 9).
 */
const familyGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Aile adı zorunludur.'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FamilyGroup', familyGroupSchema);
