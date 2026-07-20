const mongoose = require('mongoose');

/**
 * ParentChild — ebeveyn/çocuk ilişkisi.
 * Çocuğa değil, anne/babaya ayrı ayrı kayıt olarak bağlanır (bkz. proje dokümanı 3.4).
 * parentSide, origin-tag renk kodlamasında (ileride) "eşit derinlikte baba tarafı
 * önceliklidir" kuralı için de kullanılacak.
 */
const parentChildSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    parentSide: {
      type: String,
      enum: ['father', 'mother'],
      required: true,
    },
    relationType: {
      type: String,
      enum: ['biological', 'adopted'],
      default: 'biological',
    },
  },
  { timestamps: true }
);

// Bir çocuğun aynı taraftan (baba/anne) birden fazla kaydı olmasın
parentChildSchema.index({ childId: 1, parentSide: 1 }, { unique: true });
// Aynı ebeveyn-çocuk çifti iki kez eklenmesin
parentChildSchema.index({ childId: 1, parentId: 1 }, { unique: true });

module.exports = mongoose.model('ParentChild', parentChildSchema);
