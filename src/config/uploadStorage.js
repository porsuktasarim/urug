const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Yüklenen dosyalar container içinde /app/uploads altına yazılır.
 * docker-compose.yml'de bu klasör bir volume'e bağlanmalı, yoksa her
 * deploy'da/restart'ta kaybolur (bkz. docker-compose.yml, urug-uploads volume'ü).
 */
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const FAMILY_PHOTOS_DIR = path.join(UPLOADS_ROOT, 'families');

fs.mkdirSync(FAMILY_PHOTOS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Disk'e DOĞRUDAN yazmıyoruz — önce belleğe alıp sharp ile sıkıştırıp/
// yeniden boyutlandırıp OYLE diske yazıyoruz (bkz. processAndSaveFamilyPhoto).
// Bu, kısıtlı disk alanı için önemli: orijinal (genelde çok büyük telefon
// fotoğrafı) hiç diske yazılmadan, sadece optimize edilmiş hali kalıyor.
const memoryStorage = multer.memoryStorage();

const familyPhotoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // ham yükleme için üst sınır (sıkıştırma öncesi)
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Sadece JPEG, PNG, WEBP veya GIF yüklenebilir.'));
    }
    cb(null, true);
  },
});

/**
 * Bellekteki ham görsel buffer'ını sıkıştırıp/boyutlandırıp diske yazar.
 * Format her zaman WebP'ye çevrilir (JPEG/PNG'den belirgin şekilde daha
 * küçük dosya boyutu, kısıtlı disk alanı için önemli), en uzun kenar
 * MAX_DIMENSION ile sınırlanır (orantı korunur, büyütme yapılmaz).
 *
 * NOT: Aile fotoğrafları için sabit boyut/kırpma ZORUNLULUĞU yok (proje
 * kararı — bkz. proje dokümanı 4.2), sadece sıkıştırma uygulanıyor.
 *
 * @param {Buffer} buffer - multer memoryStorage'dan gelen ham dosya verisi
 * @param {string} destDir - hedef klasör (ör. FAMILY_PHOTOS_DIR)
 * @returns {Promise<{ filename: string, sizeBytes: number }>}
 */
async function processAndSaveImage(buffer, destDir) {
  const MAX_DIMENSION = 1600;
  const WEBP_QUALITY = 80;

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const destPath = path.join(destDir, filename);

  await sharp(buffer)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destPath);

  const stats = fs.statSync(destPath);
  return { filename, sizeBytes: stats.size };
}

module.exports = { familyPhotoUpload, processAndSaveImage, UPLOADS_ROOT, FAMILY_PHOTOS_DIR };
