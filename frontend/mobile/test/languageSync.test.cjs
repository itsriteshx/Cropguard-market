const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { syncLanguagePreference } = require('../src/auth/languageSync');

describe('languageSync reliability', () => {
  const SUPPORTED_LANG_CODES = ['en', 'hi', 'kn', 'mr', 'te', 'ta', 'gu', 'pa'];

  test('1. successful language synchronization returns synced: true with backend data', async () => {
    let capturedEndpoint, capturedOptions, capturedToken;
    const mockRequest = async (endpoint, options, token) => {
      capturedEndpoint = endpoint;
      capturedOptions = options;
      capturedToken = token;
      return {
        success: true,
        user: { _id: 'u1', languagePreference: 'hi' }
      };
    };

    const result = await syncLanguagePreference(mockRequest, 'auth-jwt-xyz', 'hi');
    assert.equal(capturedEndpoint, '/auth/language');
    assert.equal(capturedOptions.method, 'PATCH');
    assert.equal(capturedToken, 'auth-jwt-xyz');
    assert.deepEqual(JSON.parse(capturedOptions.body), { languagePreference: 'hi' });
    assert.equal(result.success, true);
    assert.equal(result.synced, true);
    assert.equal(result.language, 'hi');
  });

  test('2. backend rejection (success: false) returns structured error without throwing', async () => {
    const mockRequest = async () => ({
      success: false,
      message: 'Language preference not supported by server',
      httpStatus: 400
    });

    const result = await syncLanguagePreference(mockRequest, 'auth-token', 'xx');
    assert.equal(result.success, false);
    assert.equal(result.synced, false);
    assert.equal(result.error, 'Language preference not supported by server');
    assert.equal(result.status, 400);
  });

  test('3. unauthenticated language change saves locally and skips network call', async () => {
    let networkCalled = false;
    const mockRequest = async () => {
      networkCalled = true;
      return { success: true };
    };

    const result = await syncLanguagePreference(mockRequest, null, 'kn');
    assert.equal(networkCalled, false);
    assert.equal(result.success, true);
    assert.equal(result.synced, false);
    assert.match(result.message, /Saved locally/);
  });

  test('4. network failure / exception caught and returned as structured failure', async () => {
    const mockRequest = async () => {
      throw new Error('Network request failed: timeout');
    };

    const result = await syncLanguagePreference(mockRequest, 'token-123', 'mr');
    assert.equal(result.success, false);
    assert.equal(result.synced, false);
    assert.match(result.error, /Network request failed/);
  });

  test('5. missing or malformed response handled safely', async () => {
    // 5a: request returns null
    const mockNull = async () => null;
    const resultNull = await syncLanguagePreference(mockNull, 'token', 'te');
    assert.equal(resultNull.success, false);
    assert.equal(resultNull.synced, false);
    assert.match(resultNull.error, /Failed to sync/);

    // 5b: request returns undefined
    const mockUndef = async () => undefined;
    const resultUndef = await syncLanguagePreference(mockUndef, 'token', 'ta');
    assert.equal(resultUndef.success, false);
    assert.equal(resultUndef.synced, false);

    // 5c: invalid language code argument (null, number, empty)
    const resultEmpty = await syncLanguagePreference(async () => {}, 'token', '');
    assert.equal(resultEmpty.success, false);
    assert.equal(resultEmpty.synced, false);
    assert.match(resultEmpty.error, /Valid language code is required/);

    const resultNonString = await syncLanguagePreference(async () => {}, 'token', 123);
    assert.equal(resultNonString.success, false);
  });

  test('6. all 8 supported agricultural languages synchronize successfully', async () => {
    for (const code of SUPPORTED_LANG_CODES) {
      let sentBody;
      const mockRequest = async (_endpoint, options) => {
        sentBody = JSON.parse(options.body);
        return { success: true, language: code };
      };

      const result = await syncLanguagePreference(mockRequest, 'jwt-token', code);
      assert.equal(result.success, true);
      assert.equal(result.synced, true);
      assert.equal(result.language, code);
      assert.equal(sentBody.languagePreference, code);
    }
  });

  test('7. verify payload schema conforms to PATCH /auth/language contract', async () => {
    let capturedPayload;
    const mockRequest = async (_endpoint, options) => {
      capturedPayload = JSON.parse(options.body);
      return { success: true };
    };

    await syncLanguagePreference(mockRequest, 'jwt-tok', 'gu');
    assert.ok(capturedPayload !== null && typeof capturedPayload === 'object');
    assert.equal(Object.keys(capturedPayload).length, 1);
    assert.equal(capturedPayload.languagePreference, 'gu');
  });
});
