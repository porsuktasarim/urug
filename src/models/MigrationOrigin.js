const mongoose = require('mongoose');

/**
 * MigrationOrigin — mübadele ile gelen kişilerin "nereden nereye"
 * bilgisini TEK BİR YERDE tutar, birden fazla kişi aynı kayda bağlanabilir
 * (ör. "Selanik Kavala Sarışaban Koçoğlu"'ndan gelen tüm aile üyeleri aynı
 * MigrationOrigin'e referans verir — tekrar tekrar yazılmaz).
 *
 * "Nereden" Osmanlı eyalet/idari sistemine göre (en genişten en dara):
 *   fromEyalet (Selanik) > fromSancak (Kavala) > fromKaza (Sarışaban) > fromKoy (Koçoğlu)
 * "Nereye" 1924 Türkiye idari sistemine göre (en genişten en dara):
 *   toIl > toIlce > toKasaba > toKoyMahalle (Ovacık)
 *
 * Tüm seviyeler opsiyonel (bilinmeyen ara seviyeler boş bırakılabilir),
 * ama en az BİR "from" ve BİR "to" alanı dolu olmalı (route seviyesinde
 * doğrulanır).
 */
const migrationOriginSchema = new mongoose.Schema(
  {
    fromEyalet: { type: String, trim: true, default: null },
    fromSancak: { type: String, trim: true, default: null },
    fromKaza: { type: String, trim: true, default: null },
    fromKoy: { type: String, trim: true, default: null },

    toIl: { type: String, trim: true, default: null },
    toIlce: { type: String, trim: true, default: null },
    toKasaba: { type: String, trim: true, default: null },
    toKoyMahalle: { type: String, trim: true, default: null },

    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MigrationOrigin', migrationOriginSchema);
