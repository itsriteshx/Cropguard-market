const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyEmail,
  resendEmailOtp,
  verifyPhone,
  resendPhoneOtp,
  getVerificationStatus
} = require('../src/auth/verificationService');

test('verifyEmail: rejects empty OTP client-side and formats payload properly', async () => {
  const mockApi = async (url, opts, token) => ({
    success: true,
    url,
    opts,
    token
  });

  // Empty OTP
  const emptyRes = await verifyEmail(mockApi, { email: 'farmer@uasd.agri.in', otp: '   ' });
  assert.equal(emptyRes.success, false);
  assert.match(emptyRes.message, /enter the 6-digit email verification code/i);

  // Valid input
  const res = await verifyEmail(mockApi, { email: 'Farmer@UASD.Agri.IN', otp: '654321' }, 'token_123');
  assert.equal(res.success, true);
  assert.equal(res.url, '/auth/verify-email');
  assert.equal(res.token, 'token_123');
  const body = JSON.parse(res.opts.body);
  assert.equal(body.email, 'farmer@uasd.agri.in');
  assert.equal(body.otp, '654321');
});

test('resendEmailOtp: formats request to /auth/resend-email-otp with normalized email', async () => {
  const mockApi = async (url, opts, token) => ({
    success: true,
    url,
    opts,
    token
  });

  const res = await resendEmailOtp(mockApi, { email: 'Farmer@Uasd.Agri.in' }, 'tok');
  assert.equal(res.success, true);
  assert.equal(res.url, '/auth/resend-email-otp');
  const body = JSON.parse(res.opts.body);
  assert.equal(body.email, 'farmer@uasd.agri.in');
});

test('verifyPhone: rejects empty OTP client-side and normalizes phone number', async () => {
  const mockApi = async (url, opts, token) => ({
    success: true,
    url,
    opts,
    token
  });

  const emptyRes = await verifyPhone(mockApi, { phone: '9876543210', otp: '' });
  assert.equal(emptyRes.success, false);
  assert.match(emptyRes.message, /enter the 6-digit SMS verification code/i);

  const res = await verifyPhone(mockApi, { phone: '+91 98765-43210', otp: '123456' }, 'tok');
  assert.equal(res.success, true);
  assert.equal(res.url, '/auth/verify-phone');
  const body = JSON.parse(res.opts.body);
  assert.equal(body.phone, '9876543210');
  assert.equal(body.otp, '123456');
});

test('resendPhoneOtp: formats request to /auth/resend-phone-otp with normalized phone', async () => {
  const mockApi = async (url, opts, token) => ({
    success: true,
    url,
    opts
  });

  const res = await resendPhoneOtp(mockApi, { phone: '09876543210' });
  assert.equal(res.success, true);
  assert.equal(res.url, '/auth/resend-phone-otp');
  const body = JSON.parse(res.opts.body);
  assert.equal(body.phone, '9876543210');
});

test('getVerificationStatus: formats query string appropriately', async () => {
  const mockApi = async (url) => ({ success: true, url });

  const res = await getVerificationStatus(mockApi, { phone: '+91 9876543210' });
  assert.equal(res.success, true);
  assert.equal(res.url, '/auth/verification-status?phone=9876543210');
});
