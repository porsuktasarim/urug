const express = require('express');
const { getDriveFileStream } = require('../utils/googleDrive');

const router = express.Router();

/**
 * GET /uploads/drive/:connectionId/:fileId — belirtilen Drive bağlantısı
 * üzerinden bir dosyayı sunucu üzerinden akıtır (gerçek Drive linki hiçbir
 * zaman istemciye verilmez, dosyanın "herkese açık" paylaşılmasına da
 * gerek kalmaz). Uzun süreli cache header'ı eklenir — yüklenen görseller
 * değişmez (yeni kırpma/güncelleme her zaman YENİ bir dosya oluşturur).
 */
router.get('/drive/:connectionId/:fileId', async (req, res) => {
  try {
    const stream = await getDriveFileStream(req.params.connectionId, req.params.fileId);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).send('Görsel bulunamadı.');
    });
  } catch (err) {
    res.status(404).send('Görsel bulunamadı.');
  }
});

module.exports = router;
