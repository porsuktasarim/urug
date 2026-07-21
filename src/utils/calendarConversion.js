/**
 * Hicri/Rumi → Miladi (Gregorian) yıl dönüşümü.
 *
 * ÖNEMLİ SINIRLAMA: Bu dönüşümler YIL SEVİYESİNDE YAKLAŞIKTIR, gün-hassasiyetli
 * değildir. Hicri takvim kamerî (Ay yılı, ~354.36 gün) olduğu için Miladi
 * (güneş yılı, ~365.25 gün) ile birebir örtüşmez — yaklaşık her 33 hicri
 * yılda 1 miladi yıl kayar. Şecere bağlamında hicri/rumi doğum yılları zaten
 * genelde sözlü tarihe dayalı yaklaşık bilgiler olduğu için bu, pratik ve
 * yeterli bir dönüşümdür; hassas takvim hesaplaması (ay gözlemi vb.) gerekmez.
 */

/**
 * Hicri yılı Miladi yıla çevirir (standart yaklaşık formül).
 * @param {number} hijriYear
 * @returns {number}
 */
function hijriYearToGregorian(hijriYear) {
  return Math.round(hijriYear + 622 - hijriYear / 33);
}

/**
 * Miladi yılı Hicri yıla çevirir (ters yönde yaklaşık formül).
 * @param {number} gregorianYear
 * @returns {number}
 */
function gregorianYearToHijri(gregorianYear) {
  return Math.round((gregorianYear - 622) * (33 / 32));
}

/**
 * Rumi (Osmanlı mali takvimi, Jülyen tabanlı) yılı Miladi yıla çevirir.
 * Rumi yıl Mart ayında başladığı için ay bilgisi olmadan (bu uygulamada
 * rumi/hicri sadece yıldan ibaret kabul ediliyor) +584 sabit farkı kullanılır
 * — bu, pratikte doğru miladi yılın ya kendisini ya da bir eksiğini verir,
 * gün/ay bilgisi olmadan daha kesini hesaplanamaz.
 * @param {number} rumiYear
 * @returns {number}
 */
function rumiYearToGregorian(rumiYear) {
  return rumiYear + 584;
}

/**
 * calendarType'a göre girilen yılı Miladi yıla çevirir.
 * @param {'miladi'|'hicri'|'rumi'} calendarType
 * @param {number} year
 * @returns {number}
 */
function convertToGregorianYear(calendarType, year) {
  if (calendarType === 'hicri') return hijriYearToGregorian(year);
  if (calendarType === 'rumi') return rumiYearToGregorian(year);
  return year; // miladi
}

module.exports = {
  hijriYearToGregorian,
  gregorianYearToHijri,
  rumiYearToGregorian,
  convertToGregorianYear,
};
