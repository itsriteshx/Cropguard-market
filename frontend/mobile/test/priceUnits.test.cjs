const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convertPriceUnit } = require('../src/utils/priceUnits');
test('converts the entered price when switching between kilogram and quintal', () => {
  assert.equal(convertPriceUnit('25', 'KG', 'QUINTAL'), '2500');
  assert.equal(convertPriceUnit('2500', 'QUINTAL', 'KG'), '25');
  assert.equal(convertPriceUnit('', 'KG', 'QUINTAL'), '');
  assert.equal(convertPriceUnit('bad', 'KG', 'QUINTAL'), 'bad');
});
