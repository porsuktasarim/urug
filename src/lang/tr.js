/**
 * Uruğ - Türkçe dil dosyası
 *
 * Kural: Uygulamada kullanılan her metin buradan çekilir, kod içine
 * düz metin (hardcoded string) yazılmaz. Aynı anlama gelen metin
 * için ikinci bir anahtar açılmaz; var olan anahtar farklı yerlerden
 * referans verilerek yeniden kullanılır.
 *
 * Bu dosya, proje ilerledikçe (Bölüm 9'daki adımlar tamamlandıkça)
 * yeni gruplarla genişletilecek. Şu an sadece iskelenin çalışması
 * için gereken minimum anahtarlar var.
 */

module.exports = {
  common: {
    appName: 'Uruğ',
    actions: {
      save: 'Kaydet',
      cancel: 'Vazgeç',
      edit: 'Düzenle',
      delete: 'Sil',
      search: 'Ara',
      new: 'Yeni Ekle',
    },
    status: {
      loading: 'Yükleniyor...',
      ok: 'Tamam',
      error: 'Hata',
      empty: 'Kayıt bulunamadı.',
    },
    confirm: {
      delete: 'Bu kaydı silmek istediğinize emin misiniz?',
    },
  },

  family: {
    title: 'Aileler',
    fields: {
      name: 'Aile Adı',
      slug: 'Slug (bağlantı adresi)',
    },
    slugHint: 'Boş bırakılırsa aile adından otomatik üretilir. Türkçe karakterler sadeleştirilir.',
    newTitle: 'Yeni Aile Ekle',
    editTitle: 'Aileyi Düzenle',
  },

  system: {
    dbConnected: 'Veritabanı bağlantısı başarılı.',
    dbConnectionFailed: 'Veritabanı bağlantısı kurulamadı.',
    serverStarted: 'Sunucu {port} portunda çalışıyor.',
  },
};
