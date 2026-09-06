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

**Yeni: Herkese açık aile sayfası + hikaye + foto galerisi (`/:familySlug`, ör. `/turkeli`):**
- Aile düzenleme formuna (globalAdmin/aile admini, `canEditFamily` izni) **açıklama/hikaye** alanı ve **fotoğraf yükleme** (multer, gerçek dosya — sadece JPEG/PNG/WEBP/GIF, 15MB ham yükleme sınırı, etiket+açıklama ile) eklendi
- **Yüklenen görseller otomatik sıkıştırılıp optimize ediliyor** (sharp): en uzun kenar max 1600px'e küçültülüyor (büyütme yapılmıyor), her zaman WebP'ye çevriliyor — orijinal büyük dosya hiç diske yazılmıyor, sadece optimize edilmiş hali kalıyor (kısıtlı disk alanı için önemli)
- Yüklenen dosyalar `/app/uploads` altında, **kalıcı Docker volume**'de (`urug-uploads`) saklanıyor — container yeniden başlasa/deploy edilse de kaybolmuyor
- Herkese açık `/:familySlug` sayfası: aile hikayesi, foto galerisi, aile bireyleri listesi (profil linkleriyle) gösteriyor
- Aileler listesine "Görüntüle" linki eklendi

**Yeni: Kişi görseli (vesikalık) yükleme:**
- `Person.photo` (sabit 480×640 vesikalık), `photoOriginal` (kırpılmamış, sadece sıkıştırılmış), `photoCropData` eklendi
- Yükleme: sharp ile otomatik **ortadan 3:4 oranında kırpma** + sabit boyuta getirme + WebP sıkıştırma — orijinal de ayrıca (max 2000px, sıkıştırılmış) saklanıyor
- **Elle kırpma**: kişi düzenleme formunda orijinal görsel üzerinde sürüklenebilir bir kutu ile farklı bir alan seçilebiliyor, orijinale dokunmadan sadece vesikalık yeniden üretiliyor
- **Kritik bug düzeltmesi:** `relationships.routes.js` ve `personPhoto.routes.js`'teki `router.use('/:id', ...)` blanket yetki kontrolleri, aynı `/kisiler` prefix'inde mount edilmiş DİĞER router'ların route'larını da (ör. herkese açık olması gereken ağaç görüntüleme sayfasını) yanlışlıkla engelliyordu — gerçek Express testleriyle bulunup düzeltildi, artık her route kendi izin kontrolünü ayrı ayrı uyguluyor

**Yeni: Site Ayarları (`/ayarlar/site`, globalAdmin):** site adı ve slogan — genel temada (yakında) ve Drive yükleme klasörü adında ("`<Site Adı>` Yüklemeleri") kullanılıyor.

**Google Drive'a fotoğraf yükleme — artık ÇOKLU HESAP + web'den OAuth kurulumu:**
- `/ayarlar/drive` (globalAdmin) — OAuth istemci kimliği (Client ID/Secret/Redirect URI) artık `.env`'e gerek kalmadan **web arayüzünden** girilebiliyor (DB'deki değer varsa `.env`'i geçersiz kılar, `.env` sadece ilk kurulum/fallback için kalıyor)
- **Birden fazla Google hesabı bağlanabiliyor** — her biri bir "bağlantı" (`DriveConnection`), kendi etiketi/e-postası ile listeleniyor
- Görsel yüklemeleri her zaman **birincil işaretli TEK bir hesaba** gider (`isPrimaryForImages`) — birincil hesabı admin panelinden değiştirebilirsin
- Yedekleme (gelecek adım) için **birden fazla hesap aynı anda** işaretlenebilir (`useForBackups`) — yedek çeşitliliği için
- Görsel proxy URL'i artık `/uploads/drive/<bağlantıId>/<dosyaId>` formatında — hangi hesaptan çekileceğini biliyor
- Client Secret ve her hesabın refresh token'ı AES-256-GCM ile şifreli saklanıyor
- **Önemli — kırılma değişikliği:** eski tekil `DriveConfig` modeli tamamen kaldırıldı, yerine `DriveConnection` (çoklu) + `GoogleOAuthCredentials` geldi. Eğer daha önce gerçekten bir hesap bağladıysan (test ettiysen), o bağlantı bu güncellemeyle görünmez olur — `/ayarlar/drive`'dan yeniden bağlaman gerekir. Henüz gerçek bir bağlantı kurulmadıysa (bu ortamdan Google'a erişilemediği için sadece kodun mantığı test edildi) etkisi yok.
- Görüntülerken Drive linki hiç istemciye verilmiyor — kendi sunucumuz Drive'dan çekip **proxy** ile akıtıyor (`/uploads/drive/:fileId`), böylece dosyaların "herkese açık" paylaşılmasına gerek kalmıyor
- Bağlı DEĞİLSE otomatik olarak yerel diske düşüyor (mevcut davranış, hiçbir şey bozulmuyor)
- Refresh token AES-256-GCM ile şifreli saklanıyor (TC şifrelemesiyle aynı mekanizma)
- **Kurulum gerektiriyor:** Google Cloud Console'dan bir OAuth istemci kimliği oluşturup `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` ortam değişkenlerini eklemen lazım — detaylar `.env.example`'da
- Not: Kişi fotoğrafları (vesikalık) henüz bu sisteme bağlanmadı, sadece aile fotoğrafları — sıradaki küçük bir adım

**Sırada / bekleyen:**
- **Fotoğraf üzerinde kişi etiketleme** (Facebook tarzı — görsele tıklayınca o noktada arama-ve-seç ile bir Person'a bağlama, `personTags: [{ personId, x, y }]` yüzde bazlı koordinat, görüntülerken hover/tıklayınca isim+profil linki). Not: mevcut serbest-metin `tags` alanı (ör. "düğün", "1980ler") bununla KARIŞTIRILMAMALI — o photo'nun genel etiketi, bu ise görseldeki BELİRLİ BİR KİŞİYİ işaretleme.
- Bir referans siteye (tebakegenea.webflow.io) göre genel tema/yapı yenilenmesi
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
