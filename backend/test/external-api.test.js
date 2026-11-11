const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateDistanceKm,
  mapCommodityToCategory,
  parseArrivalDate,
  toTitleCase,
  normalizeAgmarknetRecord,
  attachCropImagesToRates
} = require('../src/services/externalApiService');
const AuditLog = require('../src/models/AuditLog');
const { getAuditSummary } = require('../src/controllers/auditController');

test('calculateDistanceKm computes Haversine km and ignores unset [0,0] coordinates', () => {
  // Dharwad to Hubballi ~20 km
  const km = calculateDistanceKm([75.0078, 15.4589], [75.124, 15.3647]);
  assert.ok(km > 14 && km < 20, `expected ~16.2 km, got ${km}`);

  assert.equal(calculateDistanceKm([0, 0], [75.124, 15.3647]), null);
  assert.equal(calculateDistanceKm(null, [75.124, 15.3647]), null);
});

test('mapCommodityToCategory classifies Agmarknet commodities accurately', () => {
  assert.equal(mapCommodityToCategory('Wheat'), 'GRAINS');
  assert.equal(mapCommodityToCategory('Black Gram(Urd Beans)(Whole)'), 'PULSES');
  assert.equal(mapCommodityToCategory('Soyabean'), 'OILSEEDS');
  assert.equal(mapCommodityToCategory('Corriander seed'), 'SPICES');
  assert.equal(mapCommodityToCategory('Onion'), 'VEGETABLES');
});

test('parseArrivalDate converts DD/MM/YYYY strings into valid Date objects', () => {
  const d = parseArrivalDate('10/11/2026');
  assert.equal(d.toISOString().slice(0, 10), '2026-11-10');
});

test('getAuditSummary returns zeros instead of hardcoded mock numbers when empty', async () => {
  const origAggregate = AuditLog.aggregate;
  try {
    AuditLog.aggregate = async () => [];
    let body;
    await getAuditSummary({}, { status() { return this; }, json(v) { body = v; } }, (err) => { throw err; });
    assert.equal(body.success, true);
    assert.equal(body.metrics.totalMiddlemanSaved, 0);
    assert.equal(body.metrics.totalDirectVolumeRupees, 0);
    assert.equal(body.metrics.verifiedTransactionsCount, 0);
    assert.equal(body.metrics.complianceRate, '0%');
  } finally {
    AuditLog.aggregate = origAggregate;
  }
});

test('toTitleCase and normalizeAgmarknetRecord support both lowercase and Title-Case Agmarknet schemas', () => {
  assert.equal(toTitleCase('green chilli'), 'Green Chilli');

  const upperRec = normalizeAgmarknetRecord({
    State: 'Uttar Pradesh',
    District: 'Agra',
    Market: 'Agra',
    Commodity: 'Potato',
    Variety: 'Desi',
    Grade: 'FAQ',
    Arrival_Date: '10/11/2026',
    Min_Price: '1200',
    Max_Price: '1600',
    Modal_Price: '1400'
  });

  assert.equal(upperRec.state, 'UTTAR PRADESH');
  assert.equal(upperRec.district, 'AGRA');
  assert.equal(upperRec.marketCenter, 'Agra');
  assert.equal(upperRec.commodity, 'POTATO');
  assert.equal(upperRec.variety, 'Desi');
  assert.equal(upperRec.grade, 'FAQ');
  assert.equal(upperRec.minPrice, 1200);
  assert.equal(upperRec.modalPrice, 1400);
  assert.equal(upperRec.maxPrice, 1600);
  assert.equal(upperRec.category, 'VEGETABLES');
});

test('attachCropImagesToRates deduplicates crop lookups and distinguishes Pine Apple from Apple', async () => {
  const originalFetch = globalThis.fetch;
  const calledUrls = [];

  globalThis.fetch = async (url) => {
    calledUrls.push(String(url));
    const topic = String(url).split('/').pop();
    return {
      ok: true,
      json: async () => ({
        thumbnail: { source: `https://example.org/wiki/${topic}.jpg` }
      })
    };
  };

  try {
    const enriched = await attachCropImagesToRates([
      { commodity: 'APPLE', modalPrice: 6000 },
      { commodity: 'APPLE', modalPrice: 6200 },
      { commodity: 'PINE APPLE', modalPrice: 4500 }
    ]);

    assert.equal(calledUrls.length, 2);
    assert.equal(enriched[0].imageUrl, 'https://example.org/wiki/Apple.jpg');
    assert.equal(enriched[1].imageUrl, 'https://example.org/wiki/Apple.jpg');
    assert.equal(enriched[2].imageUrl, 'https://example.org/wiki/Pineapple.jpg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
