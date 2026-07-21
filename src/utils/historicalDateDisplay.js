const { gregorianYearToHijri, gregorianYearToRumi } = require('./calendarConversion');

/**
 * Türkiye 1 Ocak 1926'da resmen Rumi/Hicri'den Miladi'ye geçti. Bu tarihten
 * ÖNCEKİ olaylarda, o dönemde nasıl anıldığına dair bağlam kaybolmasın diye
 * üç takvimi birden gösteriyoruz: "M: 1920 H: 1338 R: 1336" gibi.
 *
 * Sıralama M-H-R sabit: Miladi (MS 1'den başlar) kronolojik olarak en erken
 * başlayan sayım sistemi, Hicri ve Rumi ikisi de aynı hicret yılından
 * (MS 622) başlar — bu yüzden "hangisi önce başladıysa o sırada" kuralı
 * M, sonra H, sonra R sırasını verir.
 *
 * @param {number|null} gregorianYear
 * @returns {string} — 1926 öncesiyse "M: .. H: .. R: .." ; sonrasıysa/yoksa sadece yıl ya da boş string
 */
function formatHistoricalYear(gregorianYear) {
  if (gregorianYear === null || gregorianYear === undefined) return '';

  if (gregorianYear >= 1926) {
    return String(gregorianYear);
  }

  const hijri = gregorianYearToHijri(gregorianYear);
  const rumi = gregorianYearToRumi(gregorianYear);

  return `M: ${gregorianYear}  H: ${hijri}  R: ${rumi}`;
}

module.exports = { formatHistoricalYear };
