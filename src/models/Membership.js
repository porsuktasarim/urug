const mongoose = require('mongoose');

/**
 * Membership — kullanıcının hangi ROLE'e (bkz. models/Role.js) ve hangi
 * kapsama (familyGroupId ya da scopePersonId, rolün scopeType'ına göre)
 * sahip olduğunu tanımlar.
 *
 * NOT (geriye dönük uyumluluk): `role` alanı eski sabit-enum tasarımdan
 * kalma, artık kullanılmıyor ama eski kayıtları migrate edebilmek için
 * (bkz. config/migrateMembershipRoles.js) şemada tutuluyor. Yeni kodun
 * TAMAMI roleId + populate edilmiş Role üzerinden çalışmalı.
 */
const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null, // migration tamamlanana kadar geçici olarak boş olabilir
    },
    // ESKİ ALAN — sadece migration kaynağı, yeni kodda okunmamalı.
    role: {
      type: String,
      enum: ['globalAdmin', 'familyAdmin', 'member'],
      default: null,
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
