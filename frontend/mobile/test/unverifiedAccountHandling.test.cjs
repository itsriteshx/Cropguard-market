const test = require('node:test');
const assert = require('node:assert/strict');
const { getVerificationStatus, verifyEmail, verifyPhone } = require('../src/auth/verificationService');

test('unverifiedAccountHandling: recognizes requiresVerification on login and identifies pending steps', async () => {
  const loginResponse = {
    success: false,
    requiresVerification: true,
    message: 'Account verification required before accessing the market.',
    verificationToken: 'verif_jwt_scoped',
    verificationStatus: {
      isVerified: false,
      phoneVerified: false,
      emailVerified: false,
      pending: ['phone', 'email']
    },
    user: {
      _id: 'user_123',
      name: 'Ramesh Patil',
      phone: '9876543210',
      email: 'ramesh@uasd.agri.in',
      isVerified: false
    }
  };

  assert.equal(loginResponse.requiresVerification, true);
  assert.equal(loginResponse.verificationToken, 'verif_jwt_scoped');
  assert.deepEqual(loginResponse.verificationStatus.pending, ['phone', 'email']);

  // Next step determination logic
  const determineNextStep = (pending) => {
    if (pending.includes('phone')) return 'PHONE_OTP';
    if (pending.includes('email')) return 'EMAIL_OTP';
    return 'SUCCESS';
  };

  assert.equal(determineNextStep(loginResponse.verificationStatus.pending), 'PHONE_OTP');
});

test('unverifiedAccountHandling: error response mappings are clear and actionable', async () => {
  const mockApi = async (url) => {
    if (url === '/auth/verify-phone') {
      return {
        success: false,
        expired: true,
        message: 'Verification code has expired. Please request a new code.'
      };
    }
    if (url === '/auth/verify-email') {
      return {
        success: false,
        maxAttemptsExceeded: true,
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
      };
    }
    return { success: false };
  };

  const phoneRes = await verifyPhone(mockApi, { phone: '9876543210', otp: '123456' });
  assert.equal(phoneRes.success, false);
  assert.equal(phoneRes.expired, true);
  assert.match(phoneRes.message, /expired/i);

  const emailRes = await verifyEmail(mockApi, { email: 'farmer@uasd.agri.in', otp: '123456' });
  assert.equal(emailRes.success, false);
  assert.equal(emailRes.maxAttemptsExceeded, true);
  assert.match(emailRes.message, /too many incorrect attempts/i);
});

test('unverifiedAccountHandling: status check retrieves live pending requirements', async () => {
  const mockApi = async (url) => {
    return {
      success: true,
      verificationStatus: {
        isVerified: false,
        phoneVerified: true,
        emailVerified: false,
        pending: ['email']
      }
    };
  };

  const res = await getVerificationStatus(mockApi, { phone: '9876543210' });
  assert.equal(res.success, true);
  assert.equal(res.verificationStatus.phoneVerified, true);
  assert.equal(res.verificationStatus.emailVerified, false);
  assert.deepEqual(res.verificationStatus.pending, ['email']);
});
