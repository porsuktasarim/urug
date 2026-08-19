const QRCode = require('qrcode');

/**
 * Verilen URL için base64 data URI olarak bir QR kod üretir — doğrudan
 * <img src="..."> içine gömülebilir, ayrı bir dosya/route gerekmez.
 *
 * BASE_URL ortam değişkeni varsa (ör. https://secere.aile.com) tam adres
 * üretilir; yoksa göreli path (/aile-slug/kisi-slug) QR'a gömülür — bu
 * durumda QR'ı okuyan telefon, uygulamanın kendi adresini bilmiyorsa
 * çalışmayabilir, bu yüzden production'da BASE_URL ayarlanması önerilir.
 *
 * @param {string} relativePath - ör. "/turkeli/hasan-turkeli"
 * @returns {Promise<string>} data:image/png;base64,... formatında string
 */
async function generateProfileQrCode(relativePath) {
  const baseUrl = process.env.BASE_URL || '';
  const fullUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${relativePath}` : relativePath;

  return QRCode.toDataURL(fullUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
  });
}

module.exports = { generateProfileQrCode };
