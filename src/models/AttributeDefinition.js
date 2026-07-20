const mongoose = require('mongoose');

/**
 * AttributeDefinition — kişi kartlarına eklenebilecek dinamik alanları
 * admin panelinden yönetmek için kullanılır (bkz. proje dokümanı 3.2).
 *
 * isSystem = true olan kayıtlar (ör. ad/soyad) admin panelinden
 * silinemez/pasifleştirilemez; bu kural route katmanında uygulanır.
 */
const ATTRIBUTE_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
  'textarea',
  'photo',
];

const attributeDefinitionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Sistem içi anahtar (key) zorunludur.'],
      unique: true,
      trim: true,
      match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key sadece harf, rakam ve alt çizgi içerebilir, harfle başlamalıdır.'],
    },
    label: {
      type: String,
      required: [true, 'Görünen ad (label) zorunludur.'],
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ATTRIBUTE_TYPES,
    },
    options: [{ type: String, trim: true }], // select/multiselect için
    isRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    group: { type: String, trim: true, default: 'Genel' },
    order: { type: Number, default: 0 },
    conditionalRequirement: {
      dependsOn: { type: String, trim: true, default: null }, // başka bir attribute'un key'i
      requiredWhen: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  { timestamps: true }
);

attributeDefinitionSchema.statics.TYPES = ATTRIBUTE_TYPES;

module.exports = mongoose.model('AttributeDefinition', attributeDefinitionSchema);
