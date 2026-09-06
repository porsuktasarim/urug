const express = require('express');
const SiteConfig = require('../models/SiteConfig');
const { requireGlobalAdmin } = require('../middleware/auth');
const { t } = require('../lang');

const router = express.Router();

router.use(requireGlobalAdmin);

router.get('/', async (req, res) => {
  const config = await SiteConfig.findOne();
  res.render('admin/site-settings', { t, config, errorMessage: null });
});

router.post('/', async (req, res) => {
  const { siteName, tagline } = req.body;

  if (!siteName || !siteName.trim()) {
    const config = await SiteConfig.findOne();
    return res.status(400).render('admin/site-settings', {
      t, config, errorMessage: 'Site adı boş bırakılamaz.',
    });
  }

  let config = await SiteConfig.findOne();
  if (!config) config = new SiteConfig();

  config.siteName = siteName.trim();
  config.tagline = tagline && tagline.trim() ? tagline.trim() : null;
  await config.save();

  res.redirect('/ayarlar/site');
});

module.exports = router;
