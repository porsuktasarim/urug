# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug016 itibarıyla)

**Tamamlanan:**
- Express + MongoDB (Mongoose) bağlantısı, Docker Compose (`app` + `mongo`), Coolify uyumlu
- Dil dosyası altyapısı — `src/lang/tr.js`, `t()` fonksiyonu, tekrarsız metin
- Ortak sayfa düzeni (`partials/header.ejs` + `footer.ejs`)
- **FamilyGroup**: ad + slug + CRUD tam
- **AttributeDefinition**: admin kontrollü dinamik kişi özellikleri, grup seçimi özel JS combobox ile
- **Person**: ad/soyad (+ "soyadı yok"), doğum yılı, cinsiyet, dinamik özellikler
- **Slug + alias mekanizması**: yaş bazlı öncelik, 301 yönlendirme
- **Arama-ve-seç bileşeni**: `/kisiler/api/ara`, Türkçe karakter duyarlı
- **ParentChild ilişkisi**: Baba/Anne/Çocuk ekleme (arama-ve-seç veya hızlı yeni kişi ekleme)
- **Union (eş) ilişkisi**: çoklu evlilik desteği, kadın tarafının soyadı otomatik güncelleniyor (cinsiyet bilgisi varsa)
- **Lakap sistemi**: kişisel lakap(lar) + sülale lakabı (kimden miras alındığı işaretlenebilir), kart görünümünde gösteriliyor
- **TC şifreleme**: AES-256-GCM + HMAC-SHA256, düz metin hiçbir yerde saklanmıyor/render edilmiyor
- Kişi detay/profil sayfası (`/aile-slug/kisi-slug`): üst soy, alt soy, eş, lakaplar

**Henüz yok / bilinen sınırlamalar:**
- **Yetki modeli / kullanıcı girişi yok** — şu an herkes her kişiyi düzenleyebiliyor, "sadece admin TC görsün" kuralı sadece arayüzde TC'nin hiç render edilmemesiyle sağlanıyor, rol bazlı erişim kontrolü değil. Bu, Yetki Modeli adımı tamamlanınca sıkılaştırılacak.
- Kişi/aile görseli yükleme
- D3 ağaç render, origin-tag renk kodlama
- A0/poster PDF export
- Ana sayfa özet blokları, RSS/XML
- Yedekleme sistemi

## Ortam Değişkenleri (TC şifreleme için gerekli)

```
TC_ENCRYPTION_KEY=<64 hex karakter — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
TC_HMAC_SECRET=<rastgele uzun bir metin, TC_ENCRYPTION_KEY'den farklı>
```

Coolify'da bu ikisi "Environment Variables" panelinden eklenmeli.

## Yerelde Çalıştırma

```bash
cp .env.example .env
npm install
npm run dev
```

## Docker ile Çalıştırma

```bash
docker compose up --build
```

## Proje Dokümanı

Kapsamlı gereksinimler ve fazlı yol haritası için bkz. Uruğ proje dokümanı, özellikle Bölüm 9.

## Sıradaki Adım

Yetki Modeli (kullanıcı girişi + roller: global admin / aile admini / üye) — TC görünürlüğünün gerçek anlamda kısıtlanabilmesi için önce bu gerekiyor.
