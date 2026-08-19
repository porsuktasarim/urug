# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug031 itibarıyla)

**Tamamlanan (özet):**
- Temel altyapı: Express/MongoDB/Docker, dil dosyası, ortak sayfa düzeni, oturum yönetimi (temel yetki modeli — herkes giriş yapınca her şeyi düzenleyebiliyor, ince taneli rol kapsamı henüz yok)
- FamilyGroup: ad + slug + **renk kodu** (elle seçilebilir, seçilmezse benzersiz rastgele renk otomatik ve kalıcı atanır)
- AttributeDefinition: admin kontrollü dinamik kişi özellikleri, çekirdek alanlar da dahil tek bir sıralı sistemden yönetiliyor
- Person: ad, **göbek adı** (italik gösterim, resmi kayıtta olmayan ad), soyadı, doğum/ölüm tarihi (gün-ay-yıl + Hicri/Rumi/Miladi çevirici, 1926 öncesi M/H/R üçlü gösterim), cinsiyet, lakaplar, TC şifreleme, aile opsiyonel
- Slug + alias mekanizması, arama (searchKey — doğum/evlilik soyadı/lakap/göbek adı dahil)
- ParentChild (Baba/Anne/Çocuk, kaldırılabilir, cinsiyete göre otomatik taraf ataması, baba sülalesi otomatik miras), Union (Eş, çoklu evlilik, otomatik evlilik soyadı ataması)
- Kişi profil sayfası: üst soy, alt soy (oğlu/kızı etiketli, yaş sıralı), eş, kardeşler
- Kişiler listesi: lakap, tarih, eş, en büyük çocuk gösterimi

**Şimdi üzerinde çalışılıyor — Görsel Ağaç / Kart Tasarımı (fazlı):**
1. ✅ Aile rengi (elle seçilebilir + otomatik fallback)
2. ⏳ Kişi kartı (büyük, detaylı) + Ağaç kartı (küçük, özet) tasarımı
3. ⏳ QR kod (kart → profil linki)
4. ⏳ D3 ağaç render (yaşa göre soldan sağa, seçili kişi vurgulu, nesil derinliği seçilebilir)
5. ⏳ Kart tıklayınca büyüme/detay açma etkileşimi
6. ⏳ Genel görsel tema yenileme

**Henüz yok:**
- Yetki modelinin ince taneli hale getirilmesi (familyAdmin/member kapsamı) — bilinçli olarak görsel/ağaç işinden SONRAYA bırakıldı
- Kişi/aile görseli yükleme
- A0 rulo PDF export, ana sayfa özet blokları, RSS/XML, yedekleme

## Ortam Değişkenleri

```
MONGO_URI=mongodb://mongo:27017/urug
TC_ENCRYPTION_KEY=<64 hex karakter>
TC_HMAC_SECRET=<rastgele uzun metin>
SESSION_SECRET=<rastgele uzun metin>
```

## İlk Kurulum

`/kurulum-admin` adresinden ilk kullanıcıyı (otomatik global admin) oluştur.

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
