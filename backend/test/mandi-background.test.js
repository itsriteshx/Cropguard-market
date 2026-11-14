const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../src/services/externalApiService');
const MandiRate = require('../src/models/MandiRate');

test('saved benchmark responds without waiting for a slow external sync', async () => {
  const originalState = mongoose.connection.readyState;
  const originalSync = service.syncAgmarknetRatesToDb;
  const originalFind = MandiRate.findOne;
  const controllerPath = require.resolve('../src/controllers/mandiController');
  try {
    mongoose.connection.readyState = 1;
    service.syncAgmarknetRatesToDb = () => new Promise(() => {});
    delete require.cache[controllerPath];
    const { getBenchmarkForCrop } = require(controllerPath);
    MandiRate.findOne = () => ({ sort: async () => ({ commodity: 'WHEAT', district: 'DHARWAD', marketCenter: 'Dharwad', state: 'KARNATAKA', minPrice: 2000, modalPrice: 2500, maxPrice: 3000, unit: 'QUINTAL', priceDate: new Date('2026-11-10') }) });
    let body;
    const call = getBenchmarkForCrop({ query: { commodity: 'Wheat' } }, { status() { return this; }, json(value) { body = value; } }, (error) => { throw error; });
    let timer;
    await Promise.race([call, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('benchmark waited for external sync')), 300); })]);
    clearTimeout(timer);
    assert.equal(body.success, true);
    assert.equal(body.farmerPriceGuidance.modalRatePerKg, 25);
  } finally {
    mongoose.connection.readyState = originalState;
    service.syncAgmarknetRatesToDb = originalSync;
    MandiRate.findOne = originalFind;
    delete require.cache[controllerPath];
  }
});

test('live feed does not append an unrelated saved snapshot after a failed page request', async () => {
  const originalFetch = service.fetchAgmarknetMandiRates;
  const originalFind = MandiRate.find;
  const controllerPath = require.resolve('../src/controllers/mandiController');
  try {
    service.fetchAgmarknetMandiRates = async () => { throw new Error('live feed unavailable'); };
    MandiRate.find = () => { throw new Error('cached data must not be queried for an appended page'); };
    delete require.cache[controllerPath];
    const { getLiveAgmarknetRates } = require(controllerPath);
    let status, body;
    await getLiveAgmarknetRates({ query: { offset: '10' } }, { status(value) { status = value; return this; }, json(value) { body = value; return this; } }, (error) => { throw error; });
    assert.equal(status, 503);
    assert.equal(body.success, false);
  } finally { service.fetchAgmarknetMandiRates = originalFetch; MandiRate.find = originalFind; delete require.cache[controllerPath]; }
});

test('benchmark converts the recorded price unit before reporting per-kilogram guidance', async () => {
  const original = MandiRate.findOne;
  const { getBenchmarkForCrop } = require('../src/controllers/mandiController');
  try {
    for (const [unit, modal, expected] of [['KG', 25, 25], ['QUINTAL', 2500, 25], ['TON', 25000, 25]]) {
      MandiRate.findOne = () => ({ sort: async () => ({ commodity: 'WHEAT', district: 'DHARWAD', modalPrice: modal, minPrice: modal, maxPrice: modal, unit }) });
      let status, body;
      await getBenchmarkForCrop({ query: { commodity: 'Wheat' } }, { status(value) { status = value; return this; }, json(value) { body = value; } }, (error) => { throw error; });
      assert.equal(status, 200);
      assert.equal(body.farmerPriceGuidance.modalRatePerKg, expected);
      assert.equal(body.apmcRates.modalPricePerQuintal, 2500);
    }
  } finally { MandiRate.findOne = original; }
});
