# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug020 itibarıyla)

**Tamamlanan:**
- Express + MongoDB (Mongoose) bağlantısı, Docker Compose, Coolify uyumlu
- Dil dosyası altyapısı, ortak sayfa düzeni (header/footer)
- **FamilyGroup**: ad + slug + CRUD
- **AttributeDefinition**: admin kontrollü dinamik kişi özellikleri (artık **global admin girişi gerektiriyor**)
- **Person**: ad/soyad, doğum yılı, cinsiyet, dinamik özellikler, **aile seçimi opsiyonel** (dışarıdan gelen kişiler için)
- **Slug + alias mekanizması**: aileli kişiler `/aile-slug/kisi-slug`, ailesiz kişiler `/kisi/kisi-slug`
- **Arama-ve-seç bileşeni**, **ParentChild** (Baba/Anne/Çocuk), **Union** (Eş, otomatik evlilik soyadı ataması)
- **Lakap sistemi** (kişisel + sülale lakabı)
- **TC şifreleme** (AES-256-GCM + HMAC)
- Kişi profil sayfası: üst soy, alt soy (oğlu/kızı etiketli, yaş sıralı), eş, **kardeşler** (yaş sıralı)
- **Yetki Modeli (temel):** kullanıcı girişi/çıkışı, oturum yönetimi (MongoDB'de saklanan session), ilk kullanıcı otomatik global admin, **tüm ekleme/düzenleme/silme işlemleri artık giriş gerektiriyor**, kişi özellikleri yönetimi sadece global admin

**Henüz yok / bilinen sınırlamalar:**
- **İnce taneli rol kapsamı henüz yok** — `Membership` şeması `familyAdmin`/`member` rollerini destekliyor ama şu an sadece "giriş yapmış mı" ve "global admin mi" kontrol ediliyor. Bir kullanıcı giriş yaptıysa şu an **her kişiyi/aileyi düzenleyebiliyor** (aile admini/üye kapsamı bir sonraki küçük adımda gelecek — `$graphLookup` ile "kendisi ve altsoyu" sınırlaması)
- Yeni kullanıcı ekleme arayüzü yok — şu an sadece ilk admin `/kurulum-admin` üzerinden oluşturulabiliyor, sonraki kullanıcılar için admin panelinden "kullanıcı ekle" ekranı gerekiyor (sonraki adım)
- Görüntüleme (profil sayfaları, arama) hâlâ herkese açık — bu bilinçli bir tercih (aile ağacının paylaşılabilir olması için), sadece düzenleme kısıtlı
- Kişi/aile görseli yükleme, D3 ağaç render, PDF export, ana sayfa özet blokları, RSS/XML, yedekleme

## Ortam Değişkenleri

```
MONGO_URI=mongodb://mongo:27017/urug
TC_ENCRYPTION_KEY=<64 hex karakter>
TC_HMAC_SECRET=<rastgele uzun metin>
SESSION_SECRET=<rastgele uzun metin>
```

## İlk Kurulum (Yetki Modeli)

Uygulama ilk açıldığında `/kurulum-admin` adresine giderek ilk kullanıcıyı (otomatik global admin) oluştur. Bu sayfa bir kullanıcı oluşturulduktan sonra kilitlenir.

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

## Sıradaki Adım

`Membership` rollerinin (familyAdmin/member) gerçek anlamda uygulanması — `$graphLookup` ile "kendisi ve altsoyu" düzenleme kapsamı, admin panelinden kullanıcı/rol yönetimi ekranı.
