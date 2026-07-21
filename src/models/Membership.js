const mongoose = require('mongoose');

/**
 * Membership — kullanıcının hangi rolde olduğunu tanımlar (bkz. proje
 * dokümanı 3.7 ve 4.8).
 *
 * - globalAdmin: familyGroupId/scopePersonId gerekmez, her şeyi yönetir.
 * - familyAdmin: familyGroupId zorunlu, o ailenin kök ağacındaki her kişiyi düzenleyebilir.
 * - member: scopePersonId zorunlu, kendisi ve o kişinin altsoyunu düzenleyebilir.
 *
 * NOT: Bu adımda sadece "giriş yapmış mı" kontrolü zorlanıyor — rol bazlı
 * ince taneli erişim (familyAdmin/member kapsamı) bir sonraki küçük adımda
 * middleware olarak eklenecek. Şu an her giriş yapmış kullanıcı her şeyi
 * düzenleyebiliyor (globalAdmin gibi davranıyor).
 */
const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['globalAdmin', 'familyAdmin', 'member'],
      required: true,
    },
    familyGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyGroup',
      default: null,
    },
    scopePersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Membership', membershipSchema);
