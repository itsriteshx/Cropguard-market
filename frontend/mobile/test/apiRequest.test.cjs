const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { apiRequest, API_BASE_URL } = require('../src/config/api');

describe('apiRequest client reliability', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('1. successful JSON GET response returns parsed data and httpStatus: 200', async () => {
    let capturedUrl, capturedOptions;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
        json: async () => ({ success: true, listings: [{ id: 1, crop: 'Wheat' }] })
      };
    };

    const res = await apiRequest('/listings');
    assert.equal(capturedUrl, `${API_BASE_URL}/listings`);
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(res.success, true);
    assert.equal(res.httpStatus, 200);
    assert.deepEqual(res.listings, [{ id: 1, crop: 'Wheat' }]);
  });

  test('2. successful POST request with JSON body sends correct method and body', async () => {
    let capturedOptions;
    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return {
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, id: 'lot-123' })
      };
    };

    const payload = JSON.stringify({ cropName: 'Tomato', quantity: 50 });
    const res = await apiRequest('/listings', {
      method: 'POST',
      body: payload
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.body, payload);
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(res.success, true);
    assert.equal(res.httpStatus, 201);
  });

  test('3. bearer token attachment: attaches token when provided, omits when null', async () => {
    let capturedOptionsWithToken;
    global.fetch = async (_url, options) => {
      capturedOptionsWithToken = options;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, user: { name: 'Ramesh' } })
      };
    };

    await apiRequest('/auth/me', {}, 'my-jwt-token-xyz');
    assert.equal(capturedOptionsWithToken.headers['Authorization'], 'Bearer my-jwt-token-xyz');

    let capturedOptionsWithoutToken;
    global.fetch = async (_url, options) => {
      capturedOptionsWithoutToken = options;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, rates: [] })
      };
    };

    await apiRequest('/mandi-rates', {}, null);
    assert.equal(capturedOptionsWithoutToken.headers['Authorization'], undefined);
  });

  test('4. correct Content-Type handling and custom headers preservation', async () => {
    let capturedOptions;
    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true })
      };
    };

    await apiRequest('/test', {
      headers: {
        'X-Custom-Client': 'MobileExpo',
        'Accept-Language': 'hi'
      }
    });

    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(capturedOptions.headers['X-Custom-Client'], 'MobileExpo');
    assert.equal(capturedOptions.headers['Accept-Language'], 'hi');
  });

  test('5. FormData requests do not receive an incorrectly forced JSON Content-Type', async () => {
    let capturedOptions;
    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, images: ['http://img.example/1.jpg'] })
      };
    };

    const form = new FormData();
    form.append('description', 'Fresh harvest');

    const res = await apiRequest('/upload', {
      method: 'POST',
      body: form
    }, 'upload-token');

    assert.equal(capturedOptions.headers['Content-Type'], undefined);
    assert.equal(capturedOptions.headers['Authorization'], 'Bearer upload-token');
    assert.equal(res.success, true);
  });

  test('6. non-JSON response handling (HTML/text error page)', async () => {
    global.fetch = async () => ({
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>502 Bad Gateway</body></html>'
    });

    const res = await apiRequest('/mandi-rates/live');
    assert.equal(res.success, false);
    assert.equal(res.httpStatus, 502);
    assert.match(res.message, /Bad Gateway/);
  });

  test('7. malformed JSON response handling preserves httpStatus without false networkError', async () => {
    global.fetch = async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      }
    });

    const res = await apiRequest('/corrupt-endpoint');
    assert.equal(res.success, false);
    assert.equal(res.httpStatus, 200);
    assert.equal(res.networkError, undefined);
    assert.match(res.message, /Malformed JSON/);
  });

  test('8. HTTP 400 response propagation and error body parsing', async () => {
    global.fetch = async () => ({
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Invalid crop quantity specified.' })
    });

    const res = await apiRequest('/listings', { method: 'POST', body: '{}' });
    assert.equal(res.success, false);
    assert.equal(res.httpStatus, 400);
    assert.equal(res.message, 'Invalid crop quantity specified.');
  });

  test('9. HTTP 401 unauthorized response propagation', async () => {
    global.fetch = async () => ({
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Not authorized, token failed.' })
    });

    const res = await apiRequest('/auth/me', {}, 'expired-token');
    assert.equal(res.success, false);
    assert.equal(res.httpStatus, 401);
    assert.equal(res.message, 'Not authorized, token failed.');
  });

  test('10. HTTP 500 server error response propagation', async () => {
    global.fetch = async () => ({
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Database connection failed.' })
    });

    const res = await apiRequest('/orders');
    assert.equal(res.success, false);
    assert.equal(res.httpStatus, 500);
    assert.equal(res.message, 'Database connection failed.');
  });

  test('11. network failure returns structured networkError response', async () => {
    global.fetch = async () => {
      throw new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:5001');
    };

    const res = await apiRequest('/health');
    assert.equal(res.success, false);
    assert.equal(res.networkError, true);
    assert.match(res.message, /fetch failed|ECONNREFUSED/);
  });

  test('12. request timeout returns structured timeout message', async () => {
    global.fetch = async (_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const res = await apiRequest('/slow-endpoint', { timeoutMs: 50 });
    assert.equal(res.success, false);
    assert.equal(res.networkError, true);
    assert.match(res.message, /Server timeout/);
  });

  test('13. custom timeout configuration respects options.timeoutMs', async () => {
    let capturedSignal;
    global.fetch = async (_url, options) => {
      capturedSignal = options.signal;
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true })
      };
    };

    const res = await apiRequest('/fast-endpoint', { timeoutMs: 15000 });
    assert.equal(res.success, true);
    assert.equal(capturedSignal.aborted, false);
  });

  test('14. correct HTTP status propagation across various status codes', async () => {
    for (const code of [200, 201, 403, 404, 422, 503]) {
      global.fetch = async () => ({
        status: code,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: code < 400, code })
      });

      const res = await apiRequest('/status-test');
      assert.equal(res.httpStatus, code);
      assert.equal(res.success, code < 400);
    }
  });

  test('14b. HTTP 204 No Content response succeeds without calling body-parsing methods', async () => {
    global.fetch = async () => ({
      status: 204,
      headers: new Headers(),
      json: async () => { throw new Error('res.json() must not be called on HTTP 204'); },
      text: async () => { throw new Error('res.text() must not be called on HTTP 204'); }
    });

    const res = await apiRequest('/no-content-endpoint');
    assert.equal(res.success, true);
    assert.equal(res.httpStatus, 204);
  });

  test('15. error response shape remains consistent across all failure modes', async () => {
    // 15a: HTTP 404 with JSON
    global.fetch = async () => ({
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Route not found' })
    });
    let res = await apiRequest('/missing');
    assert.equal(typeof res.success, 'boolean');
    assert.equal(typeof res.message, 'string');
    assert.equal(typeof res.httpStatus, 'number');

    // 15b: Non-JSON error
    global.fetch = async () => ({
      status: 503,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'Service Unavailable'
    });
    res = await apiRequest('/busy');
    assert.equal(res.success, false);
    assert.equal(res.message, 'Service Unavailable');
    assert.equal(res.httpStatus, 503);

    // 15c: Network error
    global.fetch = async () => {
      throw new Error('DNS lookup failure');
    };
    res = await apiRequest('/dns-err');
    assert.equal(res.success, false);
    assert.equal(res.networkError, true);
    assert.match(res.message, /DNS lookup failure/);
  });
});
