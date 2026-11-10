const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSessionManager } = require('../src/auth/sessionManager');

test('restores only a server-validated session and preserves token during outages', async () => {
  let token = 'saved-token';
  const store = { get: async () => token, set: async (value) => { token = value; }, remove: async () => { token = null; } };
  let response = { success: true, user: { _id: 'buyer', role: 'BUYER_RETAIL' } };
  const manager = createSessionManager(store, async (_path, _options, actualToken) => { assert.equal(actualToken, 'saved-token'); return response; });
  assert.deepEqual(await manager.restore(), { state: 'authenticated', token: 'saved-token', user: response.user });
  response = { success: false, networkError: true };
  assert.deepEqual(await manager.restore(), { state: 'unavailable' });
  assert.equal(token, 'saved-token');
  response = { success: false, httpStatus: 401 };
  assert.deepEqual(await manager.restore(), { state: 'signedOut' });
  assert.equal(token, null);
});

test('storage failures propagate for saving and clearing sessions', async () => {
  const error = new Error('storage failed');
  const manager = createSessionManager({ get: async () => { throw error; }, set: async () => { throw error; }, remove: async () => { throw error; } }, async () => ({}));
  await assert.rejects(manager.restore(), /storage failed/);
  await assert.rejects(manager.save('token'), /storage failed/);
  await assert.rejects(manager.clear(), /storage failed/);
});
