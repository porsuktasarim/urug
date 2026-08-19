const FamilyGroup = require('../models/FamilyGroup');
const { getOrAssignFamilyColor } = require('../utils/familyColor');

/**
 * Uygulama her açıldığında çalışır (idempotent). Henüz elle renk
 * seçilmemiş (colorCode boş) tüm aileler için benzersiz rastgele bir
 * renk atayıp kalıcı hale getirir — böylece ağaç görselinde/kart
 * tasarımında her ailenin her zaman bir rengi olduğu garanti edilir.
 */
async function migrateFamilyColors() {
  const familiesWithoutColor = await FamilyGroup.find({
    $or: [{ colorCode: null }, { colorCode: { $exists: false } }],
  });

  for (const familyGroup of familiesWithoutColor) {
    await getOrAssignFamilyColor(familyGroup); // içeride kaydediyor
  }

  if (familiesWithoutColor.length > 0) {
    console.log(`[migrate] ${familiesWithoutColor.length} aileye otomatik renk atandı.`);
  }
}

module.exports = { migrateFamilyColors };
