const OTP_CONFIG = require('../../config/otpConfig');
const { maskEmail } = require('../../utils/otpUtils');

/**
 * Base / Console Email Adapter (Safe fallback for development and testing)
 */
class ConsoleEmailAdapter {
  constructor() {
    this.name = 'console';
    this.sentEmails = []; // Preserved in-memory for testing
  }

  async send({ to, subject, html, text }) {
    const masked = maskEmail(to);
    // Never output plaintext OTP in production logs
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailAdapter:console] Sent email to ${masked} | Subject: "${subject}"`);
    }
    const record = { to, subject, html, text, sentAt: new Date() };
    this.sentEmails.push(record);
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

/**
 * Resend Email Delivery Adapter
 */
class ResendEmailAdapter {
  constructor(apiKey) {
    this.name = 'resend';
    this.apiKey = apiKey || OTP_CONFIG.RESEND_API_KEY;
  }

  async send({ to, subject, html, text }) {
    if (!this.apiKey) {
      throw new Error('Resend API key is missing. Set RESEND_API_KEY in environment.');
    }

    const payload = {
      from: OTP_CONFIG.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.message || `Resend HTTP error ${res.status}`;
      throw new Error(`Resend delivery failed: ${errorMsg}`);
    }

    return { success: true, messageId: data.id };
  }
}

/**
 * SendGrid Email Delivery Adapter
 */
class SendGridEmailAdapter {
  constructor(apiKey) {
    this.name = 'sendgrid';
    this.apiKey = apiKey || OTP_CONFIG.SENDGRID_API_KEY;
  }

  async send({ to, subject, html, text }) {
    if (!this.apiKey) {
      throw new Error('SendGrid API key is missing. Set SENDGRID_API_KEY in environment.');
    }

    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: OTP_CONFIG.EMAIL_FROM.replace(/.*<([^>]+)>.*/, '$1') || 'no-reply@cropguard.agri.in' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`SendGrid delivery failed (HTTP ${res.status}): ${errText}`);
    }

    return { success: true, messageId: res.headers.get('x-message-id') || `sendgrid-${Date.now()}` };
  }
}

/**
 * Factory function to get active email adapter based on configuration
 */
function getEmailAdapter(providerOverride) {
  const provider = (providerOverride || OTP_CONFIG.EMAIL_PROVIDER || 'console').toLowerCase();

  switch (provider) {
    case 'resend':
      return new ResendEmailAdapter();
    case 'sendgrid':
      return new SendGridEmailAdapter();
    case 'console':
    default:
      return new ConsoleEmailAdapter();
  }
}

module.exports = {
  ConsoleEmailAdapter,
  ResendEmailAdapter,
  SendGridEmailAdapter,
  getEmailAdapter
};
