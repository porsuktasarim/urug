const express = require('express');
const Person = require('../models/Person');
const { buildAncestorNode, buildDescendantNode, getSpouses } = require('../utils/treeBuilder');
const { serializeAncestorNode, serializeDescendantNode, serializePerson } = require('../utils/treeSerializer');
const { t } = require('../lang');
const { displayName } = require('../utils/displayName');

const router = express.Router();

const DEFAULT_UP = 3;
const DEFAULT_DOWN = 3;
const MAX_GENERATIONS = 6; // performans/okunabilirlik için makul bir üst sınır

router.get('/:id/agac', async (req, res) => {
  const focalPerson = await Person.findById(req.params.id).populate('familyGroupId');
  if (!focalPerson) {
    return res.status(404).send('Kişi bulunamadı.');
  }

  const upGenerations = clampGenerations(req.query.ustNesil, DEFAULT_UP);
  const downGenerations = clampGenerations(req.query.altNesil, DEFAULT_DOWN);

  const ancestorNode = await buildAncestorNode(focalPerson._id, upGenerations);
  const descendantNode = await buildDescendantNode(focalPerson._id, downGenerations);
  const focalSpouses = await getSpouses(focalPerson._id);

  const treeData = {
    focal: serializePerson(focalPerson, true),
    focalSpouses: focalSpouses.map((s) => serializePerson(s, false)),
    // Üst soy: focalPerson'ın kendisi hem ancestorNode'un kökü hem descendantNode'un
    // kökü olarak iki ayrı ağaçta tekrar görünüyor — frontend'de görsel olarak
    // sadece bir kere (ortada) çizilecek, ikisi de aynı focal node'a "bağlanacak".
    ancestorTree: ancestorNode ? serializeAncestorNode(ancestorNode, focalPerson._id) : null,
    descendantTree: descendantNode ? serializeDescendantNode(descendantNode, focalPerson._id) : null,
  };

  res.render('persons/tree', {
    t,
    focalPersonName: displayName(focalPerson),
    focalPersonId: String(focalPerson._id),
    upGenerations,
    downGenerations,
    maxGenerations: MAX_GENERATIONS,
    treeDataJson: JSON.stringify(treeData),
  });
});

function clampGenerations(rawValue, defaultValue) {
  const n = Number(rawValue);
  if (!rawValue || Number.isNaN(n) || n < 0) return defaultValue;
  return Math.min(n, MAX_GENERATIONS);
}

module.exports = router;
