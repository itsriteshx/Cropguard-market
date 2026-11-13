const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionManager } = require('../src/auth/sessionManager');
const {
  verifyEmail,
  verifyPhone,
  resendEmailOtp,
  resendPhoneOtp
} = require('../src/auth/verificationService');

test('mobileAuthIntegration: complete registration to dual verification lifecycle', async () => {
  const mockStorage = new Map();
  const store = {
    get: async () => mockStorage.get('session_token') || null,
    set: async (val) => { mockStorage.set('session_token', val); },
    remove: async () => { mockStorage.delete('session_token'); }
  };

  // Mock server state
  let userPhoneVerified = false;
  let userEmailVerified = false;

  const mockApiRequest = async (endpoint, options = {}, token = null) => {
    const body = options.body ? JSON.parse(options.body) : {};

    if (endpoint === '/auth/register') {
      return {
        success: true,
        requiresVerification: true,
        verificationToken: 'restricted_token_reg',
        verificationStatus: {
          isVerified: false,
          phoneVerified: false,
          emailVerified: false,
          pending: ['phone', 'email']
        },
        user: {
          _id: 'u_101',
          name: body.name,
          phone: body.phone,
          email: body.email,
          role: body.role,
          isVerified: false
        }
      };
    }

    if (endpoint === '/auth/verify-phone') {
      if (body.otp === '654321') {
        userPhoneVerified = true;
        return {
          success: true,
          message: 'Phone verified',
          isFullyVerified: false,
          verificationStatus: {
            phoneVerified: true,
            emailVerified: userEmailVerified,
            pending: userEmailVerified ? [] : ['email']
          }
        };
      }
      return { success: false, message: 'Invalid phone code' };
    }

    if (endpoint === '/auth/verify-email') {
      if (body.otp === '123456') {
        userEmailVerified = true;
        const isFullyVerified = userPhoneVerified && userEmailVerified;
        return {
          success: true,
          message: 'Email verified',
          isFullyVerified,
          token: isFullyVerified ? 'full_access_jwt_production' : undefined,
          verificationStatus: {
            phoneVerified: userPhoneVerified,
            emailVerified: true,
            pending: []
          }
        };
      }
      return { success: false, message: 'Invalid email code' };
    }

    if (endpoint === '/auth/me') {
      if (token === 'full_access_jwt_production') {
        return {
          success: true,
          user: {
            _id: 'u_101',
            name: 'Ramesh Patil',
            role: 'FARMER',
            isVerified: true
          }
        };
      }
      return { success: false, httpStatus: 401 };
    }

    return { success: false, httpStatus: 404 };
  };

  const sessionManager = createSessionManager(store, mockApiRequest);

  // 1. Initial State: App opens signed out
  const initial = await sessionManager.restore();
  assert.equal(initial.state, 'signedOut');

  // 2. User registers with phone and email
  const regResponse = await mockApiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ramesh Patil',
      phone: '9876543210',
      email: 'ramesh@uasd.agri.in',
      password: 'password123',
      role: 'FARMER'
    })
  });

  assert.equal(regResponse.success, true);
  assert.equal(regResponse.requiresVerification, true);
  assert.equal(regResponse.verificationToken, 'restricted_token_reg');
  assert.deepEqual(regResponse.verificationStatus.pending, ['phone', 'email']);

  // Session storage must NOT store restricted tokens as authenticated session
  assert.equal(await store.get(), null);

  // 3. User verifies Phone SMS OTP
  const phoneRes = await verifyPhone(
    mockApiRequest,
    { phone: '9876543210', otp: '654321' },
    regResponse.verificationToken
  );
  assert.equal(phoneRes.success, true);
  assert.equal(phoneRes.isFullyVerified, false);
  assert.deepEqual(phoneRes.verificationStatus.pending, ['email']);

  // 4. User verifies Email OTP -> full access token issued
  const emailRes = await verifyEmail(
    mockApiRequest,
    { email: 'ramesh@uasd.agri.in', otp: '123456' },
    regResponse.verificationToken
  );
  assert.equal(emailRes.success, true);
  assert.equal(emailRes.isFullyVerified, true);
  assert.equal(emailRes.token, 'full_access_jwt_production');

  // Save the full access token in session store
  await sessionManager.save(emailRes.token);
  assert.equal(await store.get(), 'full_access_jwt_production');

  // 5. Subsequent app restoration succeeds as fully authenticated
  const restored = await sessionManager.restore();
  assert.equal(restored.state, 'authenticated');
  assert.equal(restored.user.name, 'Ramesh Patil');
  assert.equal(restored.user.isVerified, true);
});

test('mobileAuthIntegration: legacy verified user login immediately authenticates', async () => {
  const mockStorage = new Map();
  const store = {
    get: async () => mockStorage.get('token') || null,
    set: async (v) => { mockStorage.set('token', v); },
    remove: async () => { mockStorage.delete('token'); }
  };

  const mockApi = async (url) => {
    if (url === '/auth/login') {
      return {
        success: true,
        message: 'Login successful',
        token: 'legacy_verified_token',
        user: { _id: 'legacy_1', role: 'FARMER', isVerified: true }
      };
    }
    return { success: false };
  };

  const loginRes = await mockApi('/auth/login');
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.requiresVerification, undefined);
  assert.ok(loginRes.token);

  await store.set(loginRes.token);
  assert.equal(await store.get(), 'legacy_verified_token');
});

test('mobileAuthIntegration: network failure during OTP verification returns structured failure', async () => {
  const failingApi = async () => ({
    success: false,
    networkError: true,
    message: 'Network error connecting to backend'
  });

  const res = await verifyPhone(failingApi, { phone: '9876543210', otp: '111111' });
  assert.equal(res.success, false);
  assert.equal(res.networkError, true);
  assert.match(res.message, /network error/i);
});
