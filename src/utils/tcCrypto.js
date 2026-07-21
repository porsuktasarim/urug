const crypto = require('crypto');

/**
 * TC kimlik no şifreleme/hash mantığı (bkz. proje dokümanı 3.3, 4.4).
 *
 * - tcEncrypted: AES-256-GCM ile şifrelenmiş asıl değer, sadece decrypt
 *   edilerek gerçek TC görülebilir.
 * - tcHash: HMAC-SHA256 ile üretilen, unique index için kullanılan hash.
 *   Arama/uniqluk kontrolü HİÇBİR ZAMAN düz metin TC üzerinden yapılmaz,
 *   her zaman bu hash üzerinden yapılır.
 *
 * Ortam değişkenleri:
 * - TC_ENCRYPTION_KEY: 32 byte (64 hex karakter) AES-256 anahtarı
 * - TC_HMAC_SECRET: HMAC için ayrı bir gizli anahtar (encryption key'den farklı olmalı)
 *
 * Bu değerler olmadan uygulama TC alanına dokunan hiçbir işlemi yapamaz —
 * fail-fast prensibiyle net bir hata fırlatılır (sessizce düz metin
 * saklamak yerine).
 */

function getEncryptionKey() {
  const keyHex = process.env.TC_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('TC_ENCRYPTION_KEY tanımlı değil ya da 64 hex karakter (32 byte) değil.');
  }
  return Buffer.from(keyHex, 'hex');
}

function getHmacSecret() {
  const secret = process.env.TC_HMAC_SECRET;
  if (!secret) {
    throw new Error('TC_HMAC_SECRET tanımlı değil.');
  }
  return secret;
}

/**
 * TC'yi AES-256-GCM ile şifreler.
 * Dönen string formatı: "iv:authTag:ciphertext" (hepsi hex).
 */
function encryptTc(plainTc) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM için 12 byte önerilir

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainTc), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * encryptTc() ile üretilmiş string'i çözer, düz TC'yi döner.
 */
function decryptTc(encryptedString) {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, dataHex] = encryptedString.split(':');

  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Şifreli TC formatı geçersiz.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Arama/uniqluk kontrolü için TC'nin HMAC-SHA256 hash'ini üretir.
 * Düz TC hiçbir zaman bu fonksiyon dışında karşılaştırılmaz.
 */
function hashTc(plainTc) {
  const secret = getHmacSecret();
  return crypto.createHmac('sha256', secret).update(String(plainTc)).digest('hex');
}

module.exports = { encryptTc, decryptTc, hashTc };
