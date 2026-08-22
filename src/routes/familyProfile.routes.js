const express = require('express');
const FamilyGroup = require('../models/FamilyGroup');
const Person = require('../models/Person');
const { t } = require('../lang');
const { displayName, displayNameHtml } = require('../utils/displayName');
const { personProfileUrl } = require('../utils/personLink');
const { formatHistoricalYear } = require('../utils/historicalDateDisplay');

const router = express.Router();

/**
 * GET /:familySlug — TEK segment. Bu router, diğer TÜM sabit tek-segmentli
 * route'lardan (/aileler, /kisiler, /giris, /cikis, /ayarlar, /admin/*,
 * /kurulum-admin, /health) SONRA mount edilmeli (bkz. app.js) — aksi
 * halde ör. bir ailenin slug'ı "giris" olsaydı (nadir ama teorik olarak
 * mümkün) çakışma olurdu. Slug eşleşmezse next() ile 404'e düşer.
 */
router.get('/:familySlug', async (req, res, next) => {
  const familyGroup = await FamilyGroup.findOne({ slug: req.params.familySlug });
  if (!familyGroup) return next();

  const members = await Person.find({ familyGroupId: familyGroup._id })
    .collation({ locale: 'tr' })
    .sort({ officialFirstName: 1 });

  res.render('family-groups/show', {
    t,
    familyGroup,
    members,
    displayName,
    displayNameHtml,
    personProfileUrl,
    formatHistoricalYear,
  });
});

module.exports = router;
