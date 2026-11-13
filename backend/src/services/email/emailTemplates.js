/**
 * Professional, accessible email templates for CropGuard Market verification.
 * Adheres to ICAR / UASD Dharwad agricultural institutional branding.
 */

function getOtpEmailTemplate({ otp, expiryMinutes = 10, name = 'Farmer/Trader' }) {
  const subject = `🌾 CropGuard Market: Your Verification Code is ${otp}`;

  const text = `CropGuard Market — UASD Dharwad APMC Network
--------------------------------------------------
Hello ${name},

Your verification code is: ${otp}

This code will expire in ${expiryMinutes} minutes.
Do NOT share this code with anyone. CropGuard Market officials will never ask for your verification code.

If you did not request this verification code, please ignore this email.
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CropGuard Market Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 4px 0; }
    .subtitle { font-size: 13px; color: #94a3b8; }
    .otp-box { background-color: #0f172a; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 6px; color: #34d399; font-family: monospace; }
    .warning { font-size: 12px; color: #fbbf24; background: rgba(251, 191, 36, 0.1); border-left: 3px solid #fbbf24; padding: 10px 14px; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">UASD APMC Institutional Security</div>
      <div class="title">🌾 CropGuard Market</div>
      <div class="subtitle">Direct Farm-to-Market Exchange Verification</div>
    </div>
    <p style="font-size: 15px; color: #e2e8f0;">Hello <strong>${name}</strong>,</p>
    <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">Please use the one-time verification code below to verify your email address. This code is valid for <strong>${expiryMinutes} minutes</strong>.</p>
    
    <div class="otp-box">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Single-Use Verification Code</div>
      <div class="otp-code">${otp}</div>
    </div>

    <div class="warning">
      <strong>Security Notice:</strong> Never share this code with anyone. CropGuard Market administrators and APMC mandis will never ask for your verification code.
    </div>

    <p style="font-size: 13px; color: #64748b;">If you did not request this verification, no action is required and your account remains secure.</p>

    <div class="footer">
      CropGuard Market • UASD Agricultural Network • Direct APMC Trade Escrow
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = { getOtpEmailTemplate };
