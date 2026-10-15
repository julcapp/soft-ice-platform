const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePersonName } = require('../src/platform/validation/personName');
test('ФИО нормализуется на сервере с пробелами, дефисами и буквой ё', () => {
  assert.equal(normalizePersonName('  хаов   геннадий ЭДУАРДОВИЧ '), 'Хаов Геннадий Эдуардович');
  assert.equal(normalizePersonName('иванова-петрова анна-мария ёлкина'), 'Иванова-Петрова Анна-Мария Ёлкина');
  assert.equal(normalizePersonName(null), null);
});
