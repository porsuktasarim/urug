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
 * yani her "dal"ın aile içindeki en tepesi. Birden fazla kök olabilir.
 *
 * ÖNEMLİ (iki ebeveyn de aile içindeyse): bir çocuğun HEM babası HEM
 * annesi bu ailedeyse (ör. aynı sülale içinde önceki bir evlilik/akrabalık),
 * ağaç yapısı gereği çocuk sadece TEK bir ebeveynin altına (kim önce
 * işlendiyse) yerleştirilir — ama DİĞER ebeveyn sessizce kaybolmaz:
 * çocuğun kartına "Baba: ..." / "Anne: ..." metni olarak eklenir, VE o
 * ebeveynin kendi düğümü de ağaçta varsa "ağaçta ayrıca yer alıyor" notu
 * ile işaretlenir (bkz. duplicateNote).
 *
 * Eş için de aynı mantık: bir kişi hem kendi soyuyla (bir dalın düğümü
 * olarak) HEM de başka birinin eşi olarak (aile-içi evlilik/kuzen
 * evliliği) ağaçta "görünecekse", ikinci durumda ayrı düğüm AÇILMAZ —
 * her iki tarafa da "ağaçta ayrıca ... olarak da yer alıyor" notu eklenir.
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
  const traversalParentOf = new Map(); // childId -> yapısal (ağaçta gösterilen) ebeveynin id'si

  async function buildNode(person, arrivedViaParentId) {
    const idStr = String(person._id);
    visited.add(idStr);
    if (arrivedViaParentId) traversalParentOf.set(idStr, arrivedViaParentId);

    const node = { person, extraLines: [], children: [], _spouseRefs: [] };
    nodesById.set(idStr, node);

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
    const childLinks = await ParentChild.find({ parentId: person._id }).populate({
      path: 'childId',
      populate: { path: 'familyGroupId' },
    });
    const inFamilyChildren = childLinks
      .map((l) => l.childId)
      .filter((c) => familyMemberIds.has(String(c._id)) && !visited.has(String(c._id)));

    const sortedChildren = sortYoungestFirst(inFamilyChildren);
    for (const child of sortedChildren) {
      if (visited.has(String(child._id))) continue; // başka bir dalda zaten işlendi
      const childNode = await buildNode(child, idStr);
      node.children.push(childNode);
    }

    return node;
  }

  const rootNodes = [];
  for (const root of sortYoungestFirst(roots)) {
    if (visited.has(String(root._id))) continue;
    rootNodes.push(await buildNode(root, null));
  }

  // İkinci geçiş A: her düğüm için, ağaç YAPISINDA gösterilmeyen "diğer"
  // ebeveyni (varsa) extraLine olarak ekle — aile içi ya da dışı fark
  // etmeksizin. Aile içiyse ve kendi düğümü varsa duplicateNote=true.
  const personCache = new Map(allFamilyMembers.map((p) => [String(p._id), p]));
  for (const [idStr, node] of nodesById) {
    const entry = parentMap.get(idStr);
    if (!entry) continue;

    const traversalParentId = traversalParentOf.get(idStr) || null;
    const candidates = [
      { side: 'Baba', id: entry.fatherId },
      { side: 'Anne', id: entry.motherId },
    ].filter((c) => c.id && c.id !== traversalParentId);

    for (const candidate of candidates) {
      let otherPerson = personCache.get(candidate.id);
      if (!otherPerson) {
        otherPerson = await Person.findById(candidate.id).populate('familyGroupId');
        if (otherPerson) personCache.set(candidate.id, otherPerson);
      }
      if (!otherPerson) continue;

      node.extraLines.push({
        label: candidate.side,
        person: otherPerson,
        duplicateNote: nodesById.has(candidate.id),
      });
    }
  }

  // İkinci geçiş B: eş bilgilerini extraLines'a işle.
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
