# Uruğ

Self-hosted aile şeceresi uygulaması.

## Durum: Adım 1 — Proje İskeleti

Bu adımda sadece şunlar var:
- Express + MongoDB (Mongoose) bağlantısı
- Dil dosyası altyapısı (`src/lang/tr.js` + `t()` fonksiyonu)
- Docker Compose ile `app` + `mongo` servisleri
- `/health` endpoint'i ile bağlantı doğrulaması

Henüz Person/FamilyGroup gibi hiçbir iş mantığı/şema yok — bunlar sonraki adımlarda eklenecek.

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

Ardından `http://localhost:1207` adresine gidip karşılama sayfasını, `http://localhost:1207/health` adresine gidip bağlantı durumunu görebilirsin.

## Sıradaki Adım

Bkz. proje dokümanı Bölüm 9, Adım 2: FamilyGroup temel CRUD (sadece ad + slug).
