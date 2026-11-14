const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createSessionManager } = require('../src/auth/sessionManager');

describe('sessionManager reliability', () => {
  test('1. no stored token returns signedOut without calling network', async () => {
    let networkCalled = false;
    const store = { get: async () => null, set: async () => {}, remove: async () => {} };
    const manager = createSessionManager(store, async () => {
      networkCalled = true;
      return { success: true };
    });

    const result = await manager.restore();
    assert.deepEqual(result, { state: 'signedOut' });
    assert.equal(networkCalled, false);
  });

  test('2 & 3. valid stored token with successful /auth/me returns authenticated state', async () => {
    let capturedPath, capturedToken;
    const mockUser = { _id: 'farmer-1', name: 'Suresh Patil', role: 'FARMER', languagePreference: 'kn' };
    const store = { get: async () => 'valid-jwt-token', set: async () => {}, remove: async () => {} };
    const manager = createSessionManager(store, async (path, _options, token) => {
      capturedPath = path;
      capturedToken = token;
      return { success: true, user: mockUser };
    });

    const result = await manager.restore();
    assert.equal(capturedPath, '/auth/me');
    assert.equal(capturedToken, 'valid-jwt-token');
    assert.deepEqual(result, {
      state: 'authenticated',
      token: 'valid-jwt-token',
      user: mockUser
    });
  });

  test('4 & 5. invalid token / HTTP 401 cleans up stale token and returns signedOut', async () => {
    let tokenInStore = 'expired-token';
    let removeCalled = false;
    const store = {
      get: async () => tokenInStore,
      set: async (val) => { tokenInStore = val; },
      remove: async () => {
        removeCalled = true;
        tokenInStore = null;
      }
    };

    const manager = createSessionManager(store, async () => ({
      success: false,
      httpStatus: 401,
      message: 'Token expired or invalid'
    }));

    const result = await manager.restore();
    assert.deepEqual(result, { state: 'signedOut' });
    assert.equal(removeCalled, true);
    assert.equal(tokenInStore, null);
  });

  test('6. network unavailable during restoration preserves token and returns unavailable', async () => {
    let tokenInStore = 'saved-offline-token';
    let removeCalled = false;
    const store = {
      get: async () => tokenInStore,
      set: async () => {},
      remove: async () => { removeCalled = true; }
    };

    const manager = createSessionManager(store, async () => ({
      success: false,
      networkError: true,
      message: 'Network error connecting to backend'
    }));

    const result = await manager.restore();
    assert.deepEqual(result, { state: 'unavailable' });
    assert.equal(removeCalled, false, 'Token must not be removed during network outages');
    assert.equal(tokenInStore, 'saved-offline-token');
  });

  test('7. storage read failure propagates exception to caller', async () => {
    const readErr = new Error('SecureStore keychain read failed');
    const store = {
      get: async () => { throw readErr; },
      set: async () => {},
      remove: async () => {}
    };
    const manager = createSessionManager(store, async () => ({ success: true }));

    await assert.rejects(manager.restore(), /SecureStore keychain read failed/);
  });

  test('7b. storage write failure propagates during save()', async () => {
    const writeErr = new Error('SecureStore write failed');
    const store = {
      get: async () => null,
      set: async () => { throw writeErr; },
      remove: async () => {}
    };
    const manager = createSessionManager(store, async () => ({ success: true }));

    await assert.rejects(manager.save('token-to-save'), /SecureStore write failed/);
  });

  test('8. storage deletion failure propagates during clear() and 401 restoration', async () => {
    const deleteErr = new Error('SecureStore deletion failed');
    const store = {
      get: async () => 'token',
      set: async () => {},
      remove: async () => { throw deleteErr; }
    };

    const managerWith401 = createSessionManager(store, async () => ({
      success: false,
      httpStatus: 401
    }));
    await assert.rejects(managerWith401.restore(), /SecureStore deletion failed/);

    const managerClear = createSessionManager(store, async () => ({}));
    await assert.rejects(managerClear.clear(), /SecureStore deletion failed/);
  });

  test('9. unexpected API response (500 or malformed) returns unavailable without wiping token', async () => {
    let tokenInStore = 'token-to-preserve';
    let removeCalled = false;
    const store = {
      get: async () => tokenInStore,
      set: async () => {},
      remove: async () => { removeCalled = true; }
    };

    // 9a: HTTP 500 error
    const manager500 = createSessionManager(store, async () => ({
      success: false,
      httpStatus: 500,
      message: 'Internal server error'
    }));
    const result500 = await manager500.restore();
    assert.deepEqual(result500, { state: 'unavailable' });
    assert.equal(removeCalled, false);

    // 9b: success: true but missing user object
    const managerNoUser = createSessionManager(store, async () => ({
      success: true,
      user: null
    }));
    const resultNoUser = await managerNoUser.restore();
    assert.deepEqual(resultNoUser, { state: 'unavailable' });
    assert.equal(removeCalled, false);
  });

  test('10. no accidental authentication state restoration when validation fails', async () => {
    const store = { get: async () => 'some-token', set: async () => {}, remove: async () => {} };

    // Failure with 403 Forbidden
    const manager403 = createSessionManager(store, async () => ({
      success: false,
      httpStatus: 403
    }));
    const result403 = await manager403.restore();
    assert.notEqual(result403.state, 'authenticated');
    assert.equal(result403.state, 'unavailable');

    // save() correctly writes to store
    let savedToken = null;
    const writeStore = {
      get: async () => savedToken,
      set: async (t) => { savedToken = t; },
      remove: async () => { savedToken = null; }
    };
    const managerWrite = createSessionManager(writeStore, async () => ({}));
    await managerWrite.save('new-session-jwt');
    assert.equal(savedToken, 'new-session-jwt');

    // clear() correctly removes from store
    await managerWrite.clear();
    assert.equal(savedToken, null);
  });
});
