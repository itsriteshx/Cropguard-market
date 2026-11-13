const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processAssistantQuery,
  extractCropName,
  extractDistrict,
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

test('processAssistantQuery supports all 8 regional languages and regional crop aliases', async () => {
  assert.equal(extractCropName('kanda bhav'), 'Onion');
  assert.equal(extractCropName('eerulli rate'), 'Onion');
  assert.equal(extractCropName('batata price'), 'Potato');

  for (const code of ['en', 'hi', 'kn', 'mr', 'te', 'ta', 'gu', 'pa']) {
    let body;
    await processAssistantQuery(
      { body: { query: 'hello help', lang: code } },
      { status() { return this; }, json(v) { body = v; return this; } },
      (err) => { throw err; }
    );
    assert.equal(body.success, true);
    assert.equal(body.lang, code);
    assert.ok(body.reply && body.reply.length > 10);
  }
});

test('assistant weather extraction resolves Indian cities and formats humidity cleanly without undefined%', async () => {
  assert.equal(extractDistrict('पुणे का मौसम बताओ'), 'Pune');
  assert.equal(extractDistrict('Check weather in Solapur'), 'Solapur');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('geocoding')) {
      return {
        ok: true,
        json: async () => ({
          results: [{ latitude: 18.52, longitude: 73.85, name: 'Pune', state: 'Maharashtra', admin1: 'Maharashtra' }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        current: { temperature_2m: 29.1, relative_humidity_2m: 44, precipitation: 0, wind_speed_10m: 9.5, weather_code: 2 },
        daily: { time: ['2026-11-11'], temperature_2m_max: [31], temperature_2m_min: [17], precipitation_probability_max: [0], weather_code: [1] }
      })
    };
  };

  try {
    let body;
    await processAssistantQuery(
      { body: { query: 'Check weather in Pune', lang: 'en' } },
      { status() { return this; }, json(v) { body = v; return this; } },
      (err) => { throw err; }
    );
    assert.equal(body.intent, 'WEATHER');
    assert.equal(body.weather.district, 'Pune');
    assert.equal(body.weather.humidityPercent, 44);
    assert.equal(body.weather.todayMaxC, 31);
    assert.equal(body.weather.todayMinC, 17);
    assert.ok(!body.reply.includes('undefined'), `unexpected undefined in: ${body.reply}`);
    assert.match(body.reply, /44%/);
    assert.match(body.reply, /High 31°C \/ Low 17°C/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
