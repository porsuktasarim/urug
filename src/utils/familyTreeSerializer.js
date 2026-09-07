const { displayNameHtml } = require('./displayName');
const { formatHistoricalYear } = require('./historicalDateDisplay');
const { personProfileUrl } = require('./personLink');

/**
 * buildFamilyTree() çıktısındaki bir düğümü (person + extraLines + children)
 * D3'ün d3.hierarchy() ile kullanabileceği JSON-güvenli yapıya çevirir.
 */
function serializeFamilyNode(node) {
  return {
    id: String(node.person._id),
    nameHtml: displayNameHtml(node.person),
    birthLabel: node.person.birthYear ? formatHistoricalYear(node.person.birthYear) : null,
    deathLabel: node.person.deathYear ? formatHistoricalYear(node.person.deathYear) : null,
    color: node.person.familyGroupId && node.person.familyGroupId.colorCode
      ? node.person.familyGroupId.colorCode
      : '#94a3b8',
    url: personProfileUrl(node.person),
    extraLines: node.extraLines.map((line) => ({
      label: line.label,
      nameHtml: displayNameHtml(line.person),
      duplicateNote: line.duplicateNote,
    })),
    children: node.children.map(serializeFamilyNode),
  };
}

module.exports = { serializeFamilyNode };
