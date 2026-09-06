const mongoose = require('mongoose');

/**
 * SiblingLink — anne/baba bilinmese de "bu ikisinin kardeş olduğundan
 * eminiz" diyebilmek için doğrudan bir bağ. ParentChild üzerinden
 * hesaplanan (ortak ebeveynli) kardeşlikten AYRI bir mekanizma —
 * ikisi de aynı anda geçerli olabilir, gösterimde birleştirilip
 * tekrarsız hale getiriliyor (bkz. utils/familyRelations.js).
 *
 * Simetrik ilişki (Union ile aynı desen): personAId/personBId sırası
 * önemli değil.
 */
const siblingLinkSchema = new mongoose.Schema(
  {
    personAId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    personBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiblingLink', siblingLinkSchema);
