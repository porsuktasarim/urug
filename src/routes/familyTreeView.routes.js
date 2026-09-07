const express = require('express');
const FamilyGroup = require('../models/FamilyGroup');
const { buildFamilyTree } = require('../utils/familyTreeBuilder');
const { serializeFamilyNode } = require('../utils/familyTreeSerializer');
const { t } = require('../lang');

const router = express.Router();

router.get('/:id/agac', async (req, res) => {
  const familyGroup = await FamilyGroup.findById(req.params.id);
  if (!familyGroup) {
    return res.status(404).send('Aile bulunamadı.');
  }

  const rootNodes = await buildFamilyTree(familyGroup._id);
  const serializedRoots = rootNodes.map(serializeFamilyNode);

  res.render('family-groups/tree', {
    t,
    familyGroup,
    rootsJson: JSON.stringify(serializedRoots),
    rootCount: serializedRoots.length,
  });
});

module.exports = router;
