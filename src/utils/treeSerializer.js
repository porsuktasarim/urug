const { displayNameHtml } = require('./displayName');
const { formatHistoricalYear } = require('./historicalDateDisplay');
const { personProfileUrl } = require('./personLink');

/**
 * Bir Person Mongoose dokümanını D3 tarafında kullanılacak düz/JSON-güvenli
 * bir objeye çevirir (Mongoose doküman referansları/circular yapı JSON.stringify
 * ile sorun çıkarabileceği için).
 */
function serializePerson(person, isFocal) {
  return {
    id: String(person._id),
    nameHtml: displayNameHtml(person),
    birthLabel: person.birthYear ? formatHistoricalYear(person.birthYear) : null,
    deathLabel: person.deathYear ? formatHistoricalYear(person.deathYear) : null,
    color: person.familyGroupId && person.familyGroupId.colorCode ? person.familyGroupId.colorCode : '#94a3b8',
    url: personProfileUrl(person),
    isFocal: !!isFocal,
  };
}

/**
 * buildDescendantNode() çıktısını (recursive { person, spouses, children })
 * D3'ün d3.hierarchy() ile doğrudan kullanabileceği JSON yapısına çevirir.
 */
function serializeDescendantNode(node, focalId) {
  return {
    ...serializePerson(node.person, String(node.person._id) === String(focalId)),
    spouses: node.spouses.map((s) => serializePerson(s, false)),
    children: node.children.map((c) => serializeDescendantNode(c, focalId)),
  };
}

/**
 * buildAncestorNode() çıktısını (recursive { person, father, mother })
 * D3 hiyerarşisi için "children: [father, mother]" biçimine çevirir —
 * üst soy da böylece aynı d3.hierarchy() mantığıyla render edilebilir,
 * sadece yönü (yukarı) frontend'de ters çevrilir.
 */
function serializeAncestorNode(node, focalId) {
  const children = [];
  if (node.father) children.push(serializeAncestorNode(node.father, focalId));
  if (node.mother) children.push(serializeAncestorNode(node.mother, focalId));

  return {
    ...serializePerson(node.person, String(node.person._id) === String(focalId)),
    children,
  };
}

module.exports = { serializePerson, serializeDescendantNode, serializeAncestorNode };
