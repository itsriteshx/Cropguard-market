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
