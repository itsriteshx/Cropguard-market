const { SUPPORTED_LANGUAGES, translate } = require('../i18n/locales');

/**
 * i18n Middleware — Automatic Language Detection & Localization Engine
 * Detects user language from JWT profile, X-Language header, Accept-Language, or query param.
 * Injects req.language, req.locale, and req.t(key, params) into every request.
 */
const i18nMiddleware = (req, res, next) => {
  let detectedLang = 'en';

  // 1. Check authenticated user profile preference
  if (req.user && req.user.languagePreference && SUPPORTED_LANGUAGES[req.user.languagePreference]) {
    detectedLang = req.user.languagePreference;
  }
  // 2. Check custom X-Language header
  else if (req.headers['x-language'] && SUPPORTED_LANGUAGES[req.headers['x-language'].toLowerCase()]) {
    detectedLang = req.headers['x-language'].toLowerCase();
  }
  // 3. Check query param: ?lang=kn
  else if (req.query.lang && SUPPORTED_LANGUAGES[req.query.lang.toLowerCase()]) {
    detectedLang = req.query.lang.toLowerCase();
  }
  // 4. Parse Accept-Language header (e.g. "kn-IN,kn;q=0.9,hi;q=0.8,en;q=0.7")
  else if (req.headers['accept-language']) {
    const raw = req.headers['accept-language'];
    const candidates = raw
      .split(',')
      .map((part) => part.split(';')[0].trim().toLowerCase().slice(0, 2));

    for (const code of candidates) {
      if (SUPPORTED_LANGUAGES[code]) {
        detectedLang = code;
        break;
      }
    }
  }

  req.language = detectedLang;
  req.locale = SUPPORTED_LANGUAGES[detectedLang];

  // Helper translation function bound to current request language
  req.t = (key, params = {}) => translate(detectedLang, key, params);

  // Set standard Content-Language response header
  res.setHeader('Content-Language', detectedLang);

  next();
};

module.exports = i18nMiddleware;
