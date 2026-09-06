const express = require('express');
const MigrationOrigin = require('../models/MigrationOrigin');
const Person = require('../models/Person');
const { requireLogin } = require('../middleware/auth');
const { displayName, displayNameHtml } = require('../utils/displayName');
const { formatHistoricalYear } = require('../utils/historicalDateDisplay');
const { personProfileUrl } = require('../utils/personLink');
const {
  getShortLabel,
  getFromFullLabel,
  getToFullLabel,
  buildSlugBase,
} = require('../utils/migrationOriginDisplay');
const { t } = require('../lang');

const router = express.Router();

async function ensureUniqueSlug(base, excludeId) {
  let candidate = base;
  let attempt = 0;
  while (true) {
    const clash = await MigrationOrigin.findOne({ slug: candidate, _id: { $ne: excludeId } });
    if (!clash) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }
}

// Arama — kişi formunda "var olan mübadele kaydını seç" akışı için.
// Türkçe karakterler için toLocaleLowerCase('tr-TR') kullanılır (proje kalıbı).
router.get('/api/ara', requireLogin, async (req, res) => {
  const q = (req.query.q || '').trim().toLocaleLowerCase('tr-TR');
  if (q.length < 2) return res.json({ results: [] });

  const all = await MigrationOrigin.find().limit(200);
  const matches = all.filter((o) => {
    const combined = [
      o.fromEyalet, o.fromSancak, o.fromKaza, o.fromKoy,
      o.toIl, o.toIlce, o.toKasaba, o.toKoyMahalle,
    ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    return combined.includes(q);
  }).slice(0, 10);

  res.json({
    results: matches.map((o) => ({
      id: o._id,
      label: `${getFromFullLabel(o)}  →  ${getToFullLabel(o)}`,
      shortLabel: getShortLabel(o),
    })),
  });
});

// Yeni mübadele kaydı oluşturma — kişi formundan "+ Yeni Ekle" ile çağrılır.
router.post('/', requireLogin, async (req, res) => {
  const { fromEyalet, fromSancak, fromKaza, fromKoy, toIl, toIlce, toKasaba, toKoyMahalle } = req.body;

  const hasFrom = [fromEyalet, fromSancak, fromKaza, fromKoy].some((v) => v && v.trim());
  const hasTo = [toIl, toIlce, toKasaba, toKoyMahalle].some((v) => v && v.trim());

  if (!hasFrom || !hasTo) {
    return res.status(400).send('En az bir "nereden" ve bir "nereye" alanı doldurulmalı.');
  }

  const data = {
    fromEyalet: fromEyalet && fromEyalet.trim() ? fromEyalet.trim() : null,
    fromSancak: fromSancak && fromSancak.trim() ? fromSancak.trim() : null,
    fromKaza: fromKaza && fromKaza.trim() ? fromKaza.trim() : null,
    fromKoy: fromKoy && fromKoy.trim() ? fromKoy.trim() : null,
    toIl: toIl && toIl.trim() ? toIl.trim() : null,
    toIlce: toIlce && toIlce.trim() ? toIlce.trim() : null,
    toKasaba: toKasaba && toKasaba.trim() ? toKasaba.trim() : null,
    toKoyMahalle: toKoyMahalle && toKoyMahalle.trim() ? toKoyMahalle.trim() : null,
  };

  const slugBase = buildSlugBase(data);
  const slug = await ensureUniqueSlug(slugBase, null);

  const origin = await MigrationOrigin.create({ ...data, slug });

  // Kişi formundan fetch() ile çağrılıyorsa (yeni pencere/yönlendirme
  // olmadan inline oluşturma), JSON dön.
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ id: origin._id, shortLabel: getShortLabel(origin) });
  }

  res.redirect(`/mubadele/${origin.slug}`);
});

// Mübadele kaydının kendi sayfası — o yerden gelen tüm kişileri listeler.
router.get('/:slug', async (req, res, next) => {
  const origin = await MigrationOrigin.findOne({ slug: req.params.slug });
  if (!origin) return next();

  const members = await Person.find({ migrationOriginId: origin._id })
    .populate('familyGroupId')
    .collation({ locale: 'tr' })
    .sort({ officialFirstName: 1 });

  res.render('migration-origins/show', {
    t,
    origin,
    members,
    fromFullLabel: getFromFullLabel(origin),
    toFullLabel: getToFullLabel(origin),
    displayName,
    displayNameHtml,
    formatHistoricalYear,
    personProfileUrl,
  });
});

module.exports = router;
