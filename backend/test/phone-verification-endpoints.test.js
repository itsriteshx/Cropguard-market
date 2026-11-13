const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const smsService = require('../src/services/sms/smsService');
const { verifyPhone, resendPhoneOtp } = require('../src/controllers/authController');

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
};

test('verifyPhone: rejects requests with missing phone or OTP', async () => {
  const res1 = mockRes();
  await verifyPhone({ body: {} }, res1, () => {});
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.body.success, false);

  const res2 = mockRes();
  await verifyPhone({ body: { phone: '9876543210' } }, res2, () => {});
  assert.equal(res2.statusCode, 400);
  assert.equal(res2.body.success, false);
});

test('verifyPhone: successfully verifies phone and updates user model', async () => {
  const origVerify = smsService.verifyPhoneOtp;
  const origFindOne = User.findOne;

  try {
    smsService.verifyPhoneOtp = async () => ({
      success: true,
      message: 'Mobile number verified successfully'
    });

    const mockUser = {
      _id: 'user_phone_123',
      name: 'Mallikarjun Patil',
      phone: '9845012345',
      role: 'FARMER',
      phoneVerified: false,
      emailVerified: false,
      isVerified: false,
      syncVerificationState() {
        this.isVerified = this.phoneVerified && (!this.email || this.emailVerified);
      },
      getVerificationStatus() {
        return {
          isVerified: this.isVerified,
          phoneVerified: this.phoneVerified,
          emailVerified: this.emailVerified,
          pending: []
        };
      },
      save: async () => true
    };

    User.findOne = async () => mockUser;

    const res = mockRes();
    await verifyPhone(
      { body: { phone: '+91 98450-12345', otp: '789123' } },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.isFullyVerified, true);
    assert.equal(mockUser.phoneVerified, true);
    assert.ok(mockUser.phoneVerifiedAt instanceof Date);
    assert.ok(res.body.token, 'Should issue token once phone is verified for user without email');
  } finally {
    smsService.verifyPhoneOtp = origVerify;
    User.findOne = origFindOne;
  }
});

test('resendPhoneOtp: rejects invalid phone or already verified user', async () => {
  const res1 = mockRes();
  await resendPhoneOtp({ body: { phone: '123' } }, res1, () => {});
  assert.equal(res1.statusCode, 400);

  const origFindOne = User.findOne;
  try {
    User.findOne = async () => ({
      phoneVerified: true
    });

    const res2 = mockRes();
    await resendPhoneOtp({ body: { phone: '9876543210' } }, res2, () => {});
    assert.equal(res2.statusCode, 400);
    assert.match(res2.body.message, /already verified/i);
  } finally {
    User.findOne = origFindOne;
  }
});

test('resendPhoneOtp: returns 429 on cooldown and 200 on successful delivery', async () => {
  const origFindOne = User.findOne;
  const origSend = smsService.sendPhoneOtp;

  try {
    User.findOne = async () => ({
      _id: 'user_456',
      phone: '9876543210',
      phoneVerified: false
    });

    // 1. Cooldown
    smsService.sendPhoneOtp = async () => ({
      success: false,
      cooldown: true,
      waitSeconds: 50,
      message: 'Please wait 50 seconds'
    });

    const resCooldown = mockRes();
    await resendPhoneOtp({ body: { phone: '9876543210' } }, resCooldown, () => {});
    assert.equal(resCooldown.statusCode, 429);
    assert.equal(resCooldown.body.cooldown, true);

    // 2. Success
    smsService.sendPhoneOtp = async () => ({
      success: true,
      maskedPhone: '******3210',
      resendAvailableAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 600000)
    });

    const resSuccess = mockRes();
    await resendPhoneOtp({ body: { phone: '9876543210' } }, resSuccess, () => {});
    assert.equal(resSuccess.statusCode, 200);
    assert.equal(resSuccess.body.success, true);
    assert.equal(resSuccess.body.maskedPhone, '******3210');
  } finally {
    User.findOne = origFindOne;
    smsService.sendPhoneOtp = origSend;
  }
});
