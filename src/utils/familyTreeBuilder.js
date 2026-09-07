const Person = require('../models/Person');
const ParentChild = require('../models/ParentChild');
const Union = require('../models/Union');
const { sortYoungestFirst } = require('./treeBuilder');

/**
 * Bir ailenin (familyGroupId) TÜM üyelerini kapsayan çok-köklü bir ağaç
 * kurar. Kişi bazlı ağaçtan (treeBuilder.js) farkı: burada "dışarıdan"
 * gelenler (eş, aile dışı ebeveyn) AYRI BİR DÜĞÜM almaz — bağlı oldukları
 * aile üyesinin kartı İÇİNDE metin satırı olarak gösterilir (ör.
 * "Baba: Katiloğulları Uğur Türkeli", "Eşi: Banu (Yüksel) Değirmenci").
 *
 * Kök(ler): bu ailedeki, anne VE babası da bu ailede OLMAYAN kişiler —
 * yani her "dal"ın aile içindeki en tepesi. Birden fazla kök olabilir
 * (aynı aile adını taşıyan ama akraba olduğu bilinmeyen ayrı hatlar gibi).
 *
 * Eğer bir kişi hem kendi soyuyla (bir dalın düğümü olarak) HEM de
 * başka birinin eşi olarak (aile-içi evlilik/kuzen evliliği) ağaçta
 * "görünecekse", ikinci durumda ayrı düğüm AÇILMAZ — bunun yerine hem
 * kendi düğümüne hem eşinin kartındaki metne "ağaçta ayrıca ... olarak
 * da yer alıyor" notu eklenir (bkz. serializer'daki duplicateNote).
 *
 * @param {string} familyGroupId
 * @returns {Promise<Array>} kök düğümlerin dizisi: { person, extraLines, children }
 */
async function buildFamilyTree(familyGroupId) {
  const allFamilyMembers = await Person.find({ familyGroupId }).populate('familyGroupId');
  const familyMemberIds = new Set(allFamilyMembers.map((p) => String(p._id)));

  if (allFamilyMembers.length === 0) return [];

  const parentLinks = await ParentChild.find({
    childId: { $in: [...familyMemberIds] },
  });

  // childId -> { fatherId, motherId } (aile içi olsun olmasın, HAM bağlar)
  const parentMap = new Map();
  parentLinks.forEach((link) => {
    const cid = String(link.childId);
    if (!parentMap.has(cid)) parentMap.set(cid, {});
    const entry = parentMap.get(cid);
    if (link.parentSide === 'father') entry.fatherId = String(link.parentId);
    else entry.motherId = String(link.parentId);
  });

  const roots = allFamilyMembers.filter((p) => {
    const entry = parentMap.get(String(p._id));
    const fatherInFamily = entry && entry.fatherId && familyMemberIds.has(entry.fatherId);
    const motherInFamily = entry && entry.motherId && familyMemberIds.has(entry.motherId);
    return !fatherInFamily && !motherInFamily;
  });

  const nodesById = new Map();
  const visited = new Set();

  async function buildNode(person) {
    const idStr = String(person._id);
    visited.add(idStr);

    const node = { person, extraLines: [], children: [], _spouseRefs: [] };
    nodesById.set(idStr, node);

    // Aile DIŞI ebeveyn(ler) — metin olarak.
    const entry = parentMap.get(idStr);
    if (entry) {
      if (entry.fatherId && !familyMemberIds.has(entry.fatherId)) {
        const father = await Person.findById(entry.fatherId).populate('familyGroupId');
        if (father) node.extraLines.push({ label: 'Baba', person: father, duplicateNote: false });
      }
      if (entry.motherId && !familyMemberIds.has(entry.motherId)) {
        const mother = await Person.findById(entry.motherId).populate('familyGroupId');
        if (mother) node.extraLines.push({ label: 'Anne', person: mother, duplicateNote: false });
      }
    }

    // Eş(ler) — hepsi metin olarak eklenir; aile-içiyse ikinci geçişte
    // "ayrıca kendi soyuyla da yer alıyor" notu eklenecek.
    const unions = await Union.find({
      $or: [{ personAId: person._id }, { personBId: person._id }],
    }).populate([
      { path: 'personAId', populate: { path: 'familyGroupId' } },
      { path: 'personBId', populate: { path: 'familyGroupId' } },
    ]);
    unions.forEach((u) => {
      const spouse = String(u.personAId._id) === idStr ? u.personBId : u.personAId;
      node._spouseRefs.push(spouse);
    });

    // Çocuklar — SADECE bu aileye ait olanlar düğüm olarak eklenir.
    const childLinks = await ParentChild.find({ parentId: person._id }).populate('childId');
    const inFamilyChildren = childLinks
      .map((l) => l.childId)
      .filter((c) => familyMemberIds.has(String(c._id)) && !visited.has(String(c._id)));

    const sortedChildren = sortYoungestFirst(inFamilyChildren);
    for (const child of sortedChildren) {
      if (visited.has(String(child._id))) continue; // başka bir dalda zaten işlendi
      const childNode = await buildNode(child);
      node.children.push(childNode);
    }

    return node;
  }

  const rootNodes = [];
  for (const root of sortYoungestFirst(roots)) {
    if (visited.has(String(root._id))) continue;
    rootNodes.push(await buildNode(root));
  }

  // İkinci geçiş: eş bilgilerini extraLines'a işle. Aile-içi eşler
  // (kendi düğümü de var) için HER İKİ tarafa da "ayrıca ... olarak
  // da yer alıyor" notu eklenir.
  nodesById.forEach((node) => {
    node._spouseRefs.forEach((spouse) => {
      const spouseIdStr = String(spouse._id);
      const spouseHasOwnNode = nodesById.has(spouseIdStr);
      node.extraLines.push({ label: 'Eşi', person: spouse, duplicateNote: spouseHasOwnNode });
    });
    delete node._spouseRefs;
  });

  return rootNodes;
}

module.exports = { buildFamilyTree };
