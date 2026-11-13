# Milestone 7.1: Production-Ready Email & SMS OTP Verification Report

**Project:** CropGuard Market  
**Target Branch:** `feat/asd-isd`  
**Milestone:** M7.1 — Email + SMS OTP Verification & Mobile App Integration  
**Date:** November 14, 2026  

---

## 1. Executive Summary

Milestone 7.1 delivers a secure, production-grade authentication upgrade for CropGuard Market. The existing JWT authentication architecture has been enhanced with independent Email OTP and SMS Phone OTP verification mechanisms, cryptographically secure single-use token lifecycle management, provider adapters for Indian and global delivery networks, and full mobile integration for React Native / Expo.

All existing role-based access controls (`FARMER`, `BUYER_RETAIL`, `BUYER_WHOLESALE`, `ADMIN`), geospatial search indexes, and legacy verified accounts have been preserved with zero breaking changes.

---

## 2. Architecture & Database Schema Additions

### A. Dedicated `VerificationOtp` Model (`backend/src/models/VerificationOtp.js`)
- **Collection**: `verificationotps`
- **Fields**:
  - `userId`: `ObjectId` referencing `User` (indexed).
  - `target`: Normalized email or 10-digit phone number (indexed).
  - `type`: Enum `['EMAIL', 'PHONE']` (indexed).
  - `otpHash`: Hex-encoded SHA-256 HMAC (salted with server-side pepper and bound to target). Plaintext OTPs are never stored in MongoDB.
  - `expiresAt`: Date with MongoDB TTL index (`expireAfterSeconds: 0`) for automatic background purging of expired codes.
  - `resendAvailableAt`: Date representing cooldown deadline (default 60 seconds).
  - `attempts`: Counter tracking incorrect verification attempts (max 5).
  - `maxAttempts`: Bound limit before automatic invalidation.
  - `consumedAt`: Timestamp of atomic consumption. Single-use is strictly enforced via conditional writes (`findOneAndUpdate({ _id, consumedAt: null })`).

### B. User Model Independent Verification Fields (`backend/src/models/User.js`)
- `phoneVerified`: Boolean (default `false`).
- `emailVerified`: Boolean (default `false`).
- `phoneVerifiedAt`: Date (default `null`).
- `emailVerifiedAt`: Date (default `null`).
- `isVerified`: Consolidated boolean maintained in sync (`phoneVerified && (!email || emailVerified)`).
- **Legacy Compatibility**: Seeded personas and existing users with `isVerified: true` automatically synchronize `phoneVerified: true` and `emailVerified: true` upon inspection, ensuring zero lockout.

---

## 3. Cryptographic Security & Hardening Measures

1. **Cryptographically Secure Random Generation**:
   - Built using Node.js `crypto.randomInt(100000, 1000000)` guaranteeing 6-digit numeric randomness without modulo bias.
2. **Target-Bound SHA-256 HMAC**:
   - `hashOtp(otp, target)` hashes the OTP combined with the normalized target. This mathematically prevents cross-target replay attacks (an attacker cannot use an email OTP to verify a phone number).
3. **Constant-Time Verification**:
   - `crypto.timingSafeEqual` prevents side-channel timing attacks.
4. **Atomic Single-Use Consumption**:
   - Uses MongoDB atomic update `findOneAndUpdate({ _id, consumedAt: null }, { $set: { consumedAt: now } })` to prevent double-spending or concurrent race conditions.
5. **Anti-Bombing & Cooldown Enforcement**:
   - 60-second resend cooldown enforced on backend before new OTP can be generated.
   - Dedicated `otpLimiter` rate limiter (10 requests per 15 minutes per IP).
6. **Scoped JWT Access Control**:
   - Unverified accounts receive restricted tokens with `scope: 'verification_pending'`.
   - `protect` middleware blocks restricted tokens from accessing operational marketplace, orders, and negotiations endpoints with HTTP 403.
   - Full 30-day access tokens are only issued when required verification is complete.
7. **Socket.IO Live Protection**:
   - `negotiationSocket.js` verifies token scope and blocks unverified sockets from joining negotiation rooms.
8. **Account Enumeration Prevention**:
   - Login endpoint returns identical generic error messages (`"Invalid credentials. User not found or incorrect password."`) for non-existent users and wrong passwords.

---

