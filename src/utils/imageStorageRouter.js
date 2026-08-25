const fs = require('fs');
const path = require('path');
const { isDriveConnected, uploadBufferToDrive, deleteDriveFile } = require('./googleDrive');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/**
 * Sıkıştırılmış bir görsel buffer'ını Drive bağlıysa Drive'a, değilse
 * yerel diske kaydeder. Dönen URL her iki durumda da tutarlı bir formatta:
 *   - Yerel: "/uploads/families/xxxx.webp"
 *   - Drive: "/uploads/drive/<fileId>" — bu path, app.js'te kayıtlı bir
 *     proxy route tarafından yakalanıp Drive'dan akıtılıyor (bkz.
 *     routes/driveFileProxy.routes.js), gerçek Drive linki HİÇ istemciye
 *     verilmiyor.
 *
 * @param {Buffer} buffer
 * @param {string} filename - ör. "1234-abcd.webp"
 * @param {string} localDir - Drive bağlı değilse yazılacak yerel klasör
 */
async function storeImageBuffer(buffer, filename, localDir) {
  const connected = await isDriveConnected();

  if (connected) {
    const fileId = await uploadBufferToDrive(buffer, filename, 'image/webp');
    return `/uploads/drive/${fileId}`;
  }

  fs.mkdirSync(localDir, { recursive: true });
  const destPath = path.join(localDir, filename);
  fs.writeFileSync(destPath, buffer);

  const relative = path.relative(UPLOADS_ROOT, destPath).split(path.sep).join('/');
  return `/uploads/${relative}`;
}

/**
 * Bir görsel URL'inin Drive'da mı yerel diskte mi olduğunu ayırt edip
 * doğru şekilde siler.
 */
async function deleteStoredImage(url) {
  if (!url) return;

  if (url.startsWith('/uploads/drive/')) {
    const fileId = url.replace('/uploads/drive/', '');
    await deleteDriveFile(fileId);
    return;
  }

  const filePath = path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ''));
  fs.unlink(filePath, () => {}); // sessizce geç, dosya zaten yoksa sorun değil
}

module.exports = { storeImageBuffer, deleteStoredImage, UPLOADS_ROOT };
