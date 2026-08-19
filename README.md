# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum (urug041 itibarıyla)

**Yetki Modeli artık GERÇEKTEN düzenlenebilir (Role koleksiyonu):**
- Roller artık sabit 3 seçenek değil, `Role` koleksiyonunda tutulan, admin panelinden düzenlenebilir/yeni eklenebilir kayıtlar (`/admin/roller`)
- Her rolün bir **kapsam tipi** (`global` / `family` / `personSubtree` — mekanizma sabit, çünkü her biri farklı sorgu mantığı gerektiriyor) ve açılıp kapanabilen **izinleri** var: yeni kişi oluşturma, kişi düzenleme, kişi silme, akrabalık bağı yönetme, aile düzenleme, TC görme
- 3 sistem rolü (**Süper Admin**/global, **Aile Admini**/family, **Üye**/personSubtree) önceden tanımlı geliyor — adları/kapsam tipleri kilitli ama **izinleri düzenlenebiliyor**. İstenirse tamamen yeni bir rol de eklenebiliyor (ör. "sadece görsel ekleyebilen" bir rol)
- `Membership` artık sabit `role` string'i yerine `roleId` (Role referansı) kullanıyor — eski kayıtlar uygulama açılışında otomatik migrate ediliyor
- Kullanıcı ekleme/düzenleme ekranı artık rolleri **dinamik olarak** `Role` koleksiyonundan çekiyor, yeni bir rol eklersen otomatik seçeneklerde çıkıyor

**Diğer tamamlanan işler (özet):** Temel altyapı, FamilyGroup (ad/slug/renk), AttributeDefinition (sıralanabilir çekirdek+özel alanlar), Person (göbek adı, doğum/ölüm tarihi + Hicri/Rumi/Miladi, TC şifreleme, aile opsiyonel, doğum/mezar yeri), slug+arama, ParentChild/Union ilişkileri (otomatik cinsiyet/sülale ataması), Kişi Kartı (QR kod, mini kartlar), D3 ağaç render (nesil derinliği seçilebilir, tıklayınca büyüyen kart), genel görsel tema (turuncu/adaçayı/krem/antrasit paleti).

**Ayarlar sayfası (`/ayarlar`, globalAdmin):** Kişi Özellikleri, Kullanıcılar, Roller ve Aileler yönetimi tek bir "Ayarlar" sayfası altında — üst menüde sadece bir dişli (gear) ikonuyla erişiliyor. Hesap göstergesi kişi ikonu + açılır menü (dropdown), Giriş/Çıkış da simge. Renk paleti: `#ff7f11` (turuncu, vurgu) / `#acbfa4` (adaçayı yeşili, ikincil) / `#e2e8ce` (krem, zemin) / `#262626` (antrasit, metin/navbar) — bkz. `src/public/css/theme.css`.

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