## 4. API Endpoints Summary

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Registers unverified account, automatically triggers SMS & email OTPs, returns `requiresVerification: true` and restricted token. |
| `POST` | `/api/auth/login` | Public | Validates credentials; returns full access token for verified users, or `requiresVerification: true` with restricted token for unverified users. |
| `POST` | `/api/auth/verify-phone` | Public / Token | Verifies 6-digit SMS OTP, marks phone verified, issues full access token if dual requirements satisfied. |
| `POST` | `/api/auth/resend-phone-otp` | Rate Limited | Resends SMS OTP subject to 60-second cooldown and invalidates previous active codes. |
| `POST` | `/api/auth/verify-email` | Public / Token | Verifies 6-digit Email OTP, marks email verified, issues full access token if dual requirements satisfied. |
| `POST` | `/api/auth/resend-email-otp` | Rate Limited | Resends Email OTP subject to 60-second cooldown and invalidates previous active codes. |
| `GET` | `/api/auth/verification-status` | Public / Token | Returns current breakdown of completed and pending verification steps. |
| `GET` | `/api/auth/me` | Protected / Scoped | Inspects user profile; permits scoped verification tokens so clients can read verification state. |

---

## 5. Mobile Integration (React Native / Expo)

1. **Registration Screen**:
   - Added optional/recommended Email input field alongside Name, Phone, Password, and Role.
2. **SMS Phone OTP Verification Card**:
   - Formatted 6-digit OTP input with monospaced letter spacing.
   - Real-time 60-second resend countdown timer.
   - Attempt limit and invalid code feedback.
3. **Email OTP Verification Card**:
   - Institutional UASD APMC branded design.
   - 6-digit numeric input with countdown timer.
   - Smooth transition from Phone OTP to Email OTP in dual verification flow.
4. **Verification Success & Activation**:
   - Congratulatory activation card transitioning directly into the marketplace.
5. **Notice Banner**:
   - Prominent notice banner in main app if user account is restored in unverified state.
6. **Session & Token Safety**:
   - `sessionStore` via `expo-secure-store` only stores fully authenticated access tokens. Restricted tokens remain isolated in memory during verification.

---

## 6. Provider Configuration & Environment Template

Add the following variables to `.env` for production deployment:

```env
# OTP Verification Configuration
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=600
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS=5
REQUIRE_VERIFICATION=true

# Email Delivery Provider (console | smtp | sendgrid | resend)
EMAIL_PROVIDER=resend
EMAIL_FROM=CropGuard Market <no-reply@cropguard.agri.in>
RESEND_API_KEY=re_your_resend_api_key_here
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password

# SMS Delivery Provider (console | 2factor | msg91 | twilio)
SMS_PROVIDER=2factor
TWOFACTOR_API_KEY=your_2factor_in_api_key_here
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_TEMPLATE_ID=your_msg91_dlt_template_id_here
TWILIO_ACCOUNT_SID=ACyour_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

---

## 7. Android Manual Testing Instructions

1. Start Metro bundler: `cd frontend/mobile && npm start`
2. Launch on Android device / emulator: Press `a` in Metro terminal.
3. **Registration Flow**:
   - Select "Register as Farmer/Buyer".
   - Enter Name: `Ramesh Patil`, Phone: `9876543210`, Email: `ramesh@uasd.agri.in`, Password: `password123`.
   - Tap "Create Verified Account".
   - Notice immediate transition to "📱 SMS VERIFICATION".
   - Enter 6-digit SMS OTP (view terminal log for simulated console output).
   - Tap "Verify Mobile Number".
   - Notice automatic transition to "✉️ EMAIL VERIFICATION".
   - Enter 6-digit Email OTP from terminal log.
   - Tap "Verify Email Address".
   - Notice transition to "🎉 VERIFICATION COMPLETE", tap "Enter Marketplace".
4. **Resend Cooldown**:
   - Tap "Resend SMS" or "Resend Email"; verify that the button disables with a 60-second countdown.
5. **Unverified Login**:
   - Sign in with an unverified account; verify that the app seamlessly resumes the pending OTP verification screen instead of crashing or showing a 401 error.

---

## 8. M7 Continuation Plan

With M7.1 complete, the next implementation milestones are:

- **M7.2**: Centralized Mobile API Client and Environment Configuration.
- **M7.3**: Marketplace and Farmer Listings.
- **M7.4**: Negotiations and Socket.IO.
- **M7.5**: Orders and Farmer Ledger.
- **M7.6**: Mandi Rates and Profile.
- **M7.7**: Integration Testing, Security Review and Final Verification.
