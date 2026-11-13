const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ConsoleSmsAdapter,
  TwoFactorSmsAdapter,
  Msg91SmsAdapter,
  TwilioSmsAdapter,
  getSmsAdapter
} = require('../src/services/sms/smsAdapter');

test('ConsoleSmsAdapter: normalizes phone number and records dispatched SMS in memory', async () => {
  const adapter = new ConsoleSmsAdapter();
  const result = await adapter.send({
    phone: '+91 98765 43210',
    message: 'Your CropGuard verification code is 123456',
    otp: '123456'
  });

  assert.equal(result.success, true);
  assert.ok(result.messageId.startsWith('console-sms-'));
  assert.equal(adapter.sentMessages.length, 1);
  assert.equal(adapter.sentMessages[0].phone, '9876543210');
  assert.equal(adapter.sentMessages[0].otp, '123456');
});

test('TwoFactorSmsAdapter: validates API key and phone number', async () => {
  const noKeyAdapter = new TwoFactorSmsAdapter('');
  await assert.rejects(
    async () => noKeyAdapter.send({ phone: '9876543210', otp: '123456' }),
    /2Factor API key is missing/
  );

  const keyAdapter = new TwoFactorSmsAdapter('dummy-key');
  await assert.rejects(
    async () => keyAdapter.send({ phone: 'invalid', otp: '123456' }),
    /Valid 10-digit Indian mobile number is required/
  );
});

test('Msg91SmsAdapter: validates auth key and template', async () => {
  const noKeyAdapter = new Msg91SmsAdapter('');
  await assert.rejects(
    async () => noKeyAdapter.send({ phone: '9876543210', otp: '123456' }),
    /MSG91 auth key is missing/
  );
});

test('TwilioSmsAdapter: validates credentials and requires valid E.164 phone', async () => {
  const incompleteAdapter = new TwilioSmsAdapter('AC123', '', '+1234567890');
  await assert.rejects(
    async () => incompleteAdapter.send({ phone: '9876543210', message: 'test' }),
    /Twilio credentials incomplete/
  );

  const readyAdapter = new TwilioSmsAdapter('AC123', 'auth_token', '+1234567890');
  await assert.rejects(
    async () => readyAdapter.send({ phone: 'invalid', message: 'test' }),
    /Invalid phone number/
  );
});

test('getSmsAdapter factory: returns appropriate adapter class by provider name', () => {
  assert.ok(getSmsAdapter('console') instanceof ConsoleSmsAdapter);
  assert.ok(getSmsAdapter('unknown') instanceof ConsoleSmsAdapter);
  assert.ok(getSmsAdapter('2factor') instanceof TwoFactorSmsAdapter);
  assert.ok(getSmsAdapter('msg91') instanceof Msg91SmsAdapter);
  assert.ok(getSmsAdapter('twilio') instanceof TwilioSmsAdapter);
});
