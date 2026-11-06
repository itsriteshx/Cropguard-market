const test = require('node:test');
const assert = require('node:assert/strict');
const Listing = require('../src/models/ProduceListing');
const { getAllListings } = require('../src/controllers/listingController');

test('listing search matches literal crop or district text across pages', async () => {
  const originalCount = Listing.countDocuments;
  const originalFind = Listing.find;
  let query;
  let skip;
  let limit;
  try {
    Listing.countDocuments = async (value) => { query = value; return 21; };
    Listing.find = () => ({
      populate() { return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      sort() { return Promise.resolve([{ cropName: 'Onion' }]); }
    });
    let result;
    await getAllListings({ query: { search: '  a.*  ', category: 'grains', page: '2', limit: '10' } }, { status() { return this; }, json(value) { result = value; } }, (err) => { throw err; });
    assert.equal(query.category, 'GRAINS');
    assert.deepEqual(query.$or, [{ cropName: { $regex: 'a\\.\\*', $options: 'i' } }, { 'location.district': { $regex: 'a\\.\\*', $options: 'i' } }]);
    assert.equal(skip, 10);
    assert.equal(limit, 10);
    assert.equal(result.pages, 3);
  } finally { Listing.countDocuments = originalCount; Listing.find = originalFind; }
});

test('listing pagination rejects invalid pages and oversized limits', async () => {
  for (const query of [{ page: '0' }, { limit: '101' }, { page: 'abc' }]) {
    let status;
    await getAllListings({ query }, { status(value) { status = value; return this; }, json() {} }, (err) => { throw err; });
    assert.equal(status, 400);
  }
});
