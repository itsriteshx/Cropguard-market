const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProduceListing = require('../src/models/ProduceListing');
const User = require('../src/models/User');

function buildListing(location) {
  return new ProduceListing({
    farmer: new mongoose.Types.ObjectId(),
    cropName: 'Tomato',
    category: 'VEGETABLES',
    quantity: 10,
    unit: 'KG',
    pricePerUnit: 30,
    location
  });
}

describe('ProduceListing location validation', () => {
  test('allows a listing without fabricated GPS coordinates', () => {
    const listing = buildListing({
      type: 'Point',
      village: 'Village A',
      district: 'Dharwad',
      state: 'Karnataka',
      pincode: '580001'
    });

    assert.equal(listing.location.coordinates, undefined);
    assert.equal(listing.validateSync(), undefined);
    assert.equal(listing.location.district, 'Dharwad');
  });

  test('preserves valid longitude and latitude coordinates', () => {
    const coordinates = [75.1, 15.4];

    const listing = buildListing({
      type: 'Point',
      coordinates,
      village: 'Gokak',
      district: 'Belagavi',
      state: 'Karnataka'
    });

    assert.deepEqual(listing.location.coordinates, coordinates);
    assert.equal(listing.validateSync(), undefined);
  });

  test('does not restore zero coordinates when location coordinates are omitted', () => {
    const listing = buildListing({
      type: 'Point',
      district: 'Pune',
      state: 'Maharashtra'
    });

    assert.equal(listing.location.coordinates, undefined);
    assert.equal(listing.validateSync(), undefined);
  });

  test('returns an empty locationName when district is missing', () => {
    const listing = buildListing({ type: 'Point' });

    assert.equal(listing.locationName, '');
  });

  test('builds locationName from taluk and district when available', () => {
    const listing = buildListing({
      type: 'Point',
      taluk: 'Gokak',
      district: 'Belagavi',
      state: 'Karnataka'
    });

    assert.equal(listing.locationName, 'Gokak, Belagavi');
  });
});

describe('User location validation', () => {
  test('does not assign fabricated GPS coordinates to a new user', () => {
    const user = new User({
      name: 'Location Test Farmer',
      phone: '9876543210',
      password: 'securepassword123',
      role: 'FARMER'
    });

    assert.equal(user.location.coordinates, undefined);
    assert.equal(user.validateSync(), undefined);
  });

  test('preserves explicitly supplied user coordinates', () => {
    const coordinates = [73.8567, 18.5204];

    const user = new User({
      name: 'Mapped Test Farmer',
      phone: '9876543211',
      password: 'securepassword123',
      role: 'FARMER',
      location: {
        type: 'Point',
        coordinates,
        district: 'Pune',
        state: 'Maharashtra'
      }
    });

    assert.deepEqual(user.location.coordinates, coordinates);
    assert.equal(user.validateSync(), undefined);
  });
});
