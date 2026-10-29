const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// General API rate limiter (150 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again after 15 minutes'
  }
});

// Strict rate limiter for authentication endpoints (15 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  }
});

/**
 * Custom NoSQL injection protection middleware
 * Recursively strips keys starting with '$' or containing '.' from req.body and req.query
 */
const sanitizeData = (data) => {
  if (data instanceof Object) {
    for (const key in data) {
      if (/^\$/.test(key) || /\./.test(key)) {
        delete data[key];
      } else {
        sanitizeData(data[key]);
      }
    }
  }
  return data;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) sanitizeData(req.body);
  if (req.query) sanitizeData(req.query);
  if (req.params) sanitizeData(req.params);
  next();
};

module.exports = {
  helmetMiddleware: helmet(),
  apiLimiter,
  authLimiter,
  sanitizeMiddleware
};
