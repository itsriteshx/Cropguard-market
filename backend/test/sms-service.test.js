const test = require('node:test');
const assert = require('node:assert/strict');
const VerificationOtp = require('../src/models/VerificationOtp');
const { sendPhoneOtp, verifyPhoneOtp } = require('../src/services/sms/smsService');
const { ConsoleSmsAdapter } = require('../src/services/sms/smsAdapter');

test('sendPhoneOtp: validates 10-digit Indian phone number', async () => {
  const result1 = await sendPhoneOtp({ phone: '12345' });
  assert.equal(result1.success, false);
  assert.match(result1.message, /valid 10-digit Indian mobile/);

  const result2 = await sendPhoneOtp({ phone: '5555555555' }); // Invalid starting digit
  assert.equal(result2.success, false);
  assert.match(result2.message, /starting with 6-9/);
});

test('sendPhoneOtp: creates hashed OTP record and dispatches via adapter', async () => {
  const originalCreate = VerificationOtp.create;
  const originalFindOne = VerificationOtp.findOne;
  let createdDoc = null;

  try {
    VerificationOtp.findOne = () => ({ sort: () => null });
    VerificationOtp.create = async (doc) => {
      createdDoc = doc;
      return { _id: 'phone_otp_1', ...doc };
    };

    const adapter = new ConsoleSmsAdapter();
    const result = await sendPhoneOtp({
      phone: '+91 98765-43210',
      adapter
    });

    assert.equal(result.success, true);
    assert.equal(result.maskedPhone, '******3210');
    assert.ok(createdDoc);
    assert.equal(createdDoc.target, '9876543210');
    assert.equal(createdDoc.type, 'PHONE');
    assert.ok(createdDoc.otpHash);
    assert.equal(createdDoc.otpHash.length, 64);
    assert.equal(adapter.sentMessages.length, 1);
    assert.equal(adapter.sentMessages[0].phone, '9876543210');
    assert.match(adapter.sentMessages[0].message, /verification code/i);
  } finally {
    VerificationOtp.create = originalCreate;
    VerificationOtp.findOne = originalFindOne;
  }
});

test('sendPhoneOtp: enforces cooldown and invalidates previous active OTPs', async () => {
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;

  try {
    // 1. Cooldown test
    VerificationOtp.findOne = () => ({
      sort: () => ({
        resendAvailableAt: new Date(Date.now() + 30000),
        expiresAt: new Date(Date.now() + 600000)
      })
    });

    const cooldownResult = await sendPhoneOtp({ phone: '9876543210' });
    assert.equal(cooldownResult.success, false);
    assert.equal(cooldownResult.cooldown, true);
    assert.ok(cooldownResult.waitSeconds > 0);

    // 2. Cooldown expired -> invalidates old OTPs
    let invalidated = false;
    VerificationOtp.findOne = () => ({
      sort: () => ({
        resendAvailableAt: new Date(Date.now() - 5000),
        expiresAt: new Date(Date.now() + 600000)
      })
    });
    VerificationOtp.updateMany = async () => {
      invalidated = true;
      return { modifiedCount: 1 };
    };
    VerificationOtp.create = async (doc) => ({ _id: 'new_doc', ...doc });

    const adapter = new ConsoleSmsAdapter();
    const resendResult = await sendPhoneOtp({ phone: '9876543210', adapter });
    assert.equal(resendResult.success, true);
    assert.equal(invalidated, true);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});

test('sendPhoneOtp: handles SMS provider delivery failure safely', async () => {
  const originalFindOne = VerificationOtp.findOne;
  const originalCreate = VerificationOtp.create;
  const originalUpdateOne = VerificationOtp.updateOne;
  let markedConsumedId = null;

  try {
    VerificationOtp.findOne = () => ({ sort: () => null });
    VerificationOtp.create = async (doc) => ({ _id: 'failing_phone_otp', ...doc });
    VerificationOtp.updateOne = async (f) => {
      markedConsumedId = f._id;
      return { modifiedCount: 1 };
    };

    const failingAdapter = {
      send: async () => { throw new Error('Gateway timeout'); }
    };

    const result = await sendPhoneOtp({
      phone: '9876543210',
      adapter: failingAdapter
    });

    assert.equal(result.success, false);
    assert.equal(result.deliveryFailed, true);
    assert.equal(markedConsumedId, 'failing_phone_otp');
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.create = originalCreate;
    VerificationOtp.updateOne = originalUpdateOne;
  }
});

test('verifyPhoneOtp: verifies valid code, consumes atomically, prevents reuse', async () => {
  const { hashOtp } = require('../src/utils/otpUtils');
  const originalFindOne = VerificationOtp.findOne;
  const originalFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  const phone = '9876543210';
  const otp = '842910';
  const otpHash = hashOtp(otp, phone);
  let isConsumed = false;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => {
        if (isConsumed) return null;
        return {
          _id: 'active_phone_otp',
          target: phone,
          type: 'PHONE',
          otpHash,
          expiresAt: new Date(Date.now() + 600000),
          attempts: 0,
          maxAttempts: 5,
          consumedAt: null
        };
      }
    });

    VerificationOtp.findOneAndUpdate = async (q, u) => {
      if (q.consumedAt === null && !isConsumed) {
        isConsumed = true;
        return { _id: 'active_phone_otp', consumedAt: new Date() };
      }
      return null;
    };

    // 1. Valid OTP succeeds
    const successResult = await verifyPhoneOtp({ phone: '+91 98765 43210', otp });
    assert.equal(successResult.success, true);
    assert.match(successResult.message, /verified successfully/i);

    // 2. Reused OTP fails
    const reuseResult = await verifyPhoneOtp({ phone, otp });
    assert.equal(reuseResult.success, false);
    assert.match(reuseResult.message, /No active verification code/i);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('verifyPhoneOtp: handles expired code and tracks incorrect attempts', async () => {
  const { hashOtp } = require('../src/utils/otpUtils');
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateOne = VerificationOtp.updateOne;
  const originalFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  const phone = '9876543210';
  const correctOtp = '555222';
  const otpHash = hashOtp(correctOtp, phone);

  try {
    // 1. Expired code test
    VerificationOtp.findOne = () => ({
      sort: () => ({
        _id: 'expired_otp',
        target: phone,
        otpHash,
        expiresAt: new Date(Date.now() - 5000),
        attempts: 0,
        maxAttempts: 5,
        consumedAt: null
      })
    });
    VerificationOtp.updateOne = async () => ({ modifiedCount: 1 });

    const expiredResult = await verifyPhoneOtp({ phone, otp: correctOtp });
    assert.equal(expiredResult.success, false);
    assert.equal(expiredResult.expired, true);

    // 2. Incorrect attempt counter test
    VerificationOtp.findOne = () => ({
      sort: () => ({
        _id: 'attempt_otp',
        target: phone,
        otpHash,
        expiresAt: new Date(Date.now() + 600000),
        attempts: 1,
        maxAttempts: 5,
        consumedAt: null
      })
    });
    VerificationOtp.findOneAndUpdate = async (q, u) => ({
      _id: 'attempt_otp',
      attempts: 2
    });

    const incorrectResult = await verifyPhoneOtp({ phone, otp: '000000' });
    assert.equal(incorrectResult.success, false);
    assert.equal(incorrectResult.attemptsRemaining, 3);
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateOne = originalUpdateOne;
    VerificationOtp.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
