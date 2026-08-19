const mongoose = require('mongoose');

/**
 * FamilyGroup — ad + slug + renk kodu.
 * colorCode: aile eklenirken elle seçilir (renk kodlama, ağaç görselinde
 * "bu kişi başka bir aileden geliyor" göstermek için — bkz. proje dokümanı
 * origin-tag mantığı). Elle seçilmemişse boş kalır; boş kalan ailelere
 * (ör. sadece evlilik yoluyla değinilen küçük/harici aileler) görüntüleme
 * anında (bkz. utils/familyColor.js) benzersiz bir renk otomatik ve
 * KALICI olarak atanır — bir kere atandıktan sonra değişmez.
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
    colorCode: {
      type: String, // hex renk, ör. "#3b82f6"
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FamilyGroup', familyGroupSchema);
