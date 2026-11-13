const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Helper to check if a request should skip general API rate limiting
const shouldSkipApiLimiter = (req) => {
  const url = req.originalUrl || req.url || '';
  return url.startsWith('/api/auth') || url.startsWith('/api/mandi-rates/image');
};

// General API rate limiter (150 requests per 15 minutes)
// Skips /api/auth endpoints so authentication is strictly governed by authLimiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipApiLimiter,
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again after 15 minutes'
  }
});

// Authentication rate limiter (Relaxed for dev/viva testing, strict in production)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  }
});

// OTP generation & resend rate limiter (Protects against SMS/email bombing & exhaustion attacks)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP address, please try again after 15 minutes'
  }
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Custom NoSQL injection and prototype pollution protection
 * Recursively strips keys starting with '$', containing '.', or dangerous prototype keys
 * Safely handles Objects and Arrays while preserving Dates, Buffers, and RegExps
 */
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Preserve Dates, Buffers, and RegExps
  if (data instanceof Date || Buffer.isBuffer(data) || data instanceof RegExp) {
    return data;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      sanitizeData(data[i]);
    }
    return data;
  }

  const keys = Object.keys(data);
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key) || /^\$/.test(key) || /\./.test(key)) {
      delete data[key];
    } else {
      sanitizeData(data[key]);
    }
  }

  return data;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    sanitizeData(req.body);
  }

  // In Express 4, req.query is parsed by query parser middleware.
  // To ensure sanitized query values cannot be bypassed or re-parsed from an underlying getter,
  // we sanitize req.query and define an own property on the request object.
  // This guarantees controllers and subsequent middlewares receive strictly sanitized values.
  if (req.query) {
    const sanitized = sanitizeData(req.query);
    Object.defineProperty(req, 'query', {
      value: sanitized,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }

  next();
};

/**
 * Route-level parameter sanitizer.
 * In Express, route parameters (req.params) are only populated after route matching.
 * Global middlewares running before route matching see req.params as empty.
 * Use sanitizeParams at the router or route level if parameter sanitization is needed.
 */
const sanitizeParams = (req, res, next) => {
  if (req.params) {
    sanitizeData(req.params);
  }
  next();
};

module.exports = {
  helmetMiddleware: helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }),
  apiLimiter,
  authLimiter,
  otpLimiter,
  shouldSkipApiLimiter,
  sanitizeData,
  sanitizeMiddleware,
  sanitizeParams
};
