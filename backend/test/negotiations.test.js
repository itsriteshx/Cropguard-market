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

test('Negotiation schema declares partial unique index for active negotiations', () => {
  const indexes = Negotiation.schema.indexes();
  const activeIndex = indexes.find(([fields]) => fields.listing === 1 && fields.buyer === 1);
  assert.ok(activeIndex, 'Index on { listing: 1, buyer: 1 } must exist');
  const [fields, options] = activeIndex;
  assert.equal(options.unique, true, 'Index must be unique');
  assert.equal(options.name, 'active_negotiation_listing_buyer_unique');
  assert.deepEqual(options.partialFilterExpression, {
    status: { $in: ['OPEN', 'COUNTER_OFFERED'] }
  });
});

test('startNegotiation duplicate prevention, expiration handling, and error handling', async () => {
  const origListingFind = Listing.findById;
  const origNegFindOne = Negotiation.findOne;
  const origNegUpdateMany = Negotiation.updateMany;
  const origNegCreate = Negotiation.create;

  const validListing = {
    _id: 'l1',
    farmer: person('farmer'),
    quantity: 100,
    unit: 'KG',
    pricePerUnit: 50,
    status: 'AVAILABLE'
  };

  try {
    Listing.findById = async (id) => (id === 'l1' ? { ...validListing } : null);

    // 1. Existing active negotiation returns 409
    Negotiation.updateMany = async () => ({ modifiedCount: 0 });
    Negotiation.findOne = async () => ({ _id: 'n_existing', status: 'OPEN' });
    const existingActive = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 45, quantity: 10
    });
    assert.equal(existingActive.status, 409);
    assert.equal(existingActive.result.negotiationId, 'n_existing');

    // 2. Expired active negotiation is marked EXPIRED, allowing new negotiation (201)
    let updatedFilter = null;
    let createdDoc = null;
    let existingListings = [
      { _id: 'n_old', listing: 'l1', buyer: 'buyer', status: 'OPEN', expiresAt: new Date(Date.now() - 3600000) }
    ];

    Negotiation.updateMany = async (filter) => {
      updatedFilter = filter;
      existingListings = existingListings.map((n) => {
        if (filter.expiresAt?.$lte && n.expiresAt && n.expiresAt <= filter.expiresAt.$lte) {
          return { ...n, status: 'EXPIRED' };
        }
        return n;
      });
      return { modifiedCount: 1 };
    };

    Negotiation.findOne = async () => {
      return existingListings.find((n) => n.status === 'OPEN' || n.status === 'COUNTER_OFFERED') || null;
    };

    Negotiation.create = async (doc) => {
      createdDoc = { ...doc, _id: 'n_new' };
      return createdDoc;
    };

    const allowAfterExpiry = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 45, quantity: 10
    });
    assert.equal(allowAfterExpiry.status, 201);
    assert.ok(createdDoc);
    assert.ok(updatedFilter.expiresAt.$exists);
    assert.equal(updatedFilter.expiresAt.$ne, null);

    // 3. Null or missing expiresAt is not incorrectly expired
    let unexpiredDocs = [
      { _id: 'n_null_exp', listing: 'l1', buyer: 'buyer', status: 'OPEN', expiresAt: null },
      { _id: 'n_missing_exp', listing: 'l1', buyer: 'buyer', status: 'OPEN' }
    ];

    Negotiation.updateMany = async (filter) => {
      unexpiredDocs = unexpiredDocs.map((n) => {
        if (n.expiresAt !== null && n.expiresAt !== undefined && filter.expiresAt?.$lte && n.expiresAt <= filter.expiresAt.$lte) {
          return { ...n, status: 'EXPIRED' };
        }
        return n;
      });
      return { modifiedCount: 0 };
    };

    Negotiation.findOne = async () => unexpiredDocs[0];
    const nullExpCall = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 45, quantity: 10
    });
    assert.equal(nullExpCall.status, 409);

    // 4. Duplicate-key error (E11000) during creation returns 409
    Negotiation.findOne = async () => null;
    Negotiation.create = async () => {
      const err = new Error('E11000 duplicate key error collection: negotiations index: active_negotiation_listing_buyer_unique dup key: { listing: "l1", buyer: "buyer" }');
      err.code = 11000;
      throw err;
    };

    const dupKeyCall = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 45, quantity: 10
    });
    assert.equal(dupKeyCall.status, 409);
    assert.match(dupKeyCall.result.message, /already exists/i);

    // 5. Unrelated database errors still reach the error handler (next(error))
    Negotiation.create = async () => {
      throw new Error('MongoNetworkError: connection lost');
    };

    await assert.rejects(
      async () => {
        await call(handlers.startNegotiation, 'buyer', {
          listingId: 'l1', offeredPrice: 45, quantity: 10
        });
      },
      /MongoNetworkError/
    );

    // 6. Successful negotiation creation returns 201
    Negotiation.create = async (doc) => ({ ...doc, _id: 'n_success' });
    const successCall = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 48, quantity: 20, note: 'Special offer'
    });
    assert.equal(successCall.status, 201);
    assert.equal(successCall.result.negotiation.currentOfferedPrice, 48);

    // 7. UNDER_NEGOTIATION listings remain eligible
    Listing.findById = async () => ({ ...validListing, status: 'UNDER_NEGOTIATION' });
    const underNegCall = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 48, quantity: 20
    });
    assert.equal(underNegCall.status, 201);

    // 8. Existing validation and authorization checks
    // Farmer cannot bid on own produce
    Listing.findById = async (id) => (id === 'l1' ? { ...validListing, farmer: person('farmer') } : null);
    const ownProduce = await call(handlers.startNegotiation, 'farmer', {
      listingId: 'l1', offeredPrice: 48, quantity: 10
    });
    assert.equal(ownProduce.status, 403);

    // Missing listing -> 404
    Listing.findById = async () => null;
    const notFoundListing = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l_missing', offeredPrice: 48, quantity: 10
    });
    assert.equal(notFoundListing.status, 404);

    // SOLD listing -> 400
    Listing.findById = async () => ({ ...validListing, status: 'SOLD' });
    const soldListing = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 48, quantity: 10
    });
    assert.equal(soldListing.status, 400);

    // Quantity exceeds listing -> 400
    Listing.findById = async () => ({ ...validListing, quantity: 5 });
    const excessQty = await call(handlers.startNegotiation, 'buyer', {
      listingId: 'l1', offeredPrice: 48, quantity: 10
    });
    assert.equal(excessQty.status, 400);

  } finally {
    Listing.findById = origListingFind;
    Negotiation.findOne = origNegFindOne;
    Negotiation.updateMany = origNegUpdateMany;
    Negotiation.create = origNegCreate;
  }
});

