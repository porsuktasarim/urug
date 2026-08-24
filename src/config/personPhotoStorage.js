const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const PERSON_PHOTOS_DIR = path.join(UPLOADS_ROOT, 'persons');

fs.mkdirSync(PERSON_PHOTOS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const personPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Sadece JPEG, PNG, WEBP veya GIF yüklenebilir.'));
    }
    cb(null, true);
  },
});

// Vesikalık oranı ve sabit çıktı boyutu (proje dokümanı 4.2 kararı: 3:4).
const VESIKALIK_ASPECT_RATIO = 3 / 4; // genişlik / yükseklik
const VESIKALIK_WIDTH = 480;
const VESIKALIK_HEIGHT = 640; // 480 / (3/4) = 640
const ORIGINAL_MAX_DIMENSION = 2000;
const WEBP_QUALITY = 82;

function randomFilename() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
}

/**
 * Bir görselin ortasından, VESIKALIK_ASPECT_RATIO oranına uyan en büyük
 * dikdörtgeni hesaplar (orijinal görselin piksel koordinatlarında).
 * Otomatik kırpma için kullanılır — kullanıcı hiç kırpma yapmazsa
 * varsayılan olarak bu uygulanır.
 */
function computeCenterCropRect(imageWidth, imageHeight) {
  const targetRatio = VESIKALIK_ASPECT_RATIO;
  const currentRatio = imageWidth / imageHeight;

  let cropWidth;
  let cropHeight;

  if (currentRatio > targetRatio) {
    // Görsel orantıya göre çok geniş — yükseklik sabit, genişlik kırpılır.
    cropHeight = imageHeight;
    cropWidth = Math.round(imageHeight * targetRatio);
  } else {
    // Görsel orantıya göre çok uzun — genişlik sabit, yükseklik kırpılır.
    cropWidth = imageWidth;
    cropHeight = Math.round(imageWidth / targetRatio);
  }

  const x = Math.round((imageWidth - cropWidth) / 2);
  const y = Math.round((imageHeight - cropHeight) / 2);

  return { x, y, width: cropWidth, height: cropHeight };
}

/**
 * Yeni yüklenen bir kişi fotoğrafını işler:
 *   1) Orijinali sıkıştırıp (kırpmadan) kaydeder (photoOriginal).
 *   2) Ortadan otomatik kırpıp sabit vesikalık boyutuna (480x640) getirip
 *      kaydeder (photo).
 *
 * @param {Buffer} buffer - ham yüklenen görsel verisi
 * @returns {Promise<{ photoUrl: string, photoOriginalUrl: string, cropData: object }>}
 */
async function processNewPersonPhoto(buffer) {
  const originalSharp = sharp(buffer);
  const metadata = await originalSharp.metadata();

  // 1) Orijinal — kırpma yok, sadece makul bir üst sınıra sıkıştırma.
  const originalFilename = randomFilename();
  await sharp(buffer)
    .resize({
      width: ORIGINAL_MAX_DIMENSION,
      height: ORIGINAL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(PERSON_PHOTOS_DIR, originalFilename));

  // Orijinal yeniden boyutlandırıldıysa (ör. 2000px sınırına çarptıysa),
  // kırpma dikdörtgenini de bu YENİ (kaydedilen) orijinalin ölçeğine göre
  // hesaplamamız gerekiyor — metadata sharp'ın kendi resize sonrası
  // boyutunu vermiyor, o yüzden kaydedilen dosyayı tekrar okuyoruz.
  const savedOriginalMeta = await sharp(path.join(PERSON_PHOTOS_DIR, originalFilename)).metadata();
  const cropRect = computeCenterCropRect(savedOriginalMeta.width, savedOriginalMeta.height);

  // 2) Vesikalık — otomatik ortadan kırpma + sabit boyut.
  const photoFilename = randomFilename();
  await sharp(path.join(PERSON_PHOTOS_DIR, originalFilename))
    .extract({ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height })
    .resize(VESIKALIK_WIDTH, VESIKALIK_HEIGHT)
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(PERSON_PHOTOS_DIR, photoFilename));

  return {
    photoUrl: `/uploads/persons/${photoFilename}`,
    photoOriginalUrl: `/uploads/persons/${originalFilename}`,
    cropData: cropRect,
  };
}

/**
 * Var olan bir photoOriginal üzerinden, KULLANICININ SEÇTİĞİ kırpma
 * dikdörtgenine göre vesikalık (photo) alanını yeniden üretir — orijinal
 * görsele hiç dokunulmaz, sadece 'photo' yeniden oluşturulur.
 *
 * @param {string} photoOriginalUrl - ör. "/uploads/persons/xxxx.webp"
 * @param {{x:number,y:number,width:number,height:number}} cropRect - orijinal görselin piksel koordinatlarında
 * @returns {Promise<string>} yeni photo URL'i
 */
async function recropPersonPhoto(photoOriginalUrl, cropRect) {
  const originalPath = path.join(UPLOADS_ROOT, photoOriginalUrl.replace(/^\/uploads\//, ''));

  if (!fs.existsSync(originalPath)) {
    throw new Error('Orijinal görsel bulunamadı.');
  }

  const photoFilename = randomFilename();
  await sharp(originalPath)
    .extract({
      left: Math.round(cropRect.x),
      top: Math.round(cropRect.y),
      width: Math.round(cropRect.width),
      height: Math.round(cropRect.height),
    })
    .resize(VESIKALIK_WIDTH, VESIKALIK_HEIGHT)
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(PERSON_PHOTOS_DIR, photoFilename));

  return `/uploads/persons/${photoFilename}`;
}

/**
 * Bir kişinin eski fotoğraf dosyalarını (photo ve/veya photoOriginal)
 * diskten siler — yeni fotoğraf yüklenirken ya da kişi silinirken.
 */
function deletePersonPhotoFiles(urls) {
  urls.filter(Boolean).forEach((url) => {
    const filePath = path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ''));
    fs.unlink(filePath, () => {}); // sessizce geç, dosya zaten yoksa sorun değil
  });
}

module.exports = {
  personPhotoUpload,
  processNewPersonPhoto,
  recropPersonPhoto,
  deletePersonPhotoFiles,
  computeCenterCropRect,
  PERSON_PHOTOS_DIR,
  VESIKALIK_ASPECT_RATIO,
  VESIKALIK_WIDTH,
  VESIKALIK_HEIGHT,
};
