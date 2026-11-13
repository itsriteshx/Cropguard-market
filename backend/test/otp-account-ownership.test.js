const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const VerificationOtp = require('../src/models/VerificationOtp');
const emailService = require('../src/services/email/emailService');
const smsService = require('../src/services/sms/smsService');
const { hashOtp } = require('../src/utils/otpUtils');
const {
  verifyEmail,
  resendEmailOtp,
  verifyPhone,
  resendPhoneOtp,
  getVerificationStatus
} = require('../src/controllers/authController');

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

// 1. User A cannot verify User B's email (returns 403)
test('account ownership: User A cannot verify User B email (returns 403)', async () => {
  const req = {
    user: {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210'
    },
    body: {
      email: 'suresh@uasd.agri.in',
      otp: '123456'
    }
  };
  const res = mockRes();

  await verifyEmail(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /forbidden/i);
});

// 2. User A cannot verify User B's phone (returns 403)
test('account ownership: User A cannot verify User B phone (returns 403)', async () => {
  const req = {
    user: {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210'
    },
    body: {
      phone: '9123456789',
      otp: '123456'
    }
  };
  const res = mockRes();

  await verifyPhone(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /forbidden/i);
});

// 3. User A cannot resend OTP to User B's email (returns 403)
test('account ownership: User A cannot resend OTP to User B email (returns 403)', async () => {
  const req = {
    user: {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210'
    },
    body: {
      email: 'suresh@uasd.agri.in'
    }
  };
  const res = mockRes();

  await resendEmailOtp(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /forbidden/i);
});

// 4. User A cannot resend OTP to User B's phone (returns 403)
test('account ownership: User A cannot resend OTP to User B phone (returns 403)', async () => {
  const req = {
    user: {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210'
    },
    body: {
      phone: '9123456789'
    }
  };
  const res = mockRes();

  await resendPhoneOtp(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /forbidden/i);
});

