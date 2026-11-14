const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildListingLocation } = require('../src/utils/listingLocation');

test('rejects missing district or state without injecting hardcoded Navalgund fallback', () => {
  const missingBoth = buildListingLocation({}, null);
  assert.equal(missingBoth.valid, false);
  assert.match(missingBoth.message, /district and state/i);

  const missingState = buildListingLocation({ district: 'Pune', state: '' }, null);
  assert.equal(missingState.valid, false);
});

test('rejects invalid partial pincodes when provided', () => {
  const res = buildListingLocation({ district: 'Pune', state: 'Maharashtra', pincode: '4110' }, null);
  assert.equal(res.valid, false);
  assert.match(res.message, /6-digit pincode/i);
});

test('preserves profile coordinates only when listing district matches profile district', () => {
  const profileLoc = {
    type: 'Point',
    coordinates: [73.8567, 18.5204],
    village: 'Haveli',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001'
  };

  const sameDistrict = buildListingLocation({ district: 'Pune', state: 'Maharashtra', pincode: '411001' }, profileLoc);
  assert.equal(sameDistrict.valid, true);
  assert.deepEqual(sameDistrict.location.coordinates, [73.8567, 18.5204]);
  assert.equal(sameDistrict.location.village, 'Haveli');

  const changedDistrict = buildListingLocation(
    { village: 'Niphad', district: 'Nashik', state: 'Maharashtra', pincode: '422303' },
    profileLoc
  );
  assert.equal(changedDistrict.valid, true);
  assert.deepEqual(changedDistrict.location.coordinates, [0, 0]);
  assert.equal(changedDistrict.location.district, 'Nashik');
});

