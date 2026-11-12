const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getImageSource, subscribeUnauthorized, apiRequest, API_BASE_URL } = require('../src/config/api');

test('subscribeUnauthorized fires for protected 401 responses and skips /auth/ endpoints', async () => {
  const origFetch = global.fetch;
  const events = [];
  const unsub = subscribeUnauthorized((msg) => events.push(msg));
  try {
    global.fetch = async () => ({
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Invalid signature' })
    });
    await apiRequest('/auth/me', {}, 'bad-token');
    assert.equal(events.length, 0);

    await apiRequest('/assistant/query', { method: 'POST', body: '{}' }, 'bad-token');
    assert.deepEqual(events, ['Invalid signature']);
  } finally {
    unsub();
    global.fetch = origFetch;
  }
});

test('getImageSource proxies Wikimedia URLs through backend and resolves /uploads paths', () => {
  const wikiUrl = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Soybean.USDA.jpg/330px-Soybean.USDA.jpg';
  const wikiSource = getImageSource(wikiUrl);
  assert.deepEqual(wikiSource, {
    uri: `${API_BASE_URL}/mandi-rates/image?url=${encodeURIComponent(wikiUrl)}`
  });

  const origin = API_BASE_URL.replace(/\/api$/, '');
  const uploadSource = getImageSource('/uploads/produce-123.jpeg');
  assert.deepEqual(uploadSource, { uri: `${origin}/uploads/produce-123.jpeg` });

  assert.equal(getImageSource(null), null);
  assert.equal(getImageSource(''), null);
});
