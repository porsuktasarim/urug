const fs = require('fs');
const path = require('path');
const { getPrimaryImagesConnection, uploadBufferToDrive, deleteDriveFile } = require('./googleDrive');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/**
 * Sıkıştırılmış bir görsel buffer'ını, görseller için birincil işaretli
 * bir Drive bağlantısı varsa ORAYA, yoksa yerel diske kaydeder. Dönen
 * URL her iki durumda da tutarlı bir formatta:
 *   - Yerel: "/uploads/families/xxxx.webp"
 *   - Drive: "/uploads/drive/<connectionId>/<fileId>" — connectionId
 *     dahil ediliyor çünkü artık BİRDEN FAZLA Drive bağlantısı olabilir,
 *     dosyayı geri çekerken HANGİ hesabın kimlik bilgileriyle istek
 *     atılacağını bilmemiz gerekiyor (bkz. routes/driveFileProxy.routes.js).
 *
 * @param {Buffer} buffer
 * @param {string} filename - ör. "1234-abcd.webp"
 * @param {string} localDir - Drive kullanılmıyorsa yazılacak yerel klasör
 */
async function storeImageBuffer(buffer, filename, localDir) {
  const primaryConnection = await getPrimaryImagesConnection();

  if (primaryConnection) {
    const fileId = await uploadBufferToDrive(primaryConnection._id, buffer, filename, 'image/webp');
    return `/uploads/drive/${primaryConnection._id}/${fileId}`;
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
    const parts = url.replace('/uploads/drive/', '').split('/');
    const [connectionId, fileId] = parts;
    await deleteDriveFile(connectionId, fileId);
    return;
  }

  const filePath = path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ''));
  fs.unlink(filePath, () => {}); // sessizce geç, dosya zaten yoksa sorun değil
}

module.exports = { storeImageBuffer, deleteStoredImage, UPLOADS_ROOT };
