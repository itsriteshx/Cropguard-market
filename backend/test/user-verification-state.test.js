const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');

test('User schema initializes with independent unverified states by default', () => {
  const user = new User({
    name: 'New Farmer',
    phone: '9876543210',
    email: 'newfarmer@uasd.agri.in',
    password: 'password123',
    role: 'FARMER'
  });

  assert.equal(user.isVerified, false);
  assert.equal(user.phoneVerified, false);
  assert.equal(user.emailVerified, false);
  assert.equal(user.phoneVerifiedAt, null);
  assert.equal(user.emailVerifiedAt, null);

  const status = user.getVerificationStatus();
  assert.equal(status.isVerified, false);
  assert.deepEqual(status.pending.sort(), ['email', 'phone']);
});

test('User verification independence: phone verified does not automatically verify email', async () => {
  const user = new User({
    name: 'Dual Channel User',
    phone: '9876543211',
    email: 'dual@uasd.agri.in',
    password: 'password123',
    role: 'BUYER_RETAIL'
  });

  user.phoneVerified = true;
  user.phoneVerifiedAt = new Date();
  await user.validate();

  // Emulate pre-save trigger
  const status = user.getVerificationStatus();
  assert.equal(status.phoneVerified, true);
  assert.equal(status.emailVerified, false);
  assert.deepEqual(status.pending, ['email']);
});

test('User verification independence: email verified does not automatically verify phone', async () => {
  const user = new User({
    name: 'Dual Channel User',
    phone: '9876543212',
    email: 'dual2@uasd.agri.in',
    password: 'password123',
    role: 'BUYER_RETAIL'
  });

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.validate();

  const status = user.getVerificationStatus();
  assert.equal(status.emailVerified, true);
  assert.equal(status.phoneVerified, false);
  assert.deepEqual(status.pending, ['phone']);
});

test('User without email becomes fully verified once phone is verified', () => {
  const user = new User({
    name: 'Phone Only Farmer',
    phone: '9876543213',
    password: 'password123',
    role: 'FARMER'
  });

  user.phoneVerified = true;
  user.phoneVerifiedAt = new Date();
  user.syncVerificationState();

  assert.equal(user.isVerified, true);
  const status = user.getVerificationStatus();
  assert.equal(status.isVerified, true);
  assert.deepEqual(status.pending, []);
});

test('Legacy compatibility: pre-existing user with isVerified: true synchronizes flags', () => {
  const legacyUser = new User({
    name: 'Legacy Seed User',
    phone: '9876543214',
    email: 'legacy@uasd.agri.in',
    password: 'password123',
    role: 'FARMER',
    isVerified: true
  });

  legacyUser.syncVerificationState();

  assert.equal(legacyUser.isVerified, true);
  assert.equal(legacyUser.phoneVerified, true);
  assert.equal(legacyUser.emailVerified, true);
  assert.ok(legacyUser.phoneVerifiedAt instanceof Date);
  assert.ok(legacyUser.emailVerifiedAt instanceof Date);
  assert.deepEqual(legacyUser.getVerificationStatus().pending, []);
});
