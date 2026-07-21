const mongoose = require('mongoose');

/**
 * Union — evlilik/nişan/birliktelik ilişkisi. Çoklu evlilik desteklenir:
 * bir kişinin birden fazla Union kaydı olabilir, her biri D3 ağaç
 * renderında ayrı bir dal olarak çizilecek (bkz. proje dokümanı 3.5, 4.6).
 */
const unionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['marriage', 'engagement', 'partnership'],
      default: 'marriage',
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Union', unionSchema);
