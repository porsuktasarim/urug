# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug039 itibarıyla)

**Yetki Modeli artık ince taneli:**
- **globalAdmin**: her şeyi düzenler (kişi özellikleri, aileler, kullanıcılar dahil)
- **familyAdmin**: sadece kendisine atanmış ailedeki kişileri düzenleyebilir
- **member**: sadece kendisine atanmış kişiyi VE onun tüm altsoyunu (çocuk, torun...) düzenleyebilir
- Yeni bağımsız kişi oluşturma (`/kisiler/new`) sadece globalAdmin + familyAdmin'e açık — üyeler akrabalık bağı üzerinden (Baba/Anne/Eş/Çocuk Ekle akışı) yeni kişi ekleyebilir, bu da o an düzenleme yetkisi olan "anchor" kişiye bağlı
- **Aile yönetimi (`/aileler`) artık sadece globalAdmin'e açık** (önceden herhangi bir giriş yapmış kullanıcı yönetebiliyordu) — Kişi Özellikleri'yle tutarlı hale getirildi
- **Yeni: Kullanıcı Yönetimi ekranı** (`/admin/kullanicilar`, globalAdmin) — kullanıcı oluşturma + rol/kapsam atama artık mümkün, ilk admin dışında kullanıcı ekleme yolu açıldı

**Diğer tamamlanan işler (özet):** Temel altyapı, FamilyGroup (ad/slug/renk), AttributeDefinition (sıralanabilir çekirdek+özel alanlar), Person (göbek adı, doğum/ölüm tarihi + Hicri/Rumi/Miladi, TC şifreleme, aile opsiyonel, doğum/mezar yeri), slug+arama, ParentChild/Union ilişkileri (otomatik cinsiyet/sülale ataması), Kişi Kartı (QR kod, mini kartlar), **D3 ağaç render** (nesil derinliği seçilebilir, tıklayınca büyüyen kart), genel görsel tema (turuncu/adaçayı/krem/antrasit paleti).

**Ayarlar sayfası (`/ayarlar`, globalAdmin):** Kişi Özellikleri, Kullanıcılar ve Aileler yönetimi artık tek bir "Ayarlar" sayfası altında toplandı — üst menüde ayrı ayrı görünmüyorlar, sadece bir dişli (gear) ikonuyla erişiliyor. Hesap göstergesi (kullanıcı adı) de artık kişi ikonu + açılır menü (dropdown), Giriş/Çıkış da simge. Renk paleti: `#ff7f11` (turuncu, vurgu) / `#acbfa4` (adaçayı yeşili, ikincil) / `#e2e8ce` (krem, zemin) / `#262626` (antrasit, metin/navbar) — bkz. `src/public/css/theme.css`.

**Sırada / bekleyen:**
- Aile hikaye/açıklama alanı + foto galerisi
- Kişi görseli yükleme
- Bir referans siteye (tebakegenea.webflow.io) göre genel tema/yapı yenilenmesi — yukarıdaki iki madde bittikten sonra
- Genel/tüm-kayıtlı-kişileri-gösteren ağaç görünümü (şu an sadece kişi bazlı odaklı ağaç var)
- A0 rulo PDF export, ana sayfa özet blokları, RSS/XML, yedekleme sistemi

## Ortam Değişkenleri

```
MONGO_URI=mongodb://mongo:27017/urug
TC_ENCRYPTION_KEY=<64 hex karakter>
TC_HMAC_SECRET=<rastgele uzun metin>
SESSION_SECRET=<rastgele uzun metin>
BASE_URL=<opsiyonel, ör. https://secere.aile.com — QR kodların tam adres üretmesi için>
```

## İlk Kurulum

`/kurulum-admin` adresinden ilk kullanıcıyı (otomatik global admin) oluştur. Sonraki kullanıcıları `/admin/kullanicilar` üzerinden ekle.

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
