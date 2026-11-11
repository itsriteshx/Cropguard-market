const test = require('node:test');
const assert = require('node:assert/strict');
const { getJwtSecret } = require('../src/config/jwtSecret');
const {
  normalizeOrigin,
  getAllowedOrigins,
  createOriginChecker,
  getSocketCorsConfig,
  getExpressCorsOptions
} = require('../src/config/corsConfig');

// JWT Secret Validation Tests
test('getJwtSecret returns configured JWT_SECRET when provided with valid length in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'my_super_secure_production_key_12345_67890';
    assert.equal(getJwtSecret(), 'my_super_secure_production_key_12345_67890');
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  }
});

test('getJwtSecret returns development fallback when not in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    assert.equal(getJwtSecret(), 'cropguard_dev_secret_key_adypu_2026');
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  }
});

test('getJwtSecret rejects missing, whitespace-only, or insufficiently strong secrets in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';

    // 1. Missing secret
    delete process.env.JWT_SECRET;
    assert.throws(
      () => getJwtSecret(),
      /FATAL: JWT_SECRET environment variable must be set in production mode/
    );

    // 2. Whitespace-only secret
    process.env.JWT_SECRET = '   ';
    assert.throws(
      () => getJwtSecret(),
      /FATAL: JWT_SECRET environment variable must be set in production mode/
    );

    // 3. Short secret (< 32 chars)
    process.env.JWT_SECRET = 'too_short_secret';
    assert.throws(
      () => getJwtSecret(),
      /FATAL: JWT_SECRET must be at least 32 characters in production mode/
    );

    // 4. Default placeholder secret
    process.env.JWT_SECRET = 'cropguard_dev_secret_key_adypu_2026';
    assert.throws(
      () => getJwtSecret(),
      /FATAL: Insecure default or placeholder JWT_SECRET cannot be used in production mode/
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  }
});

// Production Origin Configuration & Normalization Tests
test('normalizeOrigin: strips trailing slashes and normalizes scheme/host to lowercase', () => {
  assert.equal(normalizeOrigin('https://cropguard.market/'), 'https://cropguard.market');
  assert.equal(normalizeOrigin('https://cropguard.market'), 'https://cropguard.market');
  assert.equal(normalizeOrigin('HTTP://LOCALHOST:5173/'), 'http://localhost:5173');
});

test('normalizeOrigin: rejects values containing paths, query strings, fragments, or credentials', () => {
  assert.throws(
    () => normalizeOrigin('https://cropguard.market/some/path'),
    /Configured origin must not contain a path/
  );
  assert.throws(
    () => normalizeOrigin('https://cropguard.market?param=1'),
    /Configured origin must not contain a query string/
  );
  assert.throws(
    () => normalizeOrigin('https://cropguard.market#section'),
    /Configured origin must not contain a fragment/
  );
  assert.throws(
    () => normalizeOrigin('https://user:pass@cropguard.market'),
    /Configured origin must not contain credentials/
  );
});

test('normalizeOrigin: rejects non-http protocols and malformed URLs', () => {
  assert.throws(
    () => normalizeOrigin('ftp://cropguard.market'),
    /Origin must use HTTP or HTTPS protocol/
  );
  assert.throws(
    () => normalizeOrigin('javascript:alert(1)'),
    /Origin must use HTTP or HTTPS protocol/
  );
  assert.throws(
    () => normalizeOrigin('not-a-valid-url'),
    /Malformed origin configured/
  );
  assert.throws(
    () => normalizeOrigin('https://cropguard.market:invalid'),
    /Malformed origin configured/
  );
});

