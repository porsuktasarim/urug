const mongoose = require('mongoose');

/**
 * Role — Membership'in artık sabit bir enum değil, bu koleksiyona
 * referans verdiği yetki tanımı. Admin panelinden (bkz. routes/roles.routes.js)
 * yeni roller tanımlanabilir, mevcut rollerin izinleri düzenlenebilir.
 *
 * scopeType, iznin HANGİ MEKANİZMAYLA hesaplanacağını belirler (bu kısım
 * hâlâ 3 sabit seçenekten biri olmak zorunda, çünkü her biri farklı bir
 * sorgu mantığı gerektiriyor):
 *   - 'global': kapsam yok, izinler her yerde geçerli (ör. Süper Admin)
 *   - 'family': Membership.familyGroupId ile eşleşen ailedeki kişiler
 *   - 'personSubtree': Membership.scopePersonId ve onun tüm altsoyu
 *
 * permissions ise TAMAMEN esnek — admin panelinden açılıp kapatılabilir,
 * yeni bir rol için farklı bir kombinasyon seçilebilir (ör. "sadece
 * fotoğraf ekleyebilen" bir rol gelecekte buraya eklenebilir).
 */
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Rol adı zorunludur.'],
      unique: true,
      trim: true,
    },
    scopeType: {
      type: String,
      enum: ['global', 'family', 'personSubtree'],
      required: true,
    },
    // Sistem rolleri (Süper Admin/Aile Admini/Üye) silinemez ve scopeType'ı
    // değiştirilemez — ama İZİNLERİ yine de düzenlenebilir.
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    permissions: {
      canCreatePeople: { type: Boolean, default: false }, // bağımsız yeni kişi oluşturma
      canEditPeople: { type: Boolean, default: false },
      canDeletePeople: { type: Boolean, default: false },
      canManageRelationships: { type: Boolean, default: false }, // ebeveyn/eş/çocuk bağı kurma-kaldırma
      canEditFamily: { type: Boolean, default: false }, // aile bilgisi/rengi düzenleme
      canViewTc: { type: Boolean, default: false }, // ileride ince taneli TC görünürlüğü için altyapı
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
