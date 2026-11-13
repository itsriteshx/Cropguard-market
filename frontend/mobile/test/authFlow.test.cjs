const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyPhone,
  verifyEmail,
  resendPhoneOtp
} = require('../src/auth/verificationService');

test('authFlow: dual verification sequence: phone verified first, then transitions to email', async () => {
  let phoneCalled = false;
  let emailCalled = false;

  const mockApi = async (url, opts, token) => {
    if (url === '/auth/verify-phone') {
      phoneCalled = true;
      return {
        success: true,
        message: 'Phone verified',
        isFullyVerified: false,
        verificationStatus: {
          phoneVerified: true,
          emailVerified: false,
          pending: ['email']
        }
      };
    }
    if (url === '/auth/verify-email') {
      emailCalled = true;
      return {
        success: true,
        message: 'Email verified',
        isFullyVerified: true,
        token: 'new_full_access_token',
        verificationStatus: {
          phoneVerified: true,
          emailVerified: true,
          pending: []
        }
      };
    }
    return { success: false };
  };

  // Step 1: Verify Phone
  const phoneRes = await verifyPhone(mockApi, { phone: '9876543210', otp: '111222' }, 'verif_token');
  assert.equal(phoneCalled, true);
  assert.equal(phoneRes.success, true);
  assert.equal(phoneRes.isFullyVerified, false);
  assert.deepEqual(phoneRes.verificationStatus.pending, ['email']);

  // Step 2: Verify Email
  const emailRes = await verifyEmail(mockApi, { email: 'farmer@uasd.agri.in', otp: '333444' }, 'verif_token');
  assert.equal(emailCalled, true);
  assert.equal(emailRes.success, true);
  assert.equal(emailRes.isFullyVerified, true);
  assert.ok(emailRes.token);
  assert.deepEqual(emailRes.verificationStatus.pending, []);
});

test('authFlow: phone-only account completes upon phone verification', async () => {
  const mockApi = async (url) => {
    if (url === '/auth/verify-phone') {
      return {
        success: true,
        isFullyVerified: true,
        token: 'token_phone_only_user',
        verificationStatus: {
          phoneVerified: true,
          emailVerified: false,
          pending: []
        }
      };
    }
    return { success: false };
  };

  const res = await verifyPhone(mockApi, { phone: '9876543210', otp: '999888' });
  assert.equal(res.success, true);
  assert.equal(res.isFullyVerified, true);
  assert.ok(res.token);
});

test('authFlow: resend phone OTP calls backend with normalized phone number', async () => {
  let capturedBody = null;
  const mockApi = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return {
      success: true,
      maskedPhone: '******3210',
      resendAvailableAt: new Date(Date.now() + 60000)
    };
  };

  const res = await resendPhoneOtp(mockApi, { phone: '+91 (98765) 43210' });
  assert.equal(res.success, true);
  assert.equal(capturedBody.phone, '9876543210');
});