test('getAllowedOrigins: normalizes configured origins and accepts web, mobile, or dual configurations', () => {
  // Dual origins with trailing slash
  const envDual = {
    NODE_ENV: 'production',
    CLIENT_URL: 'https://cropguard.market/',
    MOBILE_CLIENT_URL: 'https://mobile.cropguard.market/'
  };
  assert.deepEqual(getAllowedOrigins(envDual), [
    'https://cropguard.market',
    'https://mobile.cropguard.market'
  ]);

  // Only web origin
  const envWeb = {
    NODE_ENV: 'production',
    CLIENT_URL: 'https://cropguard.market'
  };
  assert.deepEqual(getAllowedOrigins(envWeb), ['https://cropguard.market']);

  // Only mobile origin
  const envMobile = {
    NODE_ENV: 'production',
    MOBILE_CLIENT_URL: 'https://mobile.cropguard.market'
  };
  assert.deepEqual(getAllowedOrigins(envMobile), ['https://mobile.cropguard.market']);
});

test('getAllowedOrigins: throws in production for empty, whitespace, malformed, or wildcard origins', () => {
  // Missing origins
  assert.throws(
    () => getAllowedOrigins({ NODE_ENV: 'production' }),
    /Production environment requires at least one explicit origin/
  );

  // Whitespace-only origins
  assert.throws(
    () => getAllowedOrigins({ NODE_ENV: 'production', CLIENT_URL: '   ' }),
    /Production environment requires at least one explicit origin/
  );

  // Wildcard origins
  assert.throws(
    () => getAllowedOrigins({ NODE_ENV: 'production', CLIENT_URL: '*' }),
    /Wildcard origins \("\*"\) are strictly prohibited in production/
  );
  assert.throws(
    () => getAllowedOrigins({ NODE_ENV: 'production', CLIENT_URL: 'https://cropguard.market', MOBILE_CLIENT_URL: '*' }),
    /Wildcard origins \("\*"\) are strictly prohibited in production/
  );

  // Malformed origins
  assert.throws(
    () => getAllowedOrigins({ NODE_ENV: 'production', CLIENT_URL: 'htt//invalid-url' }),
    /Malformed origin configured/
  );
});

// Express & Socket.IO CORS Consistency Tests
test('CORS consistency: Express and Socket.IO development policies both permit incoming origins', () => {
  const envDev = {
    NODE_ENV: 'development',
    CLIENT_URL: 'http://localhost:5173'
  };

  // Express origin checker
  const expressChecker = createOriginChecker(envDev);
  let expressAllowed = null;
  expressChecker('http://localhost:3000', (err, allow) => {
    assert.equal(err, null);
    expressAllowed = allow;
  });
  assert.equal(expressAllowed, true);

  // Socket.IO origin function
  const socketConfig = getSocketCorsConfig(envDev);
  assert.equal(typeof socketConfig.origin, 'function');
  let socketAllowed = null;
  socketConfig.origin('http://localhost:3000', (err, allow) => {
    assert.equal(err, null);
    socketAllowed = allow;
  });
  assert.equal(socketAllowed, true);
});

test('Express CORS policy: enforces origin whitelisting in production and allows originless requests', () => {
  const env = {
    NODE_ENV: 'production',
    CLIENT_URL: 'https://cropguard.market/',
    MOBILE_CLIENT_URL: 'https://mobile.cropguard.market/'
  };
  const checker = createOriginChecker(env);

  // 1. Allowed web origin (even with trailing slash normalized)
  let allowedWeb = null;
  checker('https://cropguard.market', (err, allow) => {
    assert.equal(err, null);
    allowedWeb = allow;
  });
  assert.equal(allowedWeb, true);

  // 2. Allowed mobile origin
  let allowedMobile = null;
  checker('https://mobile.cropguard.market', (err, allow) => {
    assert.equal(err, null);
    allowedMobile = allow;
  });
  assert.equal(allowedMobile, true);

  // 3. Rejected unconfigured origin
  let rejectedErr = null;
  checker('https://unauthorized-domain.com', (err, allow) => {
    rejectedErr = err;
  });
  assert.match(rejectedErr.message, /not allowed by CORS policy/);

  // 4. Allowed request with no origin (native mobile apps, curl, server-to-server)
  let noOriginAllowed = null;
  checker(undefined, (err, allow) => {
    assert.equal(err, null);
    noOriginAllowed = allow;
  });
  assert.equal(noOriginAllowed, true);
});
