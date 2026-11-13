const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const VerificationOtp = require('../src/models/VerificationOtp');
const { hashOtp, verifyOtpHash, generateSecureOtp } = require('../src/utils/otpUtils');
const { verifyEmailOtp, sendEmailOtp } = require('../src/services/email/emailService');
const { verifyPhoneOtp, sendPhoneOtp } = require('../src/services/sms/smsService');
const { getJwtSecret } = require('../src/config/jwtSecret');
const { protect } = require('../src/middleware/authMiddleware');
const { register } = require('../src/controllers/authController');

test('security hardening: concurrent verification requests enforce atomic single-use consumption', async () => {
  const email = 'concurrent.farmer@uasd.agri.in';
  const otp = '765432';
  const otpHash = hashOtp(otp, email);

  // In-memory atomic state emulator
  let persistedOtp = {
    _id: 'otp_atomic_1',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => (persistedOtp.consumedAt ? null : persistedOtp)
    });

    // Atomic conditional write emulation: matches { _id, consumedAt: null }
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === persistedOtp._id && filter.consumedAt === null && !persistedOtp.consumedAt) {
        persistedOtp = { ...persistedOtp, consumedAt: update.$set.consumedAt };
        return persistedOtp;
      }
      return null;
    };

    // Fire two concurrent verification calls simultaneously with Promise.all
    const [result1, result2] = await Promise.all([
      verifyEmailOtp({ email, otp }),
      verifyEmailOtp({ email, otp })
    ]);

    // Exactly one must succeed and one must fail
    const successes = [result1, result2].filter((r) => r.success);
    const failures = [result1, result2].filter((r) => !r.success);

    assert.equal(successes.length, 1, 'Only one concurrent verification must succeed');
    assert.equal(failures.length, 1, 'Losing concurrent verification must be rejected');
    assert.ok(persistedOtp.consumedAt instanceof Date, 'OTP record must be marked consumed');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test('security hardening: cross-target OTP replay attack is mathematically prevented by HMAC binding', () => {
  const otp = '849201';
  const victimPhone = '9876543210';
  const attackerPhone = '9123456789';
  const legitimateEmail = 'farmer@uasd.agri.in';

  const hashForEmail = hashOtp(otp, legitimateEmail);
  const hashForVictim = hashOtp(otp, victimPhone);

  // Attacker attempting to verify attackerPhone with victim's OTP
  assert.equal(verifyOtpHash(otp, hashForVictim, attackerPhone), false);

  // Attacker attempting to verify phone with email's OTP
  assert.equal(verifyOtpHash(otp, hashForEmail, victimPhone), false);
});

test('security hardening: brute force lockout after max attempts exceeded', async () => {
  const phone = '9876543210';
  const correctOtp = '654321';
  const otpHash = hashOtp(correctOtp, phone);

  let doc = {
    _id: 'brute_otp',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // 1 attempt remaining before lockout
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  const origUpdateOne = VerificationOtp.updateOne;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => doc
    });

    // Atomic pipeline emulator: reaching maxAttempts sets consumedAt in the same database operation
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === doc._id && filter.consumedAt === null) {
        if (filter.attempts && filter.attempts.$lt && doc.attempts >= filter.attempts.$lt) {
          return null;
        }
        const newAttempts = doc.attempts + 1;
        const newConsumedAt = newAttempts >= doc.maxAttempts ? new Date() : doc.consumedAt;
        doc = { ...doc, attempts: newAttempts, consumedAt: newConsumedAt };
        return doc;
      }
      return null;
    };

    VerificationOtp.updateOne = async () => ({ modifiedCount: 1 });

    // 1st wrong attempt -> reaches max attempts (5) and immediately sets consumedAt
    const res1 = await verifyPhoneOtp({ phone, otp: '000000' });
    assert.equal(res1.success, false);
    assert.equal(res1.attemptsRemaining, 0);
    assert.ok(doc.consumedAt instanceof Date, 'The final incorrect attempt must immediately set consumedAt');

    // 2nd wrong attempt -> rejected as max attempts exceeded
    const res2 = await verifyPhoneOtp({ phone, otp: '000000' });
    assert.equal(res2.success, false);
    assert.equal(res2.maxAttemptsExceeded, true);
    assert.match(res2.message, /too many incorrect attempts/i);

    // Correct OTP cannot succeed after maximum incorrect attempts
    const resCorrect = await verifyPhoneOtp({ phone, otp: correctOtp });
    assert.equal(resCorrect.success, false);
    assert.equal(resCorrect.maxAttemptsExceeded, true);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

test('security hardening: duplicate registration prevents account collisions', async () => {
  const origFindOne = User.findOne;
  try {
    // 1. Existing phone
    User.findOne = async (q) => {
      if (q.phone) return { _id: 'existing_phone' };
      return null;
    };

    const res1 = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };

    await register(
      { body: { name: 'Duplicate User', phone: '9876543210', password: 'password123' } },
      res1,
      () => {}
    );
    assert.equal(res1.statusCode, 400);
    assert.match(res1.body.message, /phone number already exists/i);

    // 2. Existing email
    User.findOne = async (q) => {
      if (q.email) return { _id: 'existing_email' };
      return null;
    };

    const res2 = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };

    await register(
      { body: { name: 'Duplicate Email', phone: '9876543211', email: 'exist@uasd.agri.in', password: 'password123' } },
      res2,
      () => {}
    );
    assert.equal(res2.statusCode, 400);
    assert.match(res2.body.message, /email already exists/i);
  } finally {
    User.findOne = origFindOne;
  }
});

test('security hardening: privilege escalation block - unverified accounts cannot access order endpoints', async () => {
  const origFindById = User.findById;
  try {
    User.findById = () => ({
      select: async () => ({
        _id: 'farmer_1',
        role: 'FARMER',
        isVerified: false,
        phoneVerified: false,
        syncVerificationState: () => false
      })
    });

    const token = jwt.sign({ id: 'farmer_1', role: 'FARMER' }, getJwtSecret());
    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/orders',
      url: '/api/orders'
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };

    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.requiresVerification, true);
  } finally {
    User.findById = origFindById;
  }
});
