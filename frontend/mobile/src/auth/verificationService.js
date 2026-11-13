/**
 * Client-side verification service for CropGuard Market mobile app.
 * Handles Email and Phone OTP verification and resend requests.
 */

async function verifyEmail(apiRequest, { email, otp }, token = null) {
  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    return { success: false, message: 'Please enter the 6-digit email verification code' };
  }

  const payload = {
    email: email ? email.trim().toLowerCase() : undefined,
    otp: otp.trim()
  };

  return await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
}

async function resendEmailOtp(apiRequest, { email }, token = null) {
  const payload = {
    email: email ? email.trim().toLowerCase() : undefined
  };

  return await apiRequest('/auth/resend-email-otp', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
}

async function verifyPhone(apiRequest, { phone, otp }, token = null) {
  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    return { success: false, message: 'Please enter the 6-digit SMS verification code' };
  }

  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : undefined;
  const payload = {
    phone: cleanPhone,
    otp: otp.trim()
  };

  return await apiRequest('/auth/verify-phone', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
}

async function resendPhoneOtp(apiRequest, { phone }, token = null) {
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : undefined;
  const payload = {
    phone: cleanPhone
  };

  return await apiRequest('/auth/resend-phone-otp', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
}

async function getVerificationStatus(apiRequest, query = {}, token = null) {
  const params = new URLSearchParams();
  if (query.email) params.append('email', query.email.trim().toLowerCase());
  if (query.phone) params.append('phone', String(query.phone).replace(/\D/g, '').slice(-10));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return await apiRequest(`/auth/verification-status${qs}`, {
    method: 'GET'
  }, token);
}

module.exports = {
  verifyEmail,
  resendEmailOtp,
  verifyPhone,
  resendPhoneOtp,
  getVerificationStatus
};
