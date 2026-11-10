const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectApiOrigin } = require('../src/config/apiOrigin');

test('explicit API origin takes precedence over Metro and preserves port', () => {
  assert.equal(selectApiOrigin(' http://localhost:7070/ ', 'ios', 'http://192.168.0.7:8081/index'), 'http://localhost:7070');
  assert.equal(selectApiOrigin('https://api.example.com/', 'android', 'http://192.168.0.7:8081/index'), 'https://api.example.com');
});
test('detects local Metro hosts but does not pretend tunnels expose backend', () => {
  assert.equal(selectApiOrigin('', 'ios', 'http://192.168.0.7:8081/index'), 'http://192.168.0.7:5001');
  assert.equal(selectApiOrigin('', 'android', 'http://10.0.2.2:8081/index'), 'http://10.0.2.2:5001');
  assert.equal(selectApiOrigin('', 'android', 'https://some-tunnel.example/index'), 'http://10.0.2.2:5001');
  assert.equal(selectApiOrigin('', 'ios', null), 'http://localhost:5001');
});
