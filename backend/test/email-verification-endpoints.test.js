const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const emailService = require('../src/services/email/emailService');
const { verifyEmail, resendEmailOtp } = require('../src/controllers/authController');

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

test('verifyEmail: rejects requests with missing email or OTP', async () => {
  const res1 = mockRes();
  await verifyEmail({ body: {} }, res1, () => {});
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.body.success, false);

  const res2 = mockRes();
  await verifyEmail({ body: { email: 'farmer@uasd.agri.in' } }, res2, () => {});
  assert.equal(res2.statusCode, 400);
  assert.equal(res2.body.success, false);
});

test('verifyEmail: successfully verifies email and updates user model', async () => {
  const origVerify = emailService.verifyEmailOtp;
  const origFindOne = User.findOne;

  try {
    emailService.verifyEmailOtp = async () => ({
      success: true,
      message: 'Email verified successfully'
    });

    const mockUser = {
      _id: 'user_123',
      name: 'Ramesh Patil',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210',
      role: 'FARMER',
      phoneVerified: true,
      emailVerified: false,
      isVerified: false,
      syncVerificationState() {
        this.isVerified = this.phoneVerified && this.emailVerified;
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
    await verifyEmail(
      { body: { email: 'Ramesh@UASD.Agri.IN', otp: '123456' } },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.isFullyVerified, true);
    assert.equal(mockUser.emailVerified, true);
    assert.ok(mockUser.emailVerifiedAt instanceof Date);
    assert.ok(res.body.token, 'Should issue full token once phone and email verified');
  } finally {
    emailService.verifyEmailOtp = origVerify;
    User.findOne = origFindOne;
  }
});

test('resendEmailOtp: rejects invalid email or already verified user', async () => {
  const res1 = mockRes();
  await resendEmailOtp({ body: { email: 'invalid-email' } }, res1, () => {});
  assert.equal(res1.statusCode, 400);

  const origFindOne = User.findOne;
  try {
    User.findOne = async () => ({
      emailVerified: true
    });

    const res2 = mockRes();
    await resendEmailOtp({ body: { email: 'already@uasd.agri.in' } }, res2, () => {});
    assert.equal(res2.statusCode, 400);
    assert.match(res2.body.message, /already verified/i);
  } finally {
    User.findOne = origFindOne;
  }
});

test('resendEmailOtp: returns 429 on cooldown and 200 on successful delivery', async () => {
  const origFindOne = User.findOne;
  const origSend = emailService.sendEmailOtp;

  try {
    User.findOne = async () => ({
      _id: 'user_123',
      name: 'Ramesh',
      emailVerified: false
    });

    // 1. Cooldown test
    emailService.sendEmailOtp = async () => ({
      success: false,
      cooldown: true,
      waitSeconds: 45,
      message: 'Please wait 45 seconds'
    });

    const resCooldown = mockRes();
    await resendEmailOtp({ body: { email: 'ramesh@uasd.agri.in' } }, resCooldown, () => {});
    assert.equal(resCooldown.statusCode, 429);
    assert.equal(resCooldown.body.cooldown, true);

    // 2. Successful resend test
    emailService.sendEmailOtp = async () => ({
      success: true,
      maskedEmail: 'r***h@uasd.agri.in',
      resendAvailableAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 600000)
    });

    const resSuccess = mockRes();
    await resendEmailOtp({ body: { email: 'ramesh@uasd.agri.in' } }, resSuccess, () => {});
    assert.equal(resSuccess.statusCode, 200);
    assert.equal(resSuccess.body.success, true);
    assert.equal(resSuccess.body.maskedEmail, 'r***h@uasd.agri.in');
  } finally {
    User.findOne = origFindOne;
    emailService.sendEmailOtp = origSend;
  }
});
