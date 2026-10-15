export function normalizePersonName(value) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru-RU').replace(/(^|[\s\-’'])[\p{L}]/gu, (part) => part.toLocaleUpperCase('ru-RU'));
}
