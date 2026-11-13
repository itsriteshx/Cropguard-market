const OTP_CONFIG = require('../../config/otpConfig');
const { maskPhone, toE164, normalizePhone } = require('../../utils/otpUtils');

/**
 * Console SMS Adapter (Safe fallback for development and testing)
 */
class ConsoleSmsAdapter {
  constructor() {
    this.name = 'console';
    this.sentMessages = [];
  }

  async send({ phone, message, otp }) {
    const cleanPhone = normalizePhone(phone);
    const masked = maskPhone(cleanPhone);

    // In non-production, log delivery confirmation without leaking plaintext OTP
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SmsAdapter:console] SMS dispatched to ${masked} | Status: simulated_success`);
    }

    const record = { phone: cleanPhone, message, otp, sentAt: new Date() };
    this.sentMessages.push(record);
    return { success: true, messageId: `console-sms-${Date.now()}` };
  }
}

/**
 * 2Factor.in SMS Adapter (India-focused high delivery transactional gateway)
 * Uses 2Factor AUTOGEN or custom OTP endpoint
 */
class TwoFactorSmsAdapter {
  constructor(apiKey) {
    this.name = '2factor';
    this.apiKey = apiKey || OTP_CONFIG.TWOFACTOR_API_KEY;
  }

  async send({ phone, message, otp }) {
    if (!this.apiKey) {
      throw new Error('2Factor API key is missing. Set TWOFACTOR_API_KEY in environment.');
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error('Valid 10-digit Indian mobile number is required for 2Factor SMS');
    }

    // 2Factor OTP SMS endpoint: https://2factor.in/v1/API/SMS/{api_key}/SMS/{phone}/{otp}
    const url = `https://2factor.in/v1/API/SMS/${this.apiKey}/SMS/${cleanPhone}/${otp}/CropGuard`;

    const res = await fetch(url, { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.Status !== 'Success') {
      const errorMsg = data?.Details || `2Factor HTTP error ${res.status}`;
      throw new Error(`2Factor SMS delivery failed: ${errorMsg}`);
    }

    return { success: true, messageId: data.Details };
  }
}

/**
 * MSG91 SMS Adapter (India DLT-compliant enterprise SMS gateway)
 */
class Msg91SmsAdapter {
  constructor(authKey, templateId) {
    this.name = 'msg91';
    this.authKey = authKey || OTP_CONFIG.MSG91_AUTH_KEY;
    this.templateId = templateId || OTP_CONFIG.MSG91_TEMPLATE_ID;
  }

  async send({ phone, message, otp }) {
    if (!this.authKey) {
      throw new Error('MSG91 auth key is missing. Set MSG91_AUTH_KEY in environment.');
    }

    const cleanPhone = normalizePhone(phone);
    const mobileWithCountry = `91${cleanPhone}`;

    const payload = {
      template_id: this.templateId,
      mobile: mobileWithCountry,
      otp: String(otp)
    };

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: this.authKey
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.type === 'error') {
      const errorMsg = data?.message || `MSG91 HTTP error ${res.status}`;
      throw new Error(`MSG91 SMS delivery failed: ${errorMsg}`);
    }

    return { success: true, messageId: data.request_id || `msg91-${Date.now()}` };
  }
}

/**
 * Twilio Programmable SMS Adapter (Global gateway with Indian sender support)
 */
class TwilioSmsAdapter {
  constructor(accountSid, authToken, fromNumber) {
    this.name = 'twilio';
    this.accountSid = accountSid || OTP_CONFIG.TWILIO_ACCOUNT_SID;
    this.authToken = authToken || OTP_CONFIG.TWILIO_AUTH_TOKEN;
    this.fromNumber = fromNumber || OTP_CONFIG.TWILIO_FROM_NUMBER;
  }

  async send({ phone, message }) {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new Error('Twilio credentials incomplete. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.');
    }

    const e164Phone = toE164(phone);
    if (!e164Phone) {
      throw new Error('Invalid phone number for Twilio SMS delivery');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: e164Phone,
      From: this.fromNumber,
      Body: message
    });

    const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authHeader
      },
      body: params.toString()
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.message || `Twilio HTTP error ${res.status}`;
      throw new Error(`Twilio SMS delivery failed: ${errorMsg}`);
    }

    return { success: true, messageId: data.sid };
  }
}

/**
 * Factory to retrieve active SMS adapter based on configuration
 */
function getSmsAdapter(providerOverride) {
  const provider = (providerOverride || OTP_CONFIG.SMS_PROVIDER || 'console').toLowerCase();

  switch (provider) {
    case '2factor':
      return new TwoFactorSmsAdapter();
    case 'msg91':
      return new Msg91SmsAdapter();
    case 'twilio':
      return new TwilioSmsAdapter();
    case 'console':
    default:
      return new ConsoleSmsAdapter();
  }
}

module.exports = {
  ConsoleSmsAdapter,
  TwoFactorSmsAdapter,
  Msg91SmsAdapter,
  TwilioSmsAdapter,
  getSmsAdapter
};
