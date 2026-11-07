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

test('initial offers reject non-buyers and invalid amounts before querying a listing', async () => {
  const original = Listing.findById;
  try {
    Listing.findById = () => { throw new Error('Should not query listing'); };
    assert.equal((await call(handlers.startNegotiation, 'farmer', { listingId: 'x', offeredPrice: 2, quantity: 1 })).status, 403);
    assert.equal((await call(handlers.startNegotiation, 'buyer', { listingId: 'x', offeredPrice: -1, quantity: 1 })).status, 400);
  } finally { Listing.findById = original; }
});
