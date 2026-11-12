const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { createTypingController } = require('../src/utils/typingController');

function loadSocketService() {
  const mobileRoot = path.resolve(__dirname, '..');
  const mobileRequire = createRequire(path.join(mobileRoot, 'package.json'));
  const babel = mobileRequire('@babel/core');
  const preset = mobileRequire.resolve('babel-preset-expo');
  const socketServicePath = path.join(mobileRoot, 'src/services/socketService.js');
  const { code } = babel.transformFileSync(socketServicePath, { presets: [preset] });

  const mod = { exports: {} };
  const serviceRequire = createRequire(socketServicePath);
  const fn = vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {\n${code}\n})`);
  fn(mod.exports, serviceRequire, mod, socketServicePath, path.dirname(socketServicePath));
  return mod.exports.socketService;
}

test('socketService exposes typing helpers that safely handle disconnected sockets and emit room events', () => {
  const socketService = loadSocketService();

  assert.equal(typeof socketService.startTyping, 'function');
  assert.equal(typeof socketService.stopTyping, 'function');
  assert.equal(typeof socketService.onParticipantTyping, 'function');

  // Disconnected state should safely no-op
  socketService.socket = null;
  socketService.startTyping('neg-1');
  socketService.stopTyping('neg-1');
  const noopUnsub = socketService.onParticipantTyping(() => {});
  assert.equal(typeof noopUnsub, 'function');
  noopUnsub();

  const emitted = [];
  const listeners = new Map();
  socketService.socket = {
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    on(event, cb) {
      listeners.set(event, cb);
    },
    off(event, cb) {
      if (listeners.get(event) === cb) listeners.delete(event);
    }
  };

  try {
    const received = [];
    const controller = createTypingController({
      socketService,
      currentUserId: 'user-self',
      onTypingStatusChange: (status) => received.push(status),
      debounceMs: 25
    });

    const unsub = controller.subscribe();
    assert.equal(typeof unsub, 'function');
    assert.ok(listeners.has('participant_typing'));

    controller.handleTextChange('neg-99', 'Offer 2400');
    assert.deepEqual(emitted, [{ event: 'typing_start', payload: { negotiationId: 'neg-99' } }]);

    // Trigger remote typing event for other participant and self
    listeners.get('participant_typing')({
      negotiationId: 'neg-99',
      userId: 'user-self',
      userRole: 'FARMER',
      isTyping: true
    });
    listeners.get('participant_typing')({
      negotiationId: 'neg-99',
      userId: 'buyer-1',
      userRole: 'BUYER_RETAIL',
      isTyping: true
    });

    assert.deepEqual(received, [
      { negotiationId: 'neg-99', userId: 'buyer-1', userRole: 'BUYER_RETAIL', isTyping: true }
    ]);

    controller.handleMessageSent('neg-99');
    assert.deepEqual(emitted, [
      { event: 'typing_start', payload: { negotiationId: 'neg-99' } },
      { event: 'typing_stop', payload: { negotiationId: 'neg-99' } }
    ]);

    controller.cleanup();
    assert.ok(!listeners.has('participant_typing'));
  } finally {
    socketService.socket = null;
  }
});
