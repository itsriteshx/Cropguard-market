/**
 * OTP and Verification Configuration for CropGuard Market
 * Production-ready settings with safe development fallbacks.
 */

const OTP_CONFIG = {
  // OTP properties
  LENGTH: parseInt(process.env.OTP_LENGTH, 10) || 6,
  EXPIRY_SECONDS: parseInt(process.env.OTP_EXPIRY_SECONDS, 10) || 600, // 10 minutes
  RESEND_COOLDOWN_SECONDS: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60, // 1 minute
  MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,

  // Providers
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'console',
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'console',

  // Email provider credentials / settings
  EMAIL_FROM: process.env.EMAIL_FROM || 'CropGuard Market <no-reply@cropguard.agri.in>',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',

  // SMS provider credentials / settings
  TWOFACTOR_API_KEY: process.env.TWOFACTOR_API_KEY || '',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',

  // Verification policy: enforce verified accounts on login
  REQUIRE_VERIFICATION: process.env.REQUIRE_VERIFICATION !== 'false'
};

module.exports = OTP_CONFIG;
