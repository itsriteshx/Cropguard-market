// Tests for order state machine enhancements (Milestone 5)
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Listing = require('../src/models/ProduceListing');

// Mock mongoose.startSession before requiring controller to avoid real transaction attempts
mongoose.startSession = async () => ({
  withTransaction: async fn => fn(),
  endSession: async () => {}
});

const { updateOrderStatus } = require('../src/controllers/orderController');

// Helper to mock a simple order document with ObjectId strings
function mockOrder(overrides = {}) {
  const base = {
    _id: 'order1',
    __v: 0,
    listing: 'listing1',
    quantity: 5,
    stockReserved: true,
    buyer: { _id: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa') },
    farmer: { _id: new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb') },
    orderStatus: 'PLACED',
    paymentStatus: 'PENDING',
    paymentDetails: {},
    timeline: [],
    populate() { return this; },
    async save() {}
  };
  return Object.assign(base, overrides);
}

// Mock session transaction that simply runs the provided function
function mockSession() {
  return {
    withTransaction: async fn => fn(),
    endSession: async () => {}
  };
}

// ----- Test: Dispatch requires escrow secured -----
test('dispatching without escrow should fail with 409', async () => {
  const order = mockOrder({ orderStatus: 'ESCROW_HELD', paymentStatus: 'PENDING' });
  const originalFindById = Order.findById;
  try {
    Order.findById = () => order;
    let status, result;
    await updateOrderStatus(
      { params: { id: 'order1' }, user: { _id: order.farmer._id, role: 'FARMER' }, body: { nextStatus: 'DISPATCHED' } },
      { status(s) { status = s; return this; }, json(v) { result = v; return this; } },
      e => { throw e; }
    );
    assert.equal(status, 409);
    assert.match(result.message, /escrow/i);
  } finally {
    Order.findById = originalFindById;
  }
});

// ----- Test: Successful dispatch after escrow secured -----
test('dispatch succeeds when escrow secured', async () => {
  const order = mockOrder({ orderStatus: 'ESCROW_HELD', paymentStatus: 'ESCROW_SECURED' });
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  try {
    Order.findById = () => order;
    Order.findOneAndUpdate = async (filter, update) => {
      // Simulate atomic update success based on version and status match
      if (filter._id === order._id && filter.orderStatus === order.orderStatus && filter.__v === order.__v) {
        order.orderStatus = update.$set.orderStatus;
        order.__v++;
        order.timeline.push(update.$push.timeline);
        return order;
      }
      return null;
    };
    let status, result;
    await updateOrderStatus(
      { params: { id: 'order1' }, user: { _id: order.farmer._id, role: 'FARMER' }, body: { nextStatus: 'DISPATCHED' } },
      { status(s) { status = s; return this; }, json(v) { result = v; return this; } },
      e => { throw e; }
    );
    assert.equal(status, 200);
    assert.equal(result.order.orderStatus, 'DISPATCHED');
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// ----- Test: Optimistic concurrency conflict -----
test('concurrent update detects version conflict and returns 409', async () => {
  let persisted = mockOrder({ orderStatus: 'PLACED', __v: 0 });
  const snapshot = {
    ...persisted,
    buyer: { ...persisted.buyer },
    farmer: { ...persisted.farmer },
    timeline: [...persisted.timeline]
  };
  const orderId = snapshot._id;
  const buyerId = snapshot.buyer._id;
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;

  let reads = 0;
  let writeCount = 0;
  let releaseWrites;
  const bothReadPromise = new Promise(resolve => { releaseWrites = resolve; });

  try {
    // Both requests read the original PLACED, __v: 0 snapshot
    Order.findById = () => ({
      populate() { return this; },
      then(resolve) {
        reads++;
        if (reads === 2) {
          releaseWrites();
        }
        resolve({ ...snapshot });
      }
    });

    // Conditional update checking _id, orderStatus, and __v
    Order.findOneAndUpdate = async (filter, update) => {
      // Ensure both requests have completed their read before any write is processed
      await bothReadPromise;
      if (String(filter._id) !== String(persisted._id)) return null;
      if (filter.orderStatus !== persisted.orderStatus) return null;
      if (filter.__v !== persisted.__v) return null;
      writeCount++;
      persisted = {
        ...persisted,
        ...update.$set,
        __v: persisted.__v + (update.$inc?.__v || 1)
      };
      if (update.$push?.timeline) {
        persisted.timeline = [...persisted.timeline, update.$push.timeline];
      }
      return persisted;
    };

    const callTransition = async () => {
      let status, result;
      await updateOrderStatus(
        { params: { id: orderId }, user: { _id: buyerId, role: 'BUYER_RETAIL' }, body: { nextStatus: 'ESCROW_HELD' } },
        { status(s) { status = s; return this; }, json(v) { result = v; return this; } },
        e => { throw e; }
      );
      return { status, result };
    };

    // Start both requests concurrently using Promise.all
    const [res1, res2] = await Promise.all([callTransition(), callTransition()]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const conflictRes = res1.status === 409 ? res1.result : res2.result;
    assert.match(conflictRes.message, /changed/i);

    // Assert exactly one successful persisted update
    assert.equal(writeCount, 1);
    assert.equal(persisted.__v, 1);
    assert.equal(persisted.orderStatus, 'ESCROW_HELD');
    assert.equal(persisted.timeline.length, 1);
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// ----- Test: Cancellation permission matrix -----
test('cancellation respects role and payment status', async () => {
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const originalListingUpdate = Listing.findOneAndUpdate;
  try {
    // Scenario 1: Buyer cancels from PLACED (no escrow)
    let order1 = mockOrder({ orderStatus: 'PLACED', paymentStatus: 'PENDING' });
    Order.findById = () => order1;
    Order.findOneAndUpdate = async (filter, update) => {
      if (filter._id !== order1._id) return null;
      if (filter.orderStatus !== order1.orderStatus || filter.__v !== order1.__v) return null;
      order1 = { ...order1, ...update.$set, __v: order1.__v + 1 };
      return order1;
    };
    Listing.findOneAndUpdate = async () => ({ quantity: 15 }); // stock restore mock
    let statusA, resA;
    await updateOrderStatus(
      { params: { id: 'order1' }, user: { _id: order1.buyer._id, role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } },
      { status(s) { statusA = s; return this; }, json(v) { resA = v; return this; } },
      e => { throw e; }
    );
    assert.equal(statusA, 200);
    assert.equal(resA.order.orderStatus, 'CANCELLED');
    assert.equal(resA.order.paymentStatus, 'PENDING');

    // Scenario 2: Buyer cancels from ESCROW_HELD (should set REFUNDED)
    let order2 = mockOrder({ orderStatus: 'ESCROW_HELD', paymentStatus: 'ESCROW_SECURED' });
    Order.findById = () => order2;
    Order.findOneAndUpdate = async (filter, update) => {
      if (filter._id !== order2._id) return null;
      if (filter.orderStatus !== order2.orderStatus || filter.__v !== order2.__v) return null;
      order2 = { ...order2, ...update.$set, __v: order2.__v + 1 };
      return order2;
    };
    let statusB, resB;
    await updateOrderStatus(
      { params: { id: 'order2' }, user: { _id: order2.buyer._id, role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } },
      { status(s) { statusB = s; return this; }, json(v) { resB = v; return this; } },
      e => { throw e; }
    );
    assert.equal(statusB, 200);
    assert.equal(resB.order.paymentStatus, 'REFUNDED');

    // Scenario 3: Farmer attempts to cancel after DISPATCHED (invalid transition)
    let order3 = mockOrder({ orderStatus: 'DISPATCHED', paymentStatus: 'ESCROW_SECURED' });
    Order.findById = () => order3;
    let statusC, resC;
    await updateOrderStatus(
      { params: { id: 'order3' }, user: { _id: order3.farmer._id, role: 'FARMER' }, body: { nextStatus: 'CANCELLED' } },
      { status(s) { statusC = s; return this; }, json(v) { resC = v; return this; } },
      e => { throw e; }
    );
    assert.equal(statusC, 400);
    assert.match(resC.message, /invalid state transition/i);
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
    Listing.findOneAndUpdate = originalListingUpdate;
  }
});
