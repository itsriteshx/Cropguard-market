const test = require('node:test');
const assert = require('node:assert/strict');
const Listing = require('../src/models/ProduceListing');
const { createListing } = require('../src/controllers/listingController');

async function runCreateListing(userLocation, submittedLocation) {
  const originalCreate = Listing.create;
  let createdDocument;

  try {
    Listing.create = async (document) => {
      createdDocument = document;
      return document;
    };

    let response;
    const req = {
      user: {
        _id: 'farmer-test-id',
        location: userLocation
      },
      body: {
        cropName: 'Tomato',
        category: 'VEGETABLES',
        quantity: 10,
        pricePerUnit: 30,
        ...(submittedLocation !== undefined
          ? { location: submittedLocation }
          : {})
      }
    };

    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        response = value;
        return this;
      }
    };

    await createListing(req, res, (error) => {
      throw error;
    });

    assert.equal(res.statusCode, 201);
    assert.equal(response.success, true);
    return createdDocument.location;
  } finally {
    Listing.create = originalCreate;
  }
}

test('listing creation removes legacy zero coordinates from farmer profile fallback', async () => {
  const location = await runCreateListing({
    type: 'Point',
    coordinates: [0, 0],
    village: 'Village A',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001'
  });

  assert.equal(location.type, 'Point');
  assert.equal(location.coordinates, undefined);
  assert.equal(location.village, 'Village A');
  assert.equal(location.district, 'Pune');
  assert.equal(location.state, 'Maharashtra');
  assert.equal(location.pincode, '411001');
});

test('listing creation preserves genuine farmer profile coordinates', async () => {
  const coordinates = [73.8567, 18.5204];

  const location = await runCreateListing({
    type: 'Point',
    coordinates,
    district: 'Pune',
    state: 'Maharashtra'
  });

  assert.deepEqual(location.coordinates, coordinates);
});

test('submitted listing location takes precedence over farmer profile location', async () => {
  const submittedCoordinates = [75.1, 15.4];

  const location = await runCreateListing(
    {
      type: 'Point',
      coordinates: [0, 0],
      district: 'Old District',
      state: 'Old State'
    },
    {
      type: 'Point',
      coordinates: submittedCoordinates,
      district: 'Belagavi',
      state: 'Karnataka'
    }
  );

  assert.deepEqual(location.coordinates, submittedCoordinates);
  assert.equal(location.district, 'Belagavi');
  assert.equal(location.state, 'Karnataka');
});
