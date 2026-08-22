const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Yüklenen dosyalar container içinde /app/uploads altına yazılır.
 * docker-compose.yml'de bu klasör bir volume'e bağlanmalı, yoksa her
 * deploy'da/restart'ta kaybolur (bkz. docker-compose.yml, urug-uploads volume'ü).
 */
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const FAMILY_PHOTOS_DIR = path.join(UPLOADS_ROOT, 'families');

// Klasörler yoksa oluştur (ilk çalıştırmada).
fs.mkdirSync(FAMILY_PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FAMILY_PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const familyPhotoUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Sadece JPEG, PNG, WEBP veya GIF yüklenebilir.'));
    }
    cb(null, true);
  },
});

module.exports = { familyPhotoUpload, UPLOADS_ROOT, FAMILY_PHOTOS_DIR };
