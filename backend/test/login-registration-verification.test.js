const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const emailService = require('../src/services/email/emailService');
const smsService = require('../src/services/sms/smsService');
const { register, login, getVerificationStatus } = require('../src/controllers/authController');

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

test('register: creates unverified user, triggers OTP dispatch, and returns verification token', async () => {
  const origFindOne = User.findOne;
  const origCreate = User.create;
  const origSendPhone = smsService.sendPhoneOtp;
  const origSendEmail = emailService.sendEmailOtp;

  let phoneDispatched = false;
  let emailDispatched = false;
  let createdUserPayload = null;

  try {
    User.findOne = async () => null; // No duplicate user
    smsService.sendPhoneOtp = async () => { phoneDispatched = true; return { success: true }; };
    emailService.sendEmailOtp = async () => { emailDispatched = true; return { success: true }; };

    User.create = async (payload) => {
      createdUserPayload = payload;
      return {
        _id: 'new_user_1',
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        role: payload.role,
        isVerified: false,
        phoneVerified: false,
        emailVerified: false,
        getVerificationStatus: () => ({
          isVerified: false,
          phoneVerified: false,
          emailVerified: false,
          pending: ['phone', 'email']
        })
      };
    };

    const res = mockRes();
    await register(
      {
        body: {
          name: 'Shankar Patil',
          phone: '+91 98765 43210',
          email: 'shankar@uasd.agri.in',
          password: 'password123',
          role: 'FARMER'
        }
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requiresVerification, true);
    assert.ok(res.body.verificationToken);

    // Verify token scope is restricted
    const decoded = jwt.decode(res.body.verificationToken);
    assert.equal(decoded.scope, 'verification_pending');

    assert.equal(phoneDispatched, true);
    assert.equal(emailDispatched, true);
    assert.equal(createdUserPayload.isVerified, false);
  } finally {
    User.findOne = origFindOne;
    User.create = origCreate;
    smsService.sendPhoneOtp = origSendPhone;
    emailService.sendEmailOtp = origSendEmail;
  }
});

test('login: unverified user receives requiresVerification: true and restricted token', async () => {
  const origFindOne = User.findOne;

  try {
    const mockUnverifiedUser = {
      _id: 'unverified_1',
      name: 'Unverified Farmer',
      phone: '9876543210',
      role: 'FARMER',
      isVerified: false,
      phoneVerified: false,
      emailVerified: false,
      matchPassword: async () => true,
      syncVerificationState: () => false,
      getVerificationStatus: () => ({
        isVerified: false,
        phoneVerified: false,
        emailVerified: false,
        pending: ['phone']
      })
    };

    User.findOne = () => ({
      select: async () => mockUnverifiedUser
    });

    const res = mockRes();
    await login(
      { body: { phone: '9876543210', password: 'password123' } },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, false);
    assert.equal(res.body.requiresVerification, true);
    assert.ok(res.body.verificationToken);

    const decoded = jwt.decode(res.body.verificationToken);
    assert.equal(decoded.scope, 'verification_pending');
  } finally {
    User.findOne = origFindOne;
  }
});

test('login: fully verified user receives success: true and full access token', async () => {
  const origFindOne = User.findOne;

  try {
    const mockVerifiedUser = {
      _id: 'verified_1',
      name: 'Verified Farmer',
      phone: '9876543210',
      role: 'FARMER',
      isVerified: true,
      phoneVerified: true,
      emailVerified: true,
      matchPassword: async () => true,
      syncVerificationState: () => true,
      getVerificationStatus: () => ({
        isVerified: true,
        phoneVerified: true,
        emailVerified: true,
        pending: []
      })
    };

    User.findOne = () => ({
      select: async () => mockVerifiedUser
    });

    const res = mockRes();
    await login(
      { body: { phone: '9876543210', password: 'password123' } },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requiresVerification, undefined);
    assert.ok(res.body.token);

    const decoded = jwt.decode(res.body.token);
    assert.equal(decoded.scope, 'access');
  } finally {
    User.findOne = origFindOne;
  }
});

test('login: invalid credentials return generic error without account enumeration', async () => {
  const origFindOne = User.findOne;

  try {
    // 1. User not found
    User.findOne = () => ({ select: async () => null });
    const resNotFound = mockRes();
    await login(
      { body: { phone: '9876543210', password: 'password123' } },
      resNotFound,
      () => {}
    );
    assert.equal(resNotFound.statusCode, 401);

    // 2. Incorrect password
    User.findOne = () => ({
      select: async () => ({
        matchPassword: async () => false
      })
    });
    const resWrongPass = mockRes();
    await login(
      { body: { phone: '9876543210', password: 'wrongpassword' } },
      resWrongPass,
      () => {}
    );
    assert.equal(resWrongPass.statusCode, 401);

    // Message is identical to prevent enumeration
    assert.equal(resNotFound.body.message, resWrongPass.body.message);
  } finally {
    User.findOne = origFindOne;
  }
});

test('getVerificationStatus: returns breakdown of remaining steps', async () => {
  const origFindOne = User.findOne;

  try {
    User.findOne = async () => ({
      _id: 'user_stat',
      name: 'Status Farmer',
      phone: '9876543210',
      email: 'stat@uasd.agri.in',
      role: 'FARMER',
      isVerified: false,
      phoneVerified: true,
      emailVerified: false,
      syncVerificationState: () => false,
      getVerificationStatus: () => ({
        isVerified: false,
        phoneVerified: true,
        emailVerified: false,
        pending: ['email']
      })
    });

    const res = mockRes();
    await getVerificationStatus(
      { query: { phone: '9876543210' } },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.verificationStatus.phoneVerified, true);
    assert.equal(res.body.verificationStatus.emailVerified, false);
    assert.deepEqual(res.body.verificationStatus.pending, ['email']);
  } finally {
    User.findOne = origFindOne;
  }
});
