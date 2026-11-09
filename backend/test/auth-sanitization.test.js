const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');

test('User schema pre-validate hook normalizes +91, 0, and spaces in phone numbers', () => {
  const user1 = new User({
    name: 'Ramesh Test',
    phone: '+91 98765 43210',
    password: 'securepassword123',
    role: 'FARMER'
  });
  user1.validateSync();
  assert.equal(user1.phone, '9876543210');

  const user2 = new User({
    name: 'Suresh Test',
    phone: '09876543210',
    password: 'securepassword123',
    role: 'FARMER'
  });
  user2.validateSync();
  assert.equal(user2.phone, '9876543210');

  const user3 = new User({
    name: 'Kavitha Test',
    phone: '919876543210',
    password: 'securepassword123',
    role: 'BUYER_RETAIL'
  });
  user3.validateSync();
  assert.equal(user3.phone, '9876543210');

  const user4 = new User({
    name: 'Formatted Mobile',
    phone: '+91 83404-76122',
    password: 'securepassword123',
    role: 'FARMER'
  });
  user4.validateSync();
  assert.equal(user4.phone, '8340476122');
});

test('User schema treats empty string email as undefined to avoid index conflicts', () => {
  const user = new User({
    name: 'No Email Farmer',
    phone: '9876543219',
    email: '   ',
    password: 'securepassword123',
    role: 'FARMER'
  });
  user.validateSync();
  assert.equal(user.email, undefined);
});
