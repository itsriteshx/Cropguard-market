const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const MandiRate = require('../src/models/MandiRate');
const { enrichListings } = require('../src/controllers/listingController');

test('listing enrichment preserves farmer photos and labels illustrative images', async () => {
  const originalState = mongoose.connection.readyState;
  const originalFind = MandiRate.find;
  const originalFetch = global.fetch;
  let calls = 0;
  try {
    mongoose.connection.readyState = 1;
    MandiRate.find = () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return [{ commodity: 'WHEAT', modalPrice: 2500, unit: 'QUINTAL', marketCenter: 'Dharwad' }]; } });
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ thumbnail: { source: 'https://example.org/wheat.jpg' } }) }; };
    const results = await enrichListings([
      { cropName: 'Wheat', images: ['/uploads/actual.jpg'] },
      { cropName: 'Wheat', images: [] }
    ]);
    assert.equal(results[0].imageSource, 'farmer');
    assert.equal(results[0].resolvedImageUrl, '/uploads/actual.jpg');
    assert.deepEqual(results[0].images, ['/uploads/actual.jpg']);
    assert.equal(results[1].imageSource, 'illustrative');
    assert.deepEqual(results[1].images, []);
    assert.equal(results[1].benchmarkUnit, 'QUINTAL');
    assert.equal(calls, 1);
  } finally { mongoose.connection.readyState = originalState; MandiRate.find = originalFind; global.fetch = originalFetch; }
});