test('deleteNegotiationMessage restricts deletion to message sender and deleteClosedNegotiation rejects active/ordered deals', async () => {
  const originalFind = Negotiation.findById;
  const originalUpdate = Negotiation.findOneAndUpdate;
  const originalDelete = Negotiation.deleteOne;

  let docState = {
    _id: 'n1',
    status: 'COUNTER_OFFERED',
    order: null,
    buyer: person('buyer'),
    farmer: person('farmer'),
    messages: [{ _id: 'm1', sender: 'farmer', text: 'Grade A' }]
  };

  try {
    Negotiation.findById = async () => docState;
    Negotiation.findOneAndUpdate = async () => ({
      ...docState,
      messages: []
    });
    Negotiation.deleteOne = async () => ({ deletedCount: 1 });

    // Buyer cannot delete Farmer's chat message
    let status = 200;
    let resBody;
    await handlers.deleteNegotiationMessage(
      { user: { _id: 'buyer', role: 'BUYER_RETAIL' }, params: { id: 'n1', messageId: 'm1' }, app: { get: () => null } },
      { status(c) { status = c; return this; }, json(v) { resBody = v; return this; } },
      (err) => { throw err; }
    );
    assert.equal(status, 403);

    // Farmer deletes own chat message
    status = 200;
    await handlers.deleteNegotiationMessage(
      { user: { _id: 'farmer', role: 'FARMER' }, params: { id: 'n1', messageId: 'm1' }, app: { get: () => null } },
      { status(c) { status = c; return this; }, json(v) { resBody = v; return this; } },
      (err) => { throw err; }
    );
    assert.equal(status, 200);
    assert.deepEqual(resBody.messages, []);

    // Cannot delete active negotiation room
    assert.equal((await call(handlers.deleteClosedNegotiation, 'farmer')).status, 409);

    // Can delete rejected room with no order
    docState.status = 'REJECTED';
    assert.equal((await call(handlers.deleteClosedNegotiation, 'farmer')).status, 200);
  } finally {
    Negotiation.findById = originalFind;
    Negotiation.findOneAndUpdate = originalUpdate;
    Negotiation.deleteOne = originalDelete;
  }
});
