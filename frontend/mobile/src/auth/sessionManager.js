// Keep the token as the source of truth. A cached profile cannot prove a
// session is valid, so restoration waits for the backend before signing in.
function createSessionManager(store, request) {
  return {
    async restore() {
      const token = await store.get();
      if (!token) return { state: 'signedOut' };
      const result = await request('/auth/me', {}, token);
      if (result.success && result.user) return { state: 'authenticated', token, user: result.user };
      if (result.httpStatus === 401) {
        await store.remove();
        return { state: 'signedOut' };
      }
      return { state: 'unavailable' };
    },
    save: (token) => store.set(token),
    clear: () => store.remove()
  };
}
module.exports = { createSessionManager };
