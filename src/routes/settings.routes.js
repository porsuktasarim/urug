const express = require('express');
const { requireGlobalAdmin } = require('../middleware/auth');
const { t } = require('../lang');

const router = express.Router();

router.get('/', requireGlobalAdmin, (req, res) => {
  res.render('admin/settings', { t });
});

module.exports = router;
