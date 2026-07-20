const mongoose = require('mongoose');

/**
 * MongoDB bağlantısını kurar.
 * Bu adımda sadece bağlantı doğrulaması yapılır, şema/model burada tanımlanmaz.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI ortam değişkeni tanımlı değil.');
  }

  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB bağlantısı kuruldu.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB bağlantı hatası:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB bağlantısı koptu.');
  });

  await mongoose.connect(uri);
}

module.exports = { connectDB };