// 5. Authenticated user verifies their own email (returns 200)
test('account ownership: Authenticated user verifies their own email (returns 200)', async () => {
  const origVerify = emailService.verifyEmailOtp;
  try {
    let capturedUserId = null;
    emailService.verifyEmailOtp = async ({ email, otp, userId }) => {
      capturedUserId = userId;
      return { success: true, message: 'Email address verified successfully' };
    };

    const mockUser = {
      _id: 'user_A',
      name: 'Farmer Ramesh',
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

    const req = {
      user: mockUser,
      body: {
        email: 'ramesh@uasd.agri.in',
        otp: '123456'
      }
    };
    const res = mockRes();

    await verifyEmail(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(capturedUserId, 'user_A');
    assert.equal(mockUser.emailVerified, true);
  } finally {
    emailService.verifyEmailOtp = origVerify;
  }
});

// 6. Authenticated user verifies their own phone (returns 200)
test('account ownership: Authenticated user verifies their own phone (returns 200)', async () => {
  const origVerify = smsService.verifyPhoneOtp;
  try {
    let capturedUserId = null;
    smsService.verifyPhoneOtp = async ({ phone, otp, userId }) => {
      capturedUserId = userId;
      return { success: true, message: 'Mobile number verified successfully' };
    };

    const mockUser = {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210',
      role: 'FARMER',
      phoneVerified: false,
      emailVerified: true,
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

    const req = {
      user: mockUser,
      body: {
        phone: '+91 9876543210',
        otp: '654321'
      }
    };
    const res = mockRes();

    await verifyPhone(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(capturedUserId, 'user_A');
    assert.equal(mockUser.phoneVerified, true);
  } finally {
    smsService.verifyPhoneOtp = origVerify;
  }
});

// 7. Public registration email verification works without auth token and passes resolved userId (returns 200)
test('account ownership: Public registration email verification works without auth token and passes resolved userId (returns 200)', async () => {
  const origVerify = emailService.verifyEmailOtp;
  const origFindOne = User.findOne;
  try {
    let capturedUserId = null;
    emailService.verifyEmailOtp = async ({ email, otp, userId }) => {
      capturedUserId = userId;
      return { success: true, message: 'Email address verified successfully' };
    };

    const mockUser = {
      _id: 'reg_user_101',
      name: 'New Registered User',
      email: 'newuser@uasd.agri.in',
      phone: '9811122233',
      role: 'FARMER',
      phoneVerified: false,
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

    const req = {
      user: null, // Unauthenticated public request
      body: {
        email: 'newuser@uasd.agri.in',
        otp: '123456'
      }
    };
    const res = mockRes();

    await verifyEmail(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(capturedUserId, 'reg_user_101', 'Controller must resolve and pass user._id for public registration');
    assert.equal(mockUser.emailVerified, true);
  } finally {
    emailService.verifyEmailOtp = origVerify;
    User.findOne = origFindOne;
  }
});

// 8. Public registration phone verification works without auth token and passes resolved userId (returns 200)
test('account ownership: Public registration phone verification works without auth token and passes resolved userId (returns 200)', async () => {
  const origVerify = smsService.verifyPhoneOtp;
  const origFindOne = User.findOne;
  try {
    let capturedUserId = null;
    smsService.verifyPhoneOtp = async ({ phone, otp, userId }) => {
      capturedUserId = userId;
      return { success: true, message: 'Mobile number verified successfully' };
    };

    const mockUser = {
      _id: 'reg_user_202',
      name: 'New Mobile User',
      phone: '9845012345',
      role: 'FARMER',
      phoneVerified: false,
      isVerified: false,
      syncVerificationState() {
        this.isVerified = this.phoneVerified;
      },
      getVerificationStatus() {
        return {
          isVerified: this.isVerified,
          phoneVerified: this.phoneVerified,
          pending: []
        };
      },
      save: async () => true
    };

    User.findOne = async () => mockUser;

    const req = {
      user: null, // Unauthenticated public request
      body: {
        phone: '9845012345',
        otp: '654321'
      }
    };
    const res = mockRes();

    await verifyPhone(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(capturedUserId, 'reg_user_202', 'Controller must resolve and pass user._id for public registration');
    assert.equal(mockUser.phoneVerified, true);
  } finally {
    smsService.verifyPhoneOtp = origVerify;
    User.findOne = origFindOne;
  }
});

// 9. Fail-Closed Email OTP: Correct matching userId succeeds and includes exact userId in consumption filter
test('fail-closed email OTP: correct matching user ID succeeds and binds consumption filter', async () => {
  const email = 'farmer.match@uasd.agri.in';
  const otp = '112233';
  const otpHash = hashOtp(otp, email);

  const persistedOtp = {
    _id: 'otp_bound_email_1',
    userId: 'user_123',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  let capturedFilter = null;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      capturedFilter = filter;
      if (filter._id === persistedOtp._id && filter.userId === persistedOtp.userId) {
        persistedOtp.consumedAt = update.$set.consumedAt;
        return persistedOtp;
      }
      return null;
    };

    const result = await emailService.verifyEmailOtp({
      email,
      otp,
      userId: 'user_123'
    });

    assert.equal(result.success, true);
    assert.equal(capturedFilter.userId, 'user_123', 'Atomic consumption filter must include exact userId');
    assert.ok(persistedOtp.consumedAt instanceof Date, 'OTP must be consumed on match');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 10. Fail-Closed Email OTP: Different user ID is rejected and does NOT consume OTP
test('fail-closed email OTP: different user ID is rejected and does not consume OTP', async () => {
  const email = 'farmer.diff@uasd.agri.in';
  const otp = '223344';
  const otpHash = hashOtp(otp, email);

  const persistedOtp = {
    _id: 'otp_bound_email_2',
    userId: 'user_123',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      persistedOtp.consumedAt = update.$set.consumedAt;
      return persistedOtp;
    };

    const result = await emailService.verifyEmailOtp({
      email,
      otp,
      userId: 'user_999' // Different user ID
    });

    assert.equal(result.success, false);
    assert.equal(persistedOtp.consumedAt, null, 'OTP must NOT be consumed when user ID differs');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 11. Fail-Closed Email OTP: Missing user ID is rejected when OTP record is user-bound and does NOT consume OTP
test('fail-closed email OTP: missing user ID is rejected when OTP record is user-bound', async () => {
  const email = 'farmer.missing@uasd.agri.in';
  const otp = '334455';
  const otpHash = hashOtp(otp, email);

  const persistedOtp = {
    _id: 'otp_bound_email_3',
    userId: 'user_123',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      persistedOtp.consumedAt = update.$set.consumedAt;
      return persistedOtp;
    };

    // Missing userId (null / undefined)
    const result = await emailService.verifyEmailOtp({
      email,
      otp,
      userId: null
    });

    assert.equal(result.success, false);
    assert.equal(persistedOtp.consumedAt, null, 'OTP must NOT be consumed when user ID is missing for bound record');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 12. Fail-Closed Email OTP: Existing unbound public registration OTP verification still works
test('fail-closed email OTP: existing unbound public registration OTP verification still works', async () => {
  const email = 'farmer.unbound@uasd.agri.in';
  const otp = '445566';
  const otpHash = hashOtp(otp, email);

  const persistedOtp = {
    _id: 'otp_unbound_email_4',
    userId: null, // Unbound record
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
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

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === persistedOtp._id && filter.consumedAt === null) {
        persistedOtp.consumedAt = update.$set.consumedAt;
        return persistedOtp;
      }
      return null;
    };

    // Unbound verification without userId
    const result = await emailService.verifyEmailOtp({
      email,
      otp,
      userId: null
    });

    assert.equal(result.success, true);
    assert.ok(persistedOtp.consumedAt instanceof Date, 'Unbound OTP must be consumed on valid verification');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 13. Fail-Closed Phone OTP: Correct matching userId succeeds and binds consumption filter
test('fail-closed phone OTP: correct matching user ID succeeds and binds consumption filter', async () => {
  const phone = '9876543210';
  const otp = '556677';
  const otpHash = hashOtp(otp, phone);

  const persistedOtp = {
    _id: 'otp_bound_phone_1',
    userId: 'user_phone_123',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  let capturedFilter = null;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      capturedFilter = filter;
      if (filter._id === persistedOtp._id && filter.userId === persistedOtp.userId) {
        persistedOtp.consumedAt = update.$set.consumedAt;
        return persistedOtp;
      }
      return null;
    };

    const result = await smsService.verifyPhoneOtp({
      phone,
      otp,
      userId: 'user_phone_123'
    });

    assert.equal(result.success, true);
    assert.equal(capturedFilter.userId, 'user_phone_123', 'Atomic consumption filter must include exact userId');
    assert.ok(persistedOtp.consumedAt instanceof Date, 'Phone OTP must be consumed on match');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 14. Fail-Closed Phone OTP: Different user ID is rejected and does NOT consume OTP
test('fail-closed phone OTP: different user ID is rejected and does not consume OTP', async () => {
  const phone = '9876543210';
  const otp = '667788';
  const otpHash = hashOtp(otp, phone);

  const persistedOtp = {
    _id: 'otp_bound_phone_2',
    userId: 'user_phone_123',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      persistedOtp.consumedAt = update.$set.consumedAt;
      return persistedOtp;
    };

    const result = await smsService.verifyPhoneOtp({
      phone,
      otp,
      userId: 'user_phone_999' // Different user ID
    });

    assert.equal(result.success, false);
    assert.equal(persistedOtp.consumedAt, null, 'Phone OTP must NOT be consumed when user ID differs');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 15. Fail-Closed Phone OTP: Missing user ID is rejected when OTP record is user-bound and does NOT consume OTP
test('fail-closed phone OTP: missing user ID is rejected when OTP record is user-bound', async () => {
  const phone = '9876543210';
  const otp = '778899';
  const otpHash = hashOtp(otp, phone);

  const persistedOtp = {
    _id: 'otp_bound_phone_3',
    userId: 'user_phone_123',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persistedOtp
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      persistedOtp.consumedAt = update.$set.consumedAt;
      return persistedOtp;
    };

    // Missing userId (null / undefined)
    const result = await smsService.verifyPhoneOtp({
      phone,
      otp,
      userId: null
    });

    assert.equal(result.success, false);
    assert.equal(persistedOtp.consumedAt, null, 'Phone OTP must NOT be consumed when user ID is missing for bound record');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 16. Fail-Closed Phone OTP: Existing unbound public registration OTP verification still works
test('fail-closed phone OTP: existing unbound public registration OTP verification still works', async () => {
  const phone = '9876543210';
  const otp = '889900';
  const otpHash = hashOtp(otp, phone);

  const persistedOtp = {
    _id: 'otp_unbound_phone_4',
    userId: null, // Unbound record
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    resendAvailableAt: new Date(Date.now() + 60000),
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

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === persistedOtp._id && filter.consumedAt === null) {
        persistedOtp.consumedAt = update.$set.consumedAt;
        return persistedOtp;
      }
      return null;
    };

    // Unbound verification without userId
    const result = await smsService.verifyPhoneOtp({
      phone,
      otp,
      userId: null
    });

    assert.equal(result.success, true);
    assert.ok(persistedOtp.consumedAt instanceof Date, 'Unbound phone OTP must be consumed on valid verification');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 17. Existing legacy account verification remains intact
test('account ownership: Existing legacy account verification remains intact', async () => {
  const legacyUser = new User({
    name: 'Legacy Farmer',
    phone: '9845099999',
    role: 'FARMER',
    isVerified: true
  });

  // Verify syncVerificationState maintains compatibility
  legacyUser.syncVerificationState();
  assert.equal(legacyUser.phoneVerified, true);
  assert.equal(legacyUser.isVerified, true);

  const status = legacyUser.getVerificationStatus();
  assert.equal(status.isVerified, true);
  assert.equal(status.phoneVerified, true);
});

// 18. Additional check: getVerificationStatus enforces ownership when authenticated
test('account ownership: getVerificationStatus blocks inspecting other users when authenticated', async () => {
  const req = {
    user: {
      _id: 'user_A',
      name: 'Farmer Ramesh',
      email: 'ramesh@uasd.agri.in',
      phone: '9876543210'
    },
    query: {
      email: 'other@uasd.agri.in'
    }
  };
  const res = mockRes();

  await getVerificationStatus(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

// 19. Concurrency: Two simultaneous successful verifications for email prevent double-spending
test('concurrency: simultaneous successful email verifications enforce atomic single-use', async () => {
  const email = 'concurrency.email@uasd.agri.in';
  const otp = '123987';
  const otpHash = hashOtp(otp, email);

  let persisted = {
    _id: 'otp_conc_email',
    userId: 'user_conc_1',
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
      sort: () => persisted
    });

    // Realistic atomic MongoDB emulator verifying all query conditions
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      const isIdMatch = filter._id === persisted._id;
      const isNotConsumed = filter.consumedAt === null && persisted.consumedAt === null;
      const isNotExpired = filter.expiresAt && filter.expiresAt.$gt && persisted.expiresAt > filter.expiresAt.$gt;
      const isWithinAttempts = filter.attempts && filter.attempts.$lt && persisted.attempts < filter.attempts.$lt;
      const isUserMatch = !filter.userId || filter.userId === persisted.userId;

      if (isIdMatch && isNotConsumed && isNotExpired && isWithinAttempts && isUserMatch) {
        persisted = { ...persisted, consumedAt: update.$set.consumedAt };
        return persisted;
      }
      return null;
    };

    const [res1, res2] = await Promise.all([
      emailService.verifyEmailOtp({ email, otp, userId: 'user_conc_1' }),
      emailService.verifyEmailOtp({ email, otp, userId: 'user_conc_1' })
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    assert.equal(successes.length, 1, 'Exactly one concurrent verification must succeed');
    assert.equal(failures.length, 1, 'Losing concurrent verification must be rejected');
    assert.ok(persisted.consumedAt instanceof Date, 'Record must be consumed once');
    assert.match(failures[0].message, /already used or invalidated/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 20. Concurrency: Two simultaneous successful verifications for phone prevent double-spending
test('concurrency: simultaneous successful phone verifications enforce atomic single-use', async () => {
  const phone = '9876543210';
  const otp = '654321';
  const otpHash = hashOtp(otp, phone);

  let persisted = {
    _id: 'otp_conc_phone',
    userId: 'user_conc_phone_1',
    target: phone,
    type: 'PHONE',
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
      sort: () => persisted
    });

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      const isIdMatch = filter._id === persisted._id;
      const isNotConsumed = filter.consumedAt === null && persisted.consumedAt === null;
      const isNotExpired = filter.expiresAt && filter.expiresAt.$gt && persisted.expiresAt > filter.expiresAt.$gt;
      const isWithinAttempts = filter.attempts && filter.attempts.$lt && persisted.attempts < filter.attempts.$lt;
      const isUserMatch = !filter.userId || filter.userId === persisted.userId;

      if (isIdMatch && isNotConsumed && isNotExpired && isWithinAttempts && isUserMatch) {
        persisted = { ...persisted, consumedAt: update.$set.consumedAt };
        return persisted;
      }
      return null;
    };

    const [res1, res2] = await Promise.all([
      smsService.verifyPhoneOtp({ phone, otp, userId: 'user_conc_phone_1' }),
      smsService.verifyPhoneOtp({ phone, otp, userId: 'user_conc_phone_1' })
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    assert.equal(successes.length, 1, 'Exactly one concurrent verification must succeed');
    assert.equal(failures.length, 1, 'Losing concurrent verification must be rejected');
    assert.ok(persisted.consumedAt instanceof Date, 'Record must be consumed once');
    assert.match(failures[0].message, /already used or invalidated/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 21. Expiry race: Atomic write rejects correct email verification if expired between read and write
test('expiry race: atomic write rejects correct email verification if expired at write time', async () => {
  const email = 'race.expiry@uasd.agri.in';
  const otp = '998877';
  const otpHash = hashOtp(otp, email);

  // Initial read shows active, but expires right after read
  const persisted = {
    _id: 'otp_race_expiry',
    userId: 'user_race_1',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 5), // expires almost immediately
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  const origUpdateOne = VerificationOtp.updateOne;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persisted
    });

    // Simulate clock advancing: by the time atomic update runs, it has expired
    VerificationOtp.findOneAndUpdate = async (filter) => {
      // Check if filter requires unexpired
      if (filter.expiresAt && filter.expiresAt.$gt) {
        const threshold = filter.expiresAt.$gt;
        // In the database, the record expired: persisted.expiresAt < threshold
        if (persisted.expiresAt <= threshold) {
          return null; // Atomic condition failed!
        }
      }
      persisted.consumedAt = new Date();
      return persisted;
    };

    VerificationOtp.updateOne = async () => ({ modifiedCount: 1 });

    // Force expiration before atomic update check
    persisted.expiresAt = new Date(Date.now() - 100);

    const result = await emailService.verifyEmailOtp({
      email,
      otp,
      userId: 'user_race_1'
    });

    assert.equal(result.success, false);
    assert.equal(result.expired, true);
    assert.match(result.message, /expired/i);
    assert.equal(persisted.consumedAt, null, 'Expired OTP must not be consumed as valid');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 22. Concurrency on incorrect attempts: Simultaneous wrong OTP requests never exceed maxAttempts and atomically invalidate
test('concurrency: simultaneous incorrect attempts never exceed maxAttempts and atomically invalidate', async () => {
  const phone = '9876543210';
  const correctOtp = '123456';
  const otpHash = hashOtp(correctOtp, phone);

  let persisted = {
    _id: 'otp_attempts_race',
    userId: 'user_attempts_1',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // 1 remaining attempt before reaching max 5
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  const origUpdateOne = VerificationOtp.updateOne;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => persisted
    });

    // Atomic conditional pipeline emulator enforcing { attempts: { $lt: 5 } } and setting consumedAt on final attempt
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === persisted._id && filter.consumedAt === null) {
        if (filter.attempts && filter.attempts.$lt && persisted.attempts >= filter.attempts.$lt) {
          return null; // Limit reached!
        }
        const newAttempts = persisted.attempts + 1;
        const newConsumedAt = newAttempts >= persisted.maxAttempts ? new Date() : persisted.consumedAt;
        persisted = {
          ...persisted,
          attempts: newAttempts,
          consumedAt: newConsumedAt
        };
        return persisted;
      }
      return null;
    };

    VerificationOtp.updateOne = async () => ({ modifiedCount: 1 });

    // Fire 10 concurrent wrong OTP requests simultaneously
    const wrongRequests = Array.from({ length: 10 }, (_, i) =>
      smsService.verifyPhoneOtp({ phone, otp: `00000${i}`, userId: 'user_attempts_1' })
    );

    const results = await Promise.all(wrongRequests);

    // Assert attempts never exceeded 5
    assert.equal(persisted.attempts, 5, 'Atomic filter must guarantee attempts strictly stops at maxAttempts (5)');
    assert.ok(persisted.consumedAt instanceof Date, 'The final incorrect attempt must immediately set consumedAt');
    // All 10 must fail
    assert.ok(results.every((r) => r.success === false));
    // The requests that arrived after attempts hit 5 must report max attempts exceeded
    const exceeded = results.filter((r) => r.maxAttemptsExceeded);
    assert.ok(exceeded.length >= 1, 'Losing concurrent requests must report attempt limit exceeded');

    // A correct OTP cannot succeed after maximum incorrect attempts
    const correctRes = await smsService.verifyPhoneOtp({ phone, otp: correctOtp, userId: 'user_attempts_1' });
    assert.equal(correctRes.success, false);
    assert.equal(correctRes.maxAttemptsExceeded, true);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 23. Initial lookup scoping: query specifically matches userId or unbound, ignoring other user's active OTP
test('initial lookup scoping: query specifically matches user active OTP over another user', async () => {
  const email = 'shared.target@uasd.agri.in';
  const otpA = '111111';
  const otpHashA = hashOtp(otpA, email);

  const userA_Doc = {
    _id: 'doc_user_A',
    userId: 'user_A',
    target: email,
    type: 'EMAIL',
    otpHash: otpHashA,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  let capturedQuery = null;

  try {
    VerificationOtp.findOne = (query) => {
      capturedQuery = query;
      // Emulate MongoDB $or matching
      if (query.$or) {
        const matchesUser = query.$or.some(
          (clause) => clause.userId === userA_Doc.userId || clause.userId === null
        );
        if (matchesUser) {
          return { sort: () => userA_Doc };
        }
      }
      return { sort: () => null };
    };

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === userA_Doc._id) {
        userA_Doc.consumedAt = update.$set.consumedAt;
        return userA_Doc;
      }
      return null;
    };

    // User A querying their own OTP
    const resA = await emailService.verifyEmailOtp({
      email,
      otp: otpA,
      userId: 'user_A'
    });

    assert.equal(resA.success, true);
    assert.ok(capturedQuery.$or, 'Initial lookup must scope by userId or unbound');
    assert.deepEqual(capturedQuery.$or, [{ userId: 'user_A' }, { userId: null }]);

    // User B querying with same email: lookup does not find User A's record
    const resB = await emailService.verifyEmailOtp({
      email,
      otp: '999999',
      userId: 'user_B'
    });

    assert.equal(resB.success, false);
    assert.match(resB.message, /no active verification code found/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 24. Atomic invalidation: earlier incorrect attempts leave email OTP usable
test('atomic invalidation: earlier incorrect attempts leave email OTP usable', async () => {
  const email = 'earlier.email@uasd.agri.in';
  const correctOtp = '123456';
  const otpHash = hashOtp(correctOtp, email);

  let doc = {
    _id: 'otp_earlier_email',
    userId: 'user_earlier_1',
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
  const origUpdateOne = VerificationOtp.updateOne;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => doc
    });

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

    // 1st wrong attempt
    const res1 = await emailService.verifyEmailOtp({ email, otp: '000001', userId: 'user_earlier_1' });
    assert.equal(res1.success, false);
    assert.equal(res1.attemptsRemaining, 4);
    assert.equal(doc.consumedAt, null, 'OTP must remain unconsumed after 1st incorrect attempt');

    // 2nd wrong attempt
    const res2 = await emailService.verifyEmailOtp({ email, otp: '000002', userId: 'user_earlier_1' });
    assert.equal(res2.success, false);
    assert.equal(res2.attemptsRemaining, 3);
    assert.equal(doc.consumedAt, null, 'OTP must remain unconsumed after 2nd incorrect attempt');

    // Subsequent correct attempt succeeds and consumes the OTP
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === doc._id && filter.consumedAt === null && doc.attempts < 5) {
        doc = { ...doc, consumedAt: update.$set.consumedAt };
        return doc;
      }
      return null;
    };

    const resCorrect = await emailService.verifyEmailOtp({ email, otp: correctOtp, userId: 'user_earlier_1' });
    assert.equal(resCorrect.success, true);
    assert.ok(doc.consumedAt instanceof Date, 'Correct verification must successfully consume OTP');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 25. Atomic invalidation: final incorrect attempt immediately sets consumedAt and blocks subsequent correct email OTP
test('atomic invalidation: final incorrect attempt immediately sets consumedAt and blocks subsequent correct email OTP', async () => {
  const email = 'final.email@uasd.agri.in';
  const correctOtp = '654321';
  const otpHash = hashOtp(correctOtp, email);

  let doc = {
    _id: 'otp_final_email',
    userId: 'user_final_1',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // 1 remaining attempt before lockout
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

    // 5th attempt (final incorrect attempt)
    const resFinal = await emailService.verifyEmailOtp({ email, otp: '000000', userId: 'user_final_1' });
    assert.equal(resFinal.success, false);
    assert.equal(resFinal.maxAttemptsExceeded, true);
    assert.equal(resFinal.attemptsRemaining, 0);
    assert.ok(doc.consumedAt instanceof Date, 'The final incorrect attempt must immediately set consumedAt in the same DB operation');
    assert.equal(doc.attempts, 5);

    // Subsequent correct attempt cannot succeed after maximum incorrect attempts
    const resCorrect = await emailService.verifyEmailOtp({ email, otp: correctOtp, userId: 'user_final_1' });
    assert.equal(resCorrect.success, false);
    assert.equal(resCorrect.maxAttemptsExceeded, true);
    assert.match(resCorrect.message, /too many incorrect attempts/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 26. Atomic invalidation: earlier incorrect attempts leave phone OTP usable
test('atomic invalidation: earlier incorrect attempts leave phone OTP usable', async () => {
  const phone = '9876500001';
  const correctOtp = '334455';
  const otpHash = hashOtp(correctOtp, phone);

  let doc = {
    _id: 'otp_earlier_phone',
    userId: 'user_earlier_phone_1',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
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

    // 1st wrong attempt
    const res1 = await smsService.verifyPhoneOtp({ phone, otp: '111111', userId: 'user_earlier_phone_1' });
    assert.equal(res1.success, false);
    assert.equal(res1.attemptsRemaining, 4);
    assert.equal(doc.consumedAt, null, 'Phone OTP must remain unconsumed after 1st incorrect attempt');

    // 2nd wrong attempt
    const res2 = await smsService.verifyPhoneOtp({ phone, otp: '222222', userId: 'user_earlier_phone_1' });
    assert.equal(res2.success, false);
    assert.equal(res2.attemptsRemaining, 3);
    assert.equal(doc.consumedAt, null, 'Phone OTP must remain unconsumed after 2nd incorrect attempt');

    // Subsequent correct attempt succeeds and consumes the OTP
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === doc._id && filter.consumedAt === null && doc.attempts < 5) {
        doc = { ...doc, consumedAt: update.$set.consumedAt };
        return doc;
      }
      return null;
    };

    const resCorrect = await smsService.verifyPhoneOtp({ phone, otp: correctOtp, userId: 'user_earlier_phone_1' });
    assert.equal(resCorrect.success, true);
    assert.ok(doc.consumedAt instanceof Date, 'Correct verification must successfully consume Phone OTP');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 27. Atomic invalidation: final incorrect attempt immediately sets consumedAt and blocks subsequent correct phone OTP
test('atomic invalidation: final incorrect attempt immediately sets consumedAt and blocks subsequent correct phone OTP', async () => {
  const phone = '9876500002';
  const correctOtp = '998811';
  const otpHash = hashOtp(correctOtp, phone);

  let doc = {
    _id: 'otp_final_phone',
    userId: 'user_final_phone_1',
    target: phone,
    type: 'PHONE',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // 1 remaining attempt before lockout
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

    // 5th attempt (final incorrect attempt)
    const resFinal = await smsService.verifyPhoneOtp({ phone, otp: '000000', userId: 'user_final_phone_1' });
    assert.equal(resFinal.success, false);
    assert.equal(resFinal.maxAttemptsExceeded, true);
    assert.equal(resFinal.attemptsRemaining, 0);
    assert.ok(doc.consumedAt instanceof Date, 'The final incorrect attempt must immediately set consumedAt in the same DB operation');
    assert.equal(doc.attempts, 5);

    // Subsequent correct attempt cannot succeed after maximum incorrect attempts
    const resCorrect = await smsService.verifyPhoneOtp({ phone, otp: correctOtp, userId: 'user_final_phone_1' });
    assert.equal(resCorrect.success, false);
    assert.equal(resCorrect.maxAttemptsExceeded, true);
    assert.match(resCorrect.message, /too many incorrect attempts/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
    VerificationOtp.updateOne = origUpdateOne;
  }
});

// 28. Active lookup: already-consumed OTP records are excluded from initial lookup
test('active lookup: already-consumed OTP records are excluded from initial lookup', async () => {
  const email = 'consumed.exclusion@uasd.agri.in';
  const otp = '123456';
  const otpHash = hashOtp(otp, email);

  const consumedRecord = {
    _id: 'otp_consumed_rec_1',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 1,
    maxAttempts: 5,
    consumedAt: new Date() // Already consumed
  };

  const origFindOne = VerificationOtp.findOne;
  let capturedQuery = null;

  try {
    VerificationOtp.findOne = (query) => {
      capturedQuery = query;
      // In MongoDB, querying with consumedAt: null will NOT match consumedRecord
      if (query.consumedAt === null && consumedRecord.consumedAt) {
        return { sort: () => null };
      }
      return { sort: () => consumedRecord };
    };

    const res = await emailService.verifyEmailOtp({ email, otp });

    assert.equal(res.success, false);
    assert.equal(capturedQuery.consumedAt, null, 'Initial lookup must query consumedAt: null');
    assert.match(res.message, /no active verification code found/i);
  } finally {
    VerificationOtp.findOne = origFindOne;
  }
});

// 29. Active lookup: a newer consumed OTP does not prevent selection of an older eligible active OTP
test('active lookup: a newer consumed OTP does not prevent selection of an older eligible active OTP', async () => {
  const email = 'eligible.older@uasd.agri.in';
  const activeOtp = '112233';
  const activeOtpHash = hashOtp(activeOtp, email);
  const now = Date.now();

  const olderActiveRecord = {
    _id: 'otp_older_active',
    target: email,
    type: 'EMAIL',
    otpHash: activeOtpHash,
    createdAt: new Date(now - 300000), // created 5m ago
    expiresAt: new Date(now + 300000), // valid for 5 more minutes
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null // Eligible and active
  };

  const newerConsumedRecord = {
    _id: 'otp_newer_consumed',
    target: email,
    type: 'EMAIL',
    otpHash: hashOtp('999999', email),
    createdAt: new Date(now - 60000), // created 1m ago
    expiresAt: new Date(now + 540000),
    attempts: 5,
    maxAttempts: 5,
    consumedAt: new Date(now - 30000) // Consumed 30s ago
  };

  const allRecords = [olderActiveRecord, newerConsumedRecord];

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;
  let capturedQuery = null;

  try {
    VerificationOtp.findOne = (query) => {
      capturedQuery = query;
      return {
        sort: (sortSpec) => {
          // Emulate MongoDB find({ target, type, consumedAt: null }).sort({ createdAt: -1 })
          const matching = allRecords.filter((doc) => {
            if (doc.target !== query.target) return false;
            if (doc.type !== query.type) return false;
            if (query.consumedAt === null && doc.consumedAt !== null) return false;
            return true;
          });
          // Sort newest first
          matching.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return matching[0] || null;
        }
      };
    };

    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === olderActiveRecord._id && filter.consumedAt === null) {
        olderActiveRecord.consumedAt = update.$set.consumedAt;
        return olderActiveRecord;
      }
      return null;
    };

    const res = await emailService.verifyEmailOtp({ email, otp: activeOtp });

    assert.equal(res.success, true, 'Older active OTP must be verified despite newer consumed OTP');
    assert.equal(capturedQuery.consumedAt, null, 'Initial lookup must exclude consumed records');
    assert.ok(olderActiveRecord.consumedAt instanceof Date, 'Older active OTP must be successfully consumed');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 30. Atomic persistence: final incorrect attempt is persisted with consumedAt set and subsequent correct attempt cannot verify
test('atomic persistence: final incorrect attempt is persisted with consumedAt set and subsequent correct attempt cannot verify', async () => {
  const email = 'persist.final@uasd.agri.in';
  const correctOtp = '556677';
  const otpHash = hashOtp(correctOtp, email);

  let doc = {
    _id: 'otp_persist_final',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // 1 attempt remaining before lockout
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = (query) => {
      // In MongoDB, consumedAt: null will not return a doc whose consumedAt is populated
      if (query.consumedAt === null && doc.consumedAt !== null) {
        return { sort: () => null };
      }
      return { sort: () => doc };
    };

    // Update pipeline emulator: when attempts reach maxAttempts, consumedAt is atomically persisted
    VerificationOtp.findOneAndUpdate = async (filter, update) => {
      if (filter._id === doc._id && filter.consumedAt === null && doc.attempts < filter.attempts.$lt) {
        const nextAttempts = doc.attempts + 1;
        const nextConsumedAt = nextAttempts >= doc.maxAttempts ? new Date() : doc.consumedAt;
        doc = {
          ...doc,
          attempts: nextAttempts,
          consumedAt: nextConsumedAt
        };
        return doc;
      }
      return null;
    };

    // 5th attempt (incorrect code)
    const resIncorrect = await emailService.verifyEmailOtp({ email, otp: '000000' });
    assert.equal(resIncorrect.success, false);
    assert.equal(resIncorrect.maxAttemptsExceeded, true);
    assert.equal(resIncorrect.attemptsRemaining, 0);
    assert.ok(doc.consumedAt instanceof Date, 'The final incorrect attempt must be persisted with consumedAt set');
    assert.equal(doc.attempts, 5);

    // Subsequent attempt with correct code cannot verify that OTP
    const resCorrect = await emailService.verifyEmailOtp({ email, otp: correctOtp });
    assert.equal(resCorrect.success, false, 'Subsequent correct attempt cannot verify consumed/invalidated OTP');
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 31. Unexpected persistence inconsistency: throws explicit error when updated.consumedAt is missing at maxAttempts
test('unexpected persistence inconsistency: throws explicit error when updated.consumedAt is missing at maxAttempts', async () => {
  const email = 'inconsistent.anomaly@uasd.agri.in';
  const correctOtp = '654321';
  const otpHash = hashOtp(correctOtp, email);

  let doc = {
    _id: 'otp_anomaly_rec',
    target: email,
    type: 'EMAIL',
    otpHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4, // Reaching maxAttempts (5) on next incorrect attempt
    maxAttempts: 5,
    consumedAt: null
  };

  const origFindOne = VerificationOtp.findOne;
  const origFindOneAndUpdate = VerificationOtp.findOneAndUpdate;

  try {
    VerificationOtp.findOne = () => ({
      sort: () => doc
    });

    // Simulate unexpected persistence inconsistency: attempts increments to 5, but consumedAt is unexpectedly missing
    VerificationOtp.findOneAndUpdate = async () => {
      doc = {
        ...doc,
        attempts: 5,
        consumedAt: null // Inconsistency! Pipeline failed to return/persist consumedAt
      };
      return doc;
    };

    await assert.rejects(
      async () => {
        await emailService.verifyEmailOtp({ email, otp: '000000' });
      },
      {
        name: 'Error',
        message: /Atomic OTP invalidation was not persisted/i
      },
      'Must throw an explicit error indicating atomic invalidation was not persisted'
    );
  } finally {
    VerificationOtp.findOne = origFindOne;
    VerificationOtp.findOneAndUpdate = origFindOneAndUpdate;
  }
});


// 33. Concurrency resend: simultaneous email resend requests enforce cooldown and create exactly one active OTP
test('concurrency resend: simultaneous email resend requests enforce cooldown and create exactly one active OTP', async () => {
  const email = 'concurrent.resend.email@uasd.agri.in';
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;

  const records = [];
  let sendCalls = 0;

  const mockAdapter = {
    send: async () => {
      sendCalls += 1;
      return { messageId: `msg_${sendCalls}` };
    }
  };

  try {
    VerificationOtp.findOne = (query) => ({
      sort: () => {
        // Find newest unconsumed record for target
        const unconsumed = records
          .filter((r) => r.target === query.target && r.type === query.type && (r.consumedAt === null || r.consumedAt === undefined))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return unconsumed[0] || null;
      }
    });

    VerificationOtp.updateMany = async (query, update) => {
      records.forEach((r) => {
        if (r.target === query.target && r.type === query.type && (r.consumedAt === null || r.consumedAt === undefined)) {
          r.consumedAt = update.$set.consumedAt;
        }
      });
      return { modifiedCount: 1 };
    };

    VerificationOtp.create = async (payload) => {
      const doc = {
        _id: `otp_${records.length + 1}`,
        createdAt: new Date(),
        consumedAt: null,
        ...payload
      };
      records.push(doc);
      return doc;
    };

    // Fire 5 simultaneous resend requests for the same email
    const results = await Promise.all([
      emailService.sendEmailOtp({ email, adapter: mockAdapter }),
      emailService.sendEmailOtp({ email, adapter: mockAdapter }),
      emailService.sendEmailOtp({ email, adapter: mockAdapter }),
      emailService.sendEmailOtp({ email, adapter: mockAdapter }),
      emailService.sendEmailOtp({ email, adapter: mockAdapter })
    ]);

    const successes = results.filter((r) => r.success);
    const cooldowns = results.filter((r) => !r.success && r.cooldown);

    assert.equal(successes.length, 1, 'Exactly one concurrent resend request must succeed');
    assert.equal(cooldowns.length, 4, 'Remaining concurrent requests must receive cooldown rejection');
    assert.equal(sendCalls, 1, 'Delivery adapter must only be invoked once');
    const activeRecords = records.filter((r) => r.consumedAt === null);
    assert.equal(activeRecords.length, 1, 'Exactly one active OTP record must exist in the database');
    cooldowns.forEach((cd) => {
      assert.ok(cd.waitSeconds > 0, 'Cooldown response must provide positive waitSeconds');
      assert.match(cd.message, /wait/i);
    });
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});

// 34. Concurrency resend: simultaneous phone resend requests enforce cooldown and create exactly one active OTP
test('concurrency resend: simultaneous phone resend requests enforce cooldown and create exactly one active OTP', async () => {
  const phone = '9876543210';
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;

  const records = [];
  let sendCalls = 0;

  const mockAdapter = {
    send: async () => {
      sendCalls += 1;
      return { messageId: `sms_msg_${sendCalls}` };
    }
  };

  try {
    VerificationOtp.findOne = (query) => ({
      sort: () => {
        const unconsumed = records
          .filter((r) => r.target === query.target && r.type === query.type && (r.consumedAt === null || r.consumedAt === undefined))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return unconsumed[0] || null;
      }
    });

    VerificationOtp.updateMany = async (query, update) => {
      records.forEach((r) => {
        if (r.target === query.target && r.type === query.type && (r.consumedAt === null || r.consumedAt === undefined)) {
          r.consumedAt = update.$set.consumedAt;
        }
      });
      return { modifiedCount: 1 };
    };

    VerificationOtp.create = async (payload) => {
      const doc = {
        _id: `otp_phone_${records.length + 1}`,
        createdAt: new Date(),
        consumedAt: null,
        ...payload
      };
      records.push(doc);
      return doc;
    };

    // Fire 5 simultaneous resend requests for the same phone
    const results = await Promise.all([
      smsService.sendPhoneOtp({ phone, adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone, adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone, adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone, adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone, adapter: mockAdapter })
    ]);

    const successes = results.filter((r) => r.success);
    const cooldowns = results.filter((r) => !r.success && r.cooldown);

    assert.equal(successes.length, 1, 'Exactly one concurrent phone resend request must succeed');
    assert.equal(cooldowns.length, 4, 'Remaining concurrent requests must receive cooldown rejection');
    assert.equal(sendCalls, 1, 'SMS delivery adapter must only be invoked once');
    const activeRecords = records.filter((r) => r.consumedAt === null);
    assert.equal(activeRecords.length, 1, 'Exactly one active Phone OTP record must exist');
    cooldowns.forEach((cd) => {
      assert.ok(cd.waitSeconds > 0);
      assert.match(cd.message, /wait/i);
    });
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});

// 35. Concurrency resend: concurrent requests across different targets/types execute independently
test('concurrency resend: concurrent requests across different targets execute independently', async () => {
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;

  const records = [];

  const mockAdapter = {
    send: async () => ({ messageId: 'ok' })
  };

  try {
    VerificationOtp.findOne = (query) => ({
      sort: () => {
        const unconsumed = records
          .filter((r) => r.target === query.target && r.type === query.type && r.consumedAt === null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return unconsumed[0] || null;
      }
    });

    VerificationOtp.updateMany = async (query, update) => {
      records.forEach((r) => {
        if (r.target === query.target && r.type === query.type && r.consumedAt === null) {
          r.consumedAt = update.$set.consumedAt;
        }
      });
      return { modifiedCount: 1 };
    };

    VerificationOtp.create = async (payload) => {
      const doc = {
        _id: `otp_multi_${records.length + 1}`,
        createdAt: new Date(),
        ...payload
      };
      records.push(doc);
      return doc;
    };

    // Send to two different emails and two different phones simultaneously
    const results = await Promise.all([
      emailService.sendEmailOtp({ email: 'user1@uasd.agri.in', adapter: mockAdapter }),
      emailService.sendEmailOtp({ email: 'user2@uasd.agri.in', adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone: '9876500001', adapter: mockAdapter }),
      smsService.sendPhoneOtp({ phone: '9876500002', adapter: mockAdapter })
    ]);

    assert.ok(results.every((r) => r.success === true), 'All 4 requests for distinct targets must succeed independently');
    assert.equal(records.length, 4, 'Four distinct OTP records must be created');
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});

// 36. Concurrency resend: delivery failure invalidates OTP and does not block subsequent resend with false cooldown
test('concurrency resend: delivery failure invalidates OTP and does not block subsequent resend', async () => {
  const email = 'failover.delivery@uasd.agri.in';
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;
  const originalUpdateOne = VerificationOtp.updateOne;

  let doc = null;

  try {
    VerificationOtp.findOne = (query) => ({
      sort: () => (doc && doc.target === query.target && doc.consumedAt === null ? doc : null)
    });

    VerificationOtp.updateMany = async () => ({ modifiedCount: 0 });

    VerificationOtp.create = async (payload) => {
      doc = {
        _id: 'otp_failed_rec',
        createdAt: new Date(),
        ...payload
      };
      return doc;
    };

    VerificationOtp.updateOne = async (filter, update) => {
      if (doc && doc._id === filter._id) {
        doc.consumedAt = update.$set.consumedAt;
      }
      return { modifiedCount: 1 };
    };

    const failingAdapter = {
      send: async () => {
        throw new Error('SMTP connection error');
      }
    };

    // 1st request fails delivery
    const res1 = await emailService.sendEmailOtp({ email, adapter: failingAdapter });
    assert.equal(res1.success, false);
    assert.equal(res1.deliveryFailed, true);
    assert.ok(doc.consumedAt instanceof Date, 'Failed delivery must invalidate record');

    // 2nd request with working adapter immediately succeeds without false cooldown
    const workingAdapter = {
      send: async () => ({ messageId: 'msg_success' })
    };

    const res2 = await emailService.sendEmailOtp({ email, adapter: workingAdapter });
    assert.equal(res2.success, true, 'Subsequent resend must succeed after delivery failure cleanup');
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
    VerificationOtp.updateOne = originalUpdateOne;
  }
});

// 37. Resend safety: expired unconsumed OTP records are safely invalidated without false cooldown
test('resend safety: expired unconsumed OTP records are safely invalidated without false cooldown', async () => {
  const phone = '9876543211';
  const originalFindOne = VerificationOtp.findOne;
  const originalUpdateMany = VerificationOtp.updateMany;
  const originalCreate = VerificationOtp.create;

  const expiredRecord = {
    _id: 'otp_expired_unconsumed',
    target: phone,
    type: 'PHONE',
    otpHash: 'dummy_hash',
    createdAt: new Date(Date.now() - 900000), // 15m ago
    expiresAt: new Date(Date.now() - 300000), // Expired 5m ago
    resendAvailableAt: new Date(Date.now() - 840000),
    consumedAt: null // Unconsumed but expired!
  };

  let updateManyCalled = false;
  let createdNew = false;

  const mockAdapter = {
    send: async () => ({ messageId: 'sms_expired_test' })
  };

  try {
    VerificationOtp.findOne = () => ({
      sort: () => (expiredRecord.consumedAt ? null : expiredRecord)
    });

    VerificationOtp.updateMany = async (query, update) => {
      if (query.target === phone && query.consumedAt === null) {
        updateManyCalled = true;
        expiredRecord.consumedAt = update.$set.consumedAt;
      }
      return { modifiedCount: 1 };
    };

    VerificationOtp.create = async (payload) => {
      createdNew = true;
      return { _id: 'otp_new_after_expired', ...payload };
    };

    const res = await smsService.sendPhoneOtp({ phone, adapter: mockAdapter });

    assert.equal(res.success, true, 'Must succeed when previous record was expired');
    assert.ok(updateManyCalled, 'Must invalidate previous expired unconsumed record');
    assert.ok(expiredRecord.consumedAt instanceof Date, 'Expired record must be marked consumed');
    assert.ok(createdNew, 'Must create a new active OTP record');
  } finally {
    VerificationOtp.findOne = originalFindOne;
    VerificationOtp.updateMany = originalUpdateMany;
    VerificationOtp.create = originalCreate;
  }
});
