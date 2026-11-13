const test = require('node:test');
const assert = require('node:assert/strict');
const { getCropImageProxy } = require('../src/controllers/mandiController');
const { fetchDistrictWeather } = require('../src/services/externalApiService');
const { shouldSkipApiLimiter } = require('../src/middleware/securityMiddleware');

function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body;
  return {
    set(key, val) {
      headers[key.toLowerCase()] = val;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
    snapshot() {
      return { statusCode, headers, body };
    }
  };
}

test('getCropImageProxy rejects non-Wikimedia hosts and insecure URLs to prevent SSRF', async () => {
  const badUrls = [
    'http://127.0.0.1:5001/secret',
    'https://evil.example.com/image.jpg',
    'not-a-url'
  ];

  for (const url of badUrls) {
    const res = createMockRes();
    await getCropImageProxy({ query: { url } }, res);
    assert.equal(res.snapshot().statusCode, 400);
  }
});

test('getCropImageProxy fetches allowlisted Wikimedia URL once, caches bytes, and allows limiter skip', async () => {
  assert.equal(shouldSkipApiLimiter({ originalUrl: '/api/mandi-rates/image?crop=Onion' }), true);

  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const fakeBytes = Uint8Array.from([255, 216, 255, 224]).buffer;

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    assert.match(String(url), /^https:\/\/thumb\.wikimedia\.org\//);
    return {
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => fakeBytes
    };
  };

  try {
    const testUrl = `https://thumb.wikimedia.org/wikipedia/commons/thumb/test-${Date.now()}.jpg`;
    const res1 = createMockRes();
    await getCropImageProxy({ query: { url: testUrl } }, res1);
    const snap1 = res1.snapshot();
    assert.equal(snap1.statusCode, 200);
    assert.equal(snap1.headers['content-type'], 'image/jpeg');
    assert.equal(snap1.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.equal(Buffer.isBuffer(snap1.body), true);

    const res2 = createMockRes();
    await getCropImageProxy({ query: { url: testUrl } }, res2);
    assert.equal(res2.snapshot().statusCode, 200);
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchDistrictWeather falls back cleanly to wttr.in when Open-Meteo returns 429', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    if (str.includes('open-meteo.com')) {
      return { ok: false, status: 429 };
    }
    if (str.includes('wttr.in')) {
      return {
        ok: true,
        json: async () => ({
          current_condition: [
            {
              temp_C: '31',
              humidity: '40',
              windspeedKmph: '12',
              precipMM: '0.0',
              weatherDesc: [{ value: 'Clear Sky' }]
            }
          ],
          weather: [{ date: '2026-11-12', maxtempC: '33', mintempC: '19', hourly: [{}, {}, {}, {}, { chanceofrain: '5' }] }]
        })
      };
    }
    throw new Error(`Unexpected URL: ${str}`);
  };

  try {
    const weather = await fetchDistrictWeather({ district: 'Nagpur' });
    assert.equal(weather.district, 'Nagpur');
    assert.equal(weather.temperatureC, 31);
    assert.equal(weather.humidityPercent, 40);
    assert.equal(weather.todayMaxC, 33);
    assert.equal(weather.todayMinC, 19);
    assert.match(weather.source, /Wttr\.in/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

