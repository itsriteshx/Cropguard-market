const test = require('node:test');
const assert = require('node:assert/strict');
const Negotiation = require('../src/models/Negotiation');
const Listing = require('../src/models/ProduceListing');
const handlers = require('../src/controllers/negotiationController');

const person = (id) => ({ _id: id, name: id, toString: () => id });
const call = async (handler, user, body = {}) => {
  let status = 200, result;
  await handler({ user: { _id: user, role: user === 'buyer' ? 'BUYER_RETAIL' : 'FARMER' }, body, params: { id: 'n1' }, app: { get: () => null } },
    { status(code) { status = code; return this; }, json(value) { result = value; return this; } }, (error) => { throw error; });
  return { status, result };
};

test('only the participant whose turn it is can counter or accept; closed deals cannot be rejected', async () => {
  const originalFind = Negotiation.findById, originalUpdate = Negotiation.findOneAndUpdate;
  let state = { _id: 'n1', __v: 0, status: 'OPEN', currentTurn: 'FARMER', currentOfferedPrice: 20, quantity: 10, buyer: person('buyer'), farmer: person('farmer'), listing: { cropName: 'Wheat', unit: 'KG' }, bidHistory: [] };
  let writes = 0;
  try {
    Negotiation.findById = () => {
      const doc = { ...state, bidHistory: [...state.bidHistory] };
      doc.populate = () => doc;
      return doc;
    };
    Negotiation.findOneAndUpdate = async (filter, update) => {
      if (filter.__v !== state.__v || !filter.status.$in.includes(state.status) || (filter.currentTurn && filter.currentTurn !== state.currentTurn)) return null;
      state = { ...state, ...update.$set, __v: state.__v + 1, bidHistory: update.$push ? [...state.bidHistory, update.$push.bidHistory] : state.bidHistory };
      writes++;
      return { ...state };
    };
    assert.equal((await call(handlers.counterOffer, 'outsider', { counterPrice: 25 })).status, 403);
    assert.equal((await call(handlers.counterOffer, 'buyer', { counterPrice: 25 })).status, 409);
    assert.equal((await call(handlers.counterOffer, 'farmer', { counterPrice: -1 })).status, 400);
    const simultaneous = await Promise.all([call(handlers.counterOffer, 'farmer', { counterPrice: 25 }), call(handlers.counterOffer, 'farmer', { counterPrice: 25 })]);
    assert.deepEqual(simultaneous.map((result) => result.status).sort(), [200, 409]);
    assert.equal(state.currentTurn, 'BUYER');
    assert.equal(state.bidHistory.length, 1);
    assert.equal((await call(handlers.acceptDeal, 'farmer', { expectedPrice: 25 })).status, 409);
    assert.equal((await call(handlers.acceptDeal, 'buyer', { expectedPrice: 20 })).status, 409);
    assert.equal((await call(handlers.acceptDeal, 'buyer', { expectedPrice: 25 })).status, 200);
    assert.equal(state.agreedTotalAmount, 250);
    assert.equal((await call(handlers.rejectDeal, 'buyer', {})).status, 409);
    assert.equal(writes, 2);
  } finally { Negotiation.findById = originalFind; Negotiation.findOneAndUpdate = originalUpdate; }
});

