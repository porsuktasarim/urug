const { convertToGregorianYear } = require('./calendarConversion');

/**
 * Form body'sinden "${prefix}Day", "${prefix}Month", "${prefix}Year",
 * "${prefix}CalendarType" alanlarını okuyup Person şemasına yazılacak
 * hale getirir. Hicri/Rumi girilirse otomatik Miladi'ye çevrilir.
 *
 * Miladi için gün-ay-yıl / ay-yıl / sadece yıl desteklenir (hepsi opsiyonel,
 * ama girilirse anlamlı bir kombinasyon olmalı — gün varsa ay da olmalı).
 * Hicri/Rumi için SADECE yıl kabul edilir (proje kararı: bu takvimlerde
 * gün/ay pratikte neredeyse hiç bilinmez).
 *
 * @param {string} prefix - "birth" veya "death"
 * @param {object} body - req.body
 * @returns {{ day: number|null, month: number|null, year: number|null, calendarType: string, originalYear: number|null } | { error: string }}
 */
function parseDateFields(prefix, body) {
  const calendarType = body[`${prefix}CalendarType`] || 'miladi';
  const rawYear = body[`${prefix}Year`];
  const rawMonth = body[`${prefix}Month`];
  const rawDay = body[`${prefix}Day`];

  if (!rawYear || !rawYear.trim()) {
    // Yıl girilmemişse tüm tarih bilgisi boş sayılır (gün/ay tek başına anlamsız)
    return { day: null, month: null, year: null, calendarType: 'miladi', originalYear: null };
  }

  const year = Number(rawYear);
  if (Number.isNaN(year)) {
    return { error: 'Yıl sayı olmalıdır.' };
  }

  if (calendarType === 'hicri' || calendarType === 'rumi') {
    // Bu takvimlerde sadece yıl kabul edilir, gün/ay göz ardı edilir.
    return {
      day: null,
      month: null,
      year: convertToGregorianYear(calendarType, year),
      calendarType,
      originalYear: year,
    };
  }

  // Miladi: gün-ay-yıl / ay-yıl / sadece yıl
  let month = null;
  let day = null;

  if (rawMonth && rawMonth.trim()) {
    month = Number(rawMonth);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      return { error: 'Ay 1-12 arasında olmalıdır.' };
    }
  }

  if (rawDay && rawDay.trim()) {
    if (!month) {
      return { error: 'Gün girildiyse ay da girilmelidir.' };
    }
    day = Number(rawDay);
    if (Number.isNaN(day) || day < 1 || day > 31) {
      return { error: 'Gün 1-31 arasında olmalıdır.' };
    }
  }

  return { day, month, year, calendarType: 'miladi', originalYear: null };
}

module.exports = { parseDateFields };
