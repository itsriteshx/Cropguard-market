const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  normalizeEmail,
  normalizePhone,
  toE164,
  maskEmail,
  maskPhone
} = require('../src/utils/otpUtils');

test('generateSecureOtp: generates random numeric string of requested length', () => {
  const otp6 = generateSecureOtp(6);
  assert.equal(otp6.length, 6);
  assert.match(otp6, /^\d{6}$/);

  const otp4 = generateSecureOtp(4);
  assert.equal(otp4.length, 4);
  assert.match(otp4, /^\d{4}$/);

  // Generates different values across multiple calls
  const set = new Set();
  for (let i = 0; i < 20; i++) {
    set.add(generateSecureOtp(6));
  }
  assert.ok(set.size > 1, 'Secure OTP generator should produce diverse random numbers');
});

test('hashOtp and verifyOtpHash: cryptographic integrity and target binding', () => {
  const otp = '482910';
  const email = 'farmer@uasd.agri.in';
  const phone = '9876543210';

  const hashEmail = hashOtp(otp, email);
  const hashPhone = hashOtp(otp, phone);

  // Different targets produce different hashes even with identical OTP
  assert.notEqual(hashEmail, hashPhone);

  // Correct verification succeeds
  assert.equal(verifyOtpHash(otp, hashEmail, email), true);
  assert.equal(verifyOtpHash(otp, hashPhone, phone), true);

  // Incorrect OTP fails
  assert.equal(verifyOtpHash('123456', hashEmail, email), false);

  // Cross-target replay fails (trying to use email OTP hash with phone)
  assert.equal(verifyOtpHash(otp, hashEmail, phone), false);

  // Invalid / empty inputs fail safely without throwing
  assert.equal(verifyOtpHash('', hashEmail, email), false);
  assert.equal(verifyOtpHash(otp, '', email), false);
  assert.equal(verifyOtpHash(null, hashEmail, email), false);
  assert.equal(verifyOtpHash(otp, 'invalid_hex', email), false);
});

test('normalizeEmail: trims and converts to lowercase', () => {
  assert.equal(normalizeEmail('  RAMESH@UASD.Agri.IN  '), 'ramesh@uasd.agri.in');
  assert.equal(normalizeEmail(''), '');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(undefined), '');
});

test('normalizePhone and toE164: standardizes Indian phone numbers', () => {
  assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizePhone('919876543210'), '9876543210');
  assert.equal(normalizePhone('+91 (98765)-43210'), '9876543210');

  assert.equal(toE164('9876543210'), '+919876543210');
  assert.equal(toE164('+91 98765-43210'), '+919876543210');
  assert.equal(toE164('invalid'), '');
});

test('maskEmail and maskPhone: safely obscures sensitive identifiers', () => {
  assert.equal(maskEmail('ramesh.patil@uasd.agri.in'), 'r***l@uasd.agri.in');
  assert.equal(maskEmail('ab@example.com'), 'a***@example.com');
  assert.equal(maskEmail(''), '***');

  assert.equal(maskPhone('9876543210'), '******3210');
  assert.equal(maskPhone('+91 98765 43210'), '******3210');
  assert.equal(maskPhone('123'), '******');
});
