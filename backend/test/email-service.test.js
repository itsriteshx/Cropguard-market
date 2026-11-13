const test = require('node:test');
const assert = require('node:assert/strict');
const VerificationOtp = require('../src/models/VerificationOtp');
const { sendEmailOtp, verifyEmailOtp } = require('../src/services/email/emailService');
const { ConsoleEmailAdapter } = require('../src/services/email/emailAdapter');

test('sendEmailOtp: creates hashed OTP, delivers via adapter, returns masked email', async () => {
  const originalCreate = VerificationOtp.create;
  const originalFindOne = VerificationOtp.findOne;
  let createdPayload = null;

  try {
    VerificationOtp.findOne = () => ({ sort: () => null });
    VerificationOtp.create = async (payload) => {
      createdPayload = payload;
      return { _id: 'otp_123', ...payload };
    };

    const adapter = new ConsoleEmailAdapter();
    const result = await sendEmailOtp({
      email: 'Ramesh.Patil@uasd.agri.in',
      name: 'Ramesh Patil',
      adapter
    });

    assert.equal(result.success, true);
    assert.equal(result.maskedEmail, 'r***l@uasd.agri.in');
    assert.ok(createdPayload);
    assert.equal(createdPayload.target, 'ramesh.patil@uasd.agri.in');
    assert.equal(createdPayload.type, 'EMAIL');
    assert.ok(createdPayload.otpHash);
    assert.equal(createdPayload.otpHash.length, 64); // SHA-256 hex
    assert.equal(adapter.sentEmails.length, 1);
    assert.equal(adapter.sentEmails[0].to, 'ramesh.patil@uasd.agri.in');
    assert.match(adapter.sentEmails[0].subject, /Verification Code/);
  } finally {
    VerificationOtp.create = originalCreate;
    VerificationOtp.findOne = originalFindOne;
  }
});

test('sendEmailOtp: enforces cooldown if requested before cooldown period', async () => {
  const originalFindOne = VerificationOtp.findOne;
  try {
    const futureDate = new Date(Date.now() + 45000); // 45s remaining cooldown
    VerificationOtp.findOne = () => ({
      sort: () => ({
        resendAvailableAt: futureDate,
        expiresAt: new Date(Date.now() + 500000)
      })
    });

    const result = await sendEmailOtp({ email: 'farmer@uasd.agri.in' });
    assert.equal(result.success, false);
    assert.equal(result.cooldown, true);
    assert.ok(result.waitSeconds > 0);
    assert.match(result.message, /wait/i);
  } finally {
    VerificationOtp.findOne = originalFindOne;
  }
});

test('sendEmailOtp: invalidates previous active OTPs on resend after cooldown expires', async () => {
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;
  let invalidatedQuery = null;

  try {
    const pastDate = new Date(Date.now() - 5000);
    VerificationOtp.findOne = () => ({
      sort: () => ({
        resendAvailableAt: pastDate,
        expiresAt: new Date(Date.now() + 300000)
      })
    });
    VerificationOtp.updateMany = async (query) => {
      invalidatedQuery = query;
      return { modifiedCount: 1 };
    };
    VerificationOtp.create = async (payload) => ({ _id: 'new_otp', ...payload });

    const adapter = new ConsoleEmailAdapter();
    const result = await sendEmailOtp({ email: 'farmer@uasd.agri.in', adapter });

    assert.equal(result.success, true);
    assert.ok(invalidatedQuery);
    assert.equal(invalidatedQuery.target, 'farmer@uasd.agri.in');
    assert.equal(invalidatedQuery.consumedAt, null);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});

test('sendEmailOtp: handles email delivery adapter failure safely', async () => {
  const originalFindOne = VerificationOtp.findOne;
  const originalCreate = VerificationOtp.create;
  const originalUpdateOne = VerificationOtp.updateOne;
  let markedConsumedId = null;

  try {
    VerificationOtp.findOne = () => ({ sort: () => null });
    VerificationOtp.create = async (payload) => ({ _id: 'failing_otp', ...payload });
    VerificationOtp.updateOne = async (filter) => {
      markedConsumedId = filter._id;
      return { modifiedCount: 1 };
    };

    const failingAdapter = {
      send: async () => { throw new Error('SMTP connection refused'); }
    };

    const result = await sendEmailOtp({
      email: 'failing@uasd.agri.in',
      adapter: failingAdapter
    });

    assert.equal(result.success, false);
    assert.equal(result.deliveryFailed, true);
    assert.equal(markedConsumedId, 'failing_otp');
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.create = originalCreate;
    VerificationOtp.updateOne = originalUpdateOne;
  }
});

test('verifyEmailOtp: verifies valid code, consumes atomically, prevents reuse', async () => {
  const { hashOtp } = require('../src/utils/otpUtils');
  const originalFindOne = VerificationOtp.findOne;
  const originalFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  const email = 'farmer.success@uasd.agri.in';
  const otp = '654321';
  const otpHash = hashOtp(otp, email);

  let isConsumed = false;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => {
        if (isConsumed) return null;
        return {
          _id: 'active_otp',
          target: email,
          type: 'EMAIL',
          otpHash,
          expiresAt: new Date(Date.now() + 600000),
          attempts: 0,
          maxAttempts: 5,
          consumedAt: null
        };
      }
    });

    VerificationOtp.findOneAndUpdate = async (query, update) => {
      if (query.consumedAt === null && !isConsumed) {
        isConsumed = true;
        return { _id: 'active_otp', consumedAt: new Date() };
      }
      return null;
    };

    // 1. First verification with correct OTP succeeds
    const firstAttempt = await verifyEmailOtp({ email, otp });
    assert.equal(firstAttempt.success, true);
    assert.match(firstAttempt.message, /verified successfully/i);

    // 2. Re-attempting with the same OTP fails (single-use enforced)
    const secondAttempt = await verifyEmailOtp({ email, otp });
    assert.equal(secondAttempt.success, false);
    assert.match(secondAttempt.message, /No active verification code/i);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('verifyEmailOtp: rejects expired code and enforces max attempts limit', async () => {
  const { hashOtp } = require('../src/utils/otpUtils');
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateOne = VerificationOtp.updateOne;
  const originalFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  const email = 'farmer.expired@uasd.agri.in';
  const correctOtp = '999111';
  const otpHash = hashOtp(correctOtp, email);

  try {
    // 1. Expired test
    VerificationOtp.findOne = () => ({
      sort: () => ({
        _id: 'expired_otp',
        target: email,
        otpHash,
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        attempts: 0,
        maxAttempts: 5,
        consumedAt: null
      })
    });
    VerificationOtp.updateOne = async () => ({ modifiedCount: 1 });

    const expiredResult = await verifyEmailOtp({ email, otp: correctOtp });
    assert.equal(expiredResult.success, false);
    assert.equal(expiredResult.expired, true);

    // 2. Incorrect OTP attempt count increment test
    VerificationOtp.findOne = () => ({
      sort: () => ({
        _id: 'attempt_otp',
        target: email,
        otpHash,
        expiresAt: new Date(Date.now() + 600000),
        attempts: 2,
        maxAttempts: 5,
        consumedAt: null
      })
    });
    VerificationOtp.findOneAndUpdate = async (q, u) => ({
      _id: 'attempt_otp',
      attempts: 3
    });

    const incorrectResult = await verifyEmailOtp({ email, otp: '000000' });
    assert.equal(incorrectResult.success, false);
    assert.equal(incorrectResult.attemptsRemaining, 2);
    assert.match(incorrectResult.message, /2 attempt\(s\) remaining/);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateOne = originalUpdateOne;
    VerificationOtp.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
