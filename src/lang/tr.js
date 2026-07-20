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

  attribute: {
    title: 'Kişi Özellikleri',
    fields: {
      key: 'Sistem Anahtarı (key)',
      label: 'Görünen Ad',
      type: 'Alan Tipi',
      options: 'Seçenekler (virgülle ayırın)',
      group: 'Grup',
      order: 'Sıra',
      isRequired: 'Zorunlu mu?',
      isActive: 'Aktif mi?',
      dependsOn: 'Koşullu zorunluluk — bağlı olduğu alanın key\'i',
      requiredWhen: 'Bu değerdeyken zorunlu',
    },
    keyHint: 'Sadece harf, rakam ve alt çizgi; harfle başlamalı. Sonradan değiştirilemez (sistem alanı hariç).',
    groupHint: 'Var olan bir grubu seçebilir ya da yeni bir grup adı yazabilirsin.',
    systemLocked: 'Bu sistem alanı — key/tip/zorunluluk değiştirilemez, silinemez.',
    newTitle: 'Yeni Özellik Ekle',
    editTitle: 'Özelliği Düzenle',
    types: {
      text: 'Metin',
      number: 'Sayı',
      date: 'Tarih',
      boolean: 'Evet/Hayır',
      select: 'Tekli Seçim',
      multiselect: 'Çoklu Seçim',
      textarea: 'Uzun Metin',
      photo: 'Görsel',
    },
  },

  person: {
    title: 'Kişiler',
    fields: {
      familyGroupId: 'Aile',
      officialFirstName: 'Ad',
      officialLastName: 'Soyadı',
      hasNoLastName: 'Soyadı yok (1934 öncesi)',
      birthYear: 'Doğum Yılı',
      slug: 'Bağlantı Adresi',
    },
    birthYearHint: 'Bilinmiyorsa boş bırakılabilir. Aynı ad-soyad\'lı kişiler arasında sıralama için kullanılır.',
    newTitle: 'Yeni Kişi Ekle',
    editTitle: 'Kişiyi Düzenle',
  },

  system: {
    dbConnected: 'Veritabanı bağlantısı başarılı.',
    dbConnectionFailed: 'Veritabanı bağlantısı kurulamadı.',
    serverStarted: 'Sunucu {port} portunda çalışıyor.',
  },
};
