/**
 * CORS Configuration for Express HTTP and Socket.IO
 *
 * Rules:
 * - Production requires at least one explicitly configured origin (CLIENT_URL or MOBILE_CLIENT_URL).
 * - Wildcard origins ('*') are strictly forbidden in production.
 * - Origins are normalized via URL parsing (strips trailing slashes, paths, and lowercases hostnames).
 * - Malformed origins, non-http(s) schemes, and blank values are rejected.
 * - Supports web-only, mobile-only, or multi-origin production configurations.
 * - Permits originless requests in all environments (mobile native apps, curl, server-to-server).
 * - Ensures consistent development behavior across Express and Socket.IO.
 */

function normalizeOrigin(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed === '*' || trimmed.includes('*')) {
    return '*';
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error(`[CORS Security Error] Malformed origin configured: "${trimmed}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[CORS Security Error] Origin must use HTTP or HTTPS protocol: "${trimmed}"`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`[CORS Security Error] Configured origin must not contain credentials: "${trimmed}"`);
  }

  if (parsed.pathname && parsed.pathname !== '/') {
    throw new Error(`[CORS Security Error] Configured origin must not contain a path: "${trimmed}"`);
  }

  if (parsed.search) {
    throw new Error(`[CORS Security Error] Configured origin must not contain a query string: "${trimmed}"`);
  }

  if (parsed.hash) {
    throw new Error(`[CORS Security Error] Configured origin must not contain a fragment: "${trimmed}"`);
  }

  return parsed.origin;
}

function getAllowedOrigins(env = process.env) {
  const rawValues = [env.CLIENT_URL, env.MOBILE_CLIENT_URL]
    .filter((val) => val !== undefined && val !== null)
    .flatMap((val) => String(val).split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  if (env.NODE_ENV === 'production') {
    if (rawValues.length === 0) {
      throw new Error(
        '[CORS Security Error] Production environment requires at least one explicit origin (CLIENT_URL or MOBILE_CLIENT_URL). Wildcards and missing origins are prohibited.'
      );
    }

    if (rawValues.some((origin) => origin === '*' || origin.includes('*'))) {
      throw new Error(
        '[CORS Security Error] Wildcard origins ("*") are strictly prohibited in production.'
      );
    }

    const normalized = rawValues.map((raw) => {
      const norm = normalizeOrigin(raw);
      if (!norm || norm === '*') {
        throw new Error(
          '[CORS Security Error] Wildcard origins ("*") or blank values are strictly prohibited in production.'
        );
      }
      return norm;
    });

    return Array.from(new Set(normalized));
  }

  // Development: normalize configured origins if valid
  const normalized = [];
  for (const raw of rawValues) {
    if (raw === '*' || raw.includes('*')) {
      normalized.push('*');
    } else {
      try {
        const norm = normalizeOrigin(raw);
        if (norm) normalized.push(norm);
      } catch {
        // In development, preserve non-crashing behavior for raw values
      }
    }
  }
  return Array.from(new Set(normalized));
}

function createOriginChecker(env = process.env) {
  return function checkOrigin(origin, callback) {
    // Requests without origin header (mobile native apps, curl, Postman, server-to-server) are permitted
    if (!origin) {
      if (typeof callback === 'function') callback(null, true);
      return true;
    }

    // Development mode: allow all origins consistently with Socket.IO
    if (env.NODE_ENV !== 'production') {
      if (typeof callback === 'function') callback(null, true);
      return true;
    }

    const allowed = getAllowedOrigins(env);
    let normalizedIncoming = origin;
    try {
      normalizedIncoming = new URL(origin).origin;
    } catch {
      // If incoming origin is not a parseable URL, match literally
    }

    if (allowed.includes(origin) || allowed.includes(normalizedIncoming)) {
      if (typeof callback === 'function') callback(null, true);
      return true;
    }

    const err = new Error(`[CORS Error] Origin ${origin} not allowed by CORS policy`);
    if (typeof callback === 'function') {
      callback(err, false);
    }
    return false;
  };
}

function getSocketCorsConfig(env = process.env) {
  if (env.NODE_ENV === 'production') {
    const allowed = getAllowedOrigins(env);
    return {
      origin: allowed,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true
    };
  }

  // Development mode: consistent permissive origin checker matching Express CORS
  return {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  };
}

function getExpressCorsOptions(env = process.env) {
  return {
    origin: createOriginChecker(env),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
  };
}

module.exports = {
  normalizeOrigin,
  getAllowedOrigins,
  createOriginChecker,
  getSocketCorsConfig,
  getExpressCorsOptions
};
