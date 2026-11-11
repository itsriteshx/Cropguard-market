const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processAssistantQuery,
  extractCropName,
  detectNavigationTarget
} = require('../src/controllers/assistantController');

test('assistant helpers extract Hinglish crop aliases and navigation intents', () => {
  assert.equal(extractCropName('Aaj pyaz ka rate kya hai'), 'Onion');
  assert.equal(extractCropName('tamatar price in mandi'), 'Tomato');
  assert.equal(extractCropName('apple rate today'), 'Apple');
  assert.deepEqual(detectNavigationTarget('open sell produce page'), {
    tab: 'sell',
    label: 'Sell Produce'
  });
});

test('processAssistantQuery computes midpoint negotiation guidance from real session values', async () => {
  let status = 200;
  let body;
  await processAssistantQuery(
    {
      user: { _id: 'u1', location: { district: 'Dharwad' } },
      body: {
        query: 'Suggest fair counter offer',
        lang: 'en',
        context: { cropName: '', askingPrice: 4500, currentOffer: 5000 }
      }
    },
    {
      status(code) {
        status = code;
        return this;
      },
      json(v) {
        body = v;
        return this;
      }
    },
    (err) => {
      throw err;
    }
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.intent, 'NEGOTIATION_ADVICE');
  assert.equal(body.suggestedPrice, 4750);
  assert.match(body.reply, /4750/);
});

test('processAssistantQuery navigates cleanly for voice screen commands', async () => {
  let body;
  await processAssistantQuery(
    { body: { query: 'Open Sell Produce', lang: 'hi' } },
    {
      status() {
        return this;
      },
      json(v) {
        body = v;
        return this;
      }
    },
    (err) => {
      throw err;
    }
  );

  assert.equal(body.success, true);
  assert.equal(body.intent, 'NAVIGATE');
  assert.equal(body.action.navigateTo, 'sell');
});

