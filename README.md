# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug010 itibarıyla)

**Tamamlanan:**
- Express + MongoDB (Mongoose) bağlantısı, Docker Compose (`app` + `mongo`), Coolify uyumlu (sabit port bağlama yok, `expose` kullanılıyor)
- Dil dosyası altyapısı — tüm metinler `src/lang/tr.js`'de, `t()` fonksiyonuyla çağrılıyor, tekrarlayan metin yok
- Ortak sayfa düzeni: `src/views/partials/header.ejs` + `footer.ejs` (üst menü: Aileler / Kişiler / Kişi Özellikleri)
- **FamilyGroup**: ad + slug (Türkçe karakter dönüşümlü, elle düzenlenebilir), CRUD tam
- **AttributeDefinition**: admin panelinden yönetilen dinamik kişi özellikleri (key/label/tip/seçenekler/grup/sıra/zorunluluk/koşullu zorunluluk), sistem alanları (`officialFirstName`, `officialLastName`) korumalı, grup seçimi özel JS combobox ile (mevcut gruplar önerilir, yeni grup da yazılabilir)
- **Person**: ad, soyadı (+ "soyadı yok" seçeneği, koşullu zorunluluk), doğum yılı, dinamik özellikler (aktif attribute'lar forma otomatik yansıyor, tipine göre render ediliyor)
- **Slug + alias mekanizması**: aynı ad-soyad'lı kişiler arasında en yaşlı düz slug alır, diğerleri yıl eklenir, çakışmada -a/-b, yıl bilinmeyen rastgele kod alır; slug değişince eskisi alias olarak saklanır, `/aile-slug/kisi-slug` adresine 301 ile yönlendirilir
- Basit kişi profil sayfası (`persons/show.ejs`) — geçici, tam detay sayfası (üst soy/alt soy/eş) henüz yok

**Henüz yok:**
- Kişiler arası akrabalık bağı (ebeveyn/çocuk/eş) kurma — arama-ve-seç bileşeni bir sonraki adımda geliyor
- Lakap sistemi, TC şifreleme, yetki modeli, görsel yükleme
- D3 ağaç render, PDF export, ana sayfa özet blokları, RSS, yedekleme

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

Coolify'da deploy edilirken domain/FQDN üzerinden erişim sağlanır (docker-compose'da sabit host portu yok, `expose` kullanılıyor).

## Proje Dokümanı

Kapsamlı gereksinimler ve fazlı yol haritası için bkz. proje dokümanı (`secere-proje-dokumani.md` / Uruğ dokümanı), özellikle Bölüm 9 — sıralı küçük görev listesi.

## Sıradaki Adım

Adım 7: Arama-ve-seç bileşeni — kişi ekleme/ilişki kurma akışlarında duplicate önleme (ad-soyad + doğum yılı ile arama, benzer kayıt uyarısı).
