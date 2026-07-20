/**
 * Dinamik (isSystem=false) AttributeDefinition alanları için ortak
 * form işleme mantığı. Kişi formunda (ve ileride başka formlarda,
 * ör. aile) tekrar kullanılabilsin diye ayrı dosyada tutuluyor.
 */

/**
 * Form body'sinden (req.body) "attr_<key>" öneki ile gelen değerleri
 * ayıklar ve { key: value } şeklinde düz bir obje döner.
 * multiselect/checkbox gibi çoklu değerler dizi olarak gelebilir.
 */
function extractAttributeValues(definitions, body) {
  const values = {};

  definitions.forEach((def) => {
    const fieldName = `attr_${def.key}`;

    if (def.type === 'boolean') {
      values[def.key] = body[fieldName] === 'on';
      return;
    }

    if (def.type === 'multiselect') {
      const raw = body[fieldName];
      values[def.key] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
      return;
    }

    if (body[fieldName] !== undefined && body[fieldName] !== '') {
      values[def.key] = body[fieldName];
    }
  });

  return values;
}

/**
 * Koşullu zorunluluk dahil, dinamik alanların zorunluluk kontrolünü yapar.
 *
 * @param {Array} definitions - aktif, isSystem=false AttributeDefinition listesi
 * @param {Object} attributeValues - extractAttributeValues() çıktısı
 * @param {Object} contextValues - dependsOn başka bir sistem alanına
 *   (ör. hasNoLastName) işaret ediyorsa referans alınacak değerler
 * @returns {string|null} ilk hata mesajı, hata yoksa null
 */
function validateAttributes(definitions, attributeValues, contextValues = {}) {
  for (const def of definitions) {
    let isRequiredNow = def.isRequired;

    if (def.conditionalRequirement && def.conditionalRequirement.dependsOn) {
      const { dependsOn, requiredWhen } = def.conditionalRequirement;
      const dependsOnValue = Object.prototype.hasOwnProperty.call(attributeValues, dependsOn)
        ? attributeValues[dependsOn]
        : contextValues[dependsOn];

      isRequiredNow = dependsOnValue === requiredWhen;
    }

    if (!isRequiredNow) continue;

    const value = attributeValues[def.key];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      return `"${def.label}" zorunludur.`;
    }
  }

  return null;
}

module.exports = { extractAttributeValues, validateAttributes };