test('negotiation expiry enforcement: counter-offer, accept, non-participant check, and atomic write blocking', async () => {
  const originalFind = Negotiation.findById, originalUpdate = Negotiation.findOneAndUpdate;
  const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours in future

  let state = {
    _id: 'n1',
    __v: 0,
    status: 'OPEN',
    currentTurn: 'FARMER',
    currentOfferedPrice: 20,
    quantity: 10,
    buyer: person('buyer'),
    farmer: person('farmer'),
    listing: { cropName: 'Wheat', unit: 'KG' },
    bidHistory: [],
    expiresAt: pastDate
  };

  try {
    Negotiation.findById = () => {
      const doc = { ...state, bidHistory: [...state.bidHistory] };
      doc.populate = () => doc;
      return doc;
    };
    Negotiation.findOneAndUpdate = async (filter, update) => {
      if (filter.__v !== state.__v || !filter.status.$in.includes(state.status) || (filter.currentTurn && filter.currentTurn !== state.currentTurn)) return null;
      if (filter.$or && state.expiresAt) {
        const notExpired = filter.$or.some((cond) => {
          if (cond.expiresAt?.$gt) return state.expiresAt > cond.expiresAt.$gt;
          if (cond.expiresAt === null) return state.expiresAt === null;
          if (cond.expiresAt?.$exists === false) return !('expiresAt' in state);
          return false;
        });
        if (!notExpired) return null;
      }
      state = {
        ...state,
        ...update.$set,
        __v: state.__v + 1,
        bidHistory: update.$push ? [...state.bidHistory, update.$push.bidHistory] : state.bidHistory
      };
      return { ...state };
    };

    // 1. Non-participant cannot trigger expiration on expired negotiation (returns 403, does not set EXPIRED)
    const outsiderCounter = await call(handlers.counterOffer, 'outsider', { counterPrice: 25 });
    assert.equal(outsiderCounter.status, 403);
    assert.equal(state.status, 'OPEN');

    const outsiderAccept = await call(handlers.acceptDeal, 'outsider', { expectedPrice: 20 });
    assert.equal(outsiderAccept.status, 403);
    assert.equal(state.status, 'OPEN');

    // 2. Expired counter-offer by participant returns 409 and persists EXPIRED
    const expiredCounter = await call(handlers.counterOffer, 'farmer', { counterPrice: 25 });
    assert.equal(expiredCounter.status, 409);
    assert.match(expiredCounter.result.message, /expired/i);
    assert.equal(state.status, 'EXPIRED');

    // Reset state to active and expired for accept test
    state.status = 'OPEN';
    state.currentTurn = 'BUYER';
    state.currentOfferedPrice = 25;
    state.__v = 0;
    state.expiresAt = pastDate;

    // 3. Expired acceptance returns 409 and persists EXPIRED
    const expiredAccept = await call(handlers.acceptDeal, 'buyer', { expectedPrice: 25 });
    assert.equal(expiredAccept.status, 409);
    assert.match(expiredAccept.result.message, /expired/i);
    assert.equal(state.status, 'EXPIRED');

    // 4. Non-expired negotiation still supports counter and accept flow
    state.status = 'OPEN';
    state.currentTurn = 'FARMER';
    state.currentOfferedPrice = 20;
    state.__v = 0;
    state.expiresAt = futureDate;

    const validCounter = await call(handlers.counterOffer, 'farmer', { counterPrice: 22 });
    assert.equal(validCounter.status, 200);
    assert.equal(state.status, 'COUNTER_OFFERED');
    assert.equal(state.currentOfferedPrice, 22);
    assert.equal(state.currentTurn, 'BUYER');

    const validAccept = await call(handlers.acceptDeal, 'buyer', { expectedPrice: 22 });
    assert.equal(validAccept.status, 200);
    assert.equal(state.status, 'ACCEPTED');
    assert.equal(state.agreedPrice, 22);

    // 5. Atomic filter prevents writes when negotiation expires between read and update
    state.status = 'OPEN';
    state.currentTurn = 'FARMER';
    state.currentOfferedPrice = 20;
    state.__v = 0;
    state.expiresAt = futureDate;

    let findCount = 0;
    Negotiation.findById = () => {
      findCount++;
      const exp = findCount === 1 ? futureDate : pastDate;
      const doc = { ...state, expiresAt: exp, bidHistory: [...state.bidHistory] };
      doc.populate = () => doc;
      state.expiresAt = pastDate;
      return doc;
    };

    const midRaceCounter = await call(handlers.counterOffer, 'farmer', { counterPrice: 24 });
    assert.equal(midRaceCounter.status, 409);
    assert.match(midRaceCounter.result.message, /expired/i);
    assert.equal(state.status, 'EXPIRED');

  } finally {
    Negotiation.findById = originalFind;
    Negotiation.findOneAndUpdate = originalUpdate;
  }
});

test('initial offers reject non-buyers and invalid amounts before querying a listing', async () => {
  const original = Listing.findById;
  try {
    Listing.findById = () => { throw new Error('Should not query listing'); };
    assert.equal((await call(handlers.startNegotiation, 'farmer', { listingId: 'x', offeredPrice: 2, quantity: 1 })).status, 403);
    assert.equal((await call(handlers.startNegotiation, 'buyer', { listingId: 'x', offeredPrice: -1, quantity: 1 })).status, 400);
  } finally { Listing.findById = original; }
});

test('sendNegotiationMessage allows participants to chat without changing price turn', async () => {
  const originalFind = Negotiation.findById;
  const originalUpdate = Negotiation.findOneAndUpdate;
  let savedMessages = [];

  try {
    Negotiation.findById = async () => ({
      _id: 'n1',
      status: 'COUNTER_OFFERED',
      currentTurn: 'BUYER',
      buyer: person('buyer'),
      farmer: person('farmer')
    });
    Negotiation.findOneAndUpdate = async (_filter, update) => {
      savedMessages.push(update.$push.messages);
      return {
        _id: 'n1',
        buyer: 'buyer',
        farmer: 'farmer',
        messages: savedMessages
      };
    };

    // Farmer can still send a chat message even though currentTurn is BUYER
    const res = await call(handlers.sendNegotiationMessage, 'farmer', {
      text: 'Pickup available tomorrow morning',
      isVoice: true
    });
    assert.equal(res.status, 200);
    assert.equal(res.result.success, true);
    assert.equal(res.result.chatMessage.isVoice, true);
    assert.equal(savedMessages.length, 1);

    // Outsider cannot send a message
    const blocked = await call(handlers.sendNegotiationMessage, 'outsider', { text: 'Hello' });
    assert.equal(blocked.status, 403);
  } finally {
    Negotiation.findById = originalFind;
    Negotiation.findOneAndUpdate = originalUpdate;
  }
});
