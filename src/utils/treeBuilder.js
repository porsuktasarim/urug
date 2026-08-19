const Person = require('../models/Person');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');

/**
 * Alt soy (descendant) ağacını recursive olarak kurar. Her düğüm kendi
 * eşlerini de taşır (kart üzerinde göstermek için), ama eşler ayrı bir
 * "children" dalı OLUŞTURMAZ — sadece görsel referans.
 *
 * Çocuklar, "en küçük (en genç) solda, en büyük (en yaşlı) sağda" kuralına
 * göre sıralanır — yani doğum yılına göre AZALAN sırada (en yüksek yıl,
 * yani en genç, önce/solda).
 */
async function buildDescendantNode(personId, remainingGenerations) {
  const person = await Person.findById(personId).populate('familyGroupId');
  if (!person) return null;

  const spouses = await getSpouses(personId);

  const node = { person, spouses, children: [] };

  if (remainingGenerations <= 0) return node;

  const childLinks = await ParentChild.find({ parentId: personId }).populate('childId');
  const childPersons = childLinks.map((l) => l.childId);

  // Yaşa göre soldan sağa: en küçük (en genç, en yüksek doğum yılı) solda.
  const sortedChildren = sortYoungestFirst(childPersons);

  for (const childPerson of sortedChildren) {
    const childNode = await buildDescendantNode(childPerson._id, remainingGenerations - 1);
    if (childNode) node.children.push(childNode);
  }

  return node;
}

/**
 * Üst soy (ancestor) ağacını recursive olarak kurar. Her düğümün en fazla
 * 2 dalı vardır: father, mother.
 */
async function buildAncestorNode(personId, remainingGenerations) {
  const person = await Person.findById(personId).populate('familyGroupId');
  if (!person) return null;

  const node = { person, father: null, mother: null };

  if (remainingGenerations <= 0) return node;

  const parentLinks = await ParentChild.find({ childId: personId });
  const fatherLink = parentLinks.find((l) => l.parentSide === 'father');
  const motherLink = parentLinks.find((l) => l.parentSide === 'mother');

  if (fatherLink) {
    node.father = await buildAncestorNode(fatherLink.parentId, remainingGenerations - 1);
  }
  if (motherLink) {
    node.mother = await buildAncestorNode(motherLink.parentId, remainingGenerations - 1);
  }

  return node;
}

async function getSpouses(personId) {
  const unions = await Union.find({
    $or: [{ personAId: personId }, { personBId: personId }],
  }).populate(['personAId', 'personBId']);

  return unions.map((u) =>
    String(u.personAId._id) === String(personId) ? u.personBId : u.personAId
  );
}

/**
 * "En küçük (en genç) solda, en büyük (en yaşlı) sağda" kuralı: doğum
 * yılına göre AZALAN sırada (yüksek yıl = genç = önce). Yılı bilinmeyenler
 * en sona (en sağa) düşer.
 */
function sortYoungestFirst(persons) {
  return [...persons].sort((a, b) => {
    const ay = a.birthYear;
    const by = b.birthYear;
    if (ay == null && by == null) return 0;
    if (ay == null) return 1;
    if (by == null) return -1;
    return by - ay; // azalan
  });
}

module.exports = { buildDescendantNode, buildAncestorNode, getSpouses, sortYoungestFirst };
