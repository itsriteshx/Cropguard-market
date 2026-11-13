// Tests for order state machine enhancements (Milestone 5)
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Listing = require('../src/models/ProduceListing');
const { updateOrderStatus } = require('../src/controllers/orderController');

// Helper to mock a simple order document
function mockOrder(overrides = {}) {
  const base = {
    _id: 'order1',
    __v: 0,
    listing: 'listing1',
    quantity: 5,
    stockReserved: true,
    buyer: { _id: 'buyer1' },
    farmer: { _id: 'farmer1' },
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
      { params: { id: 'order1' }, user: { _id: 'farmer1', role: 'FARMER' }, body: { nextStatus: 'DISPATCHED' } },
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
      // Simulate atomic update success
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
      { params: { id: 'order1' }, user: { _id: 'farmer1', role: 'FARMER' }, body: { nextStatus: 'DISPATCHED' } },
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
  const order = mockOrder({ orderStatus: 'PLACED', __v: 0 });
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  try {
    Order.findById = () => order;
    // First call succeeds, second sees stale __v
    let callCount = 0;
    Order.findOneAndUpdate = async (filter, update) => {
      if (callCount === 0) {
        // succeed and increment version
        order.orderStatus = update.$set.orderStatus;
        order.__v++;
        callCount++;
        return order;
      }
      // second call uses old __v, should return null
      return null;
    };
    // First transition: PLACED -> ESCROW_HELD (buyer)
    let status1, result1;
    await updateOrderStatus(
      { params: { id: 'order1' }, user: { _id: 'buyer1', role: 'BUYER_RETAIL' }, body: { nextStatus: 'ESCROW_HELD' } },
      { status(s) { status1 = s; return this; }, json(v) { result1 = v; return this; } },
      e => { throw e; }
    );
    assert.equal(status1, 200);
    // Second transition attempts using stale version (still PLACED in filter)
    let status2, result2;
    await updateOrderStatus(
      { params: { id: 'order1' }, user: { _id: 'buyer1', role: 'BUYER_RETAIL' }, body: { nextStatus: 'ESCROW_HELD' } },
      { status(s) { status2 = s; return this; }, json(v) { result2 = v; return this; } },
      e => { throw e; }
    );
    assert.equal(status2, 409);
    assert.match(result2.message, /changed/i);
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
      { params: { id: 'order1' }, user: { _id: 'buyer1', role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } },
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
      { params: { id: 'order2' }, user: { _id: 'buyer1', role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } },
      { status(s) { statusB = s; return this; }, json(v) { resB = v; return this; } },
      e => { throw e; }
    );
    assert.equal(statusB, 200);
    assert.equal(resB.order.paymentStatus, 'REFUNDED');

    // Scenario 3: Farmer attempts to cancel after DISPATCHED (should be forbidden)
    let order3 = mockOrder({ orderStatus: 'DISPATCHED', paymentStatus: 'ESCROW_SECURED' });
    Order.findById = () => order3;
    let statusC, resC;
    await updateOrderStatus(
      { params: { id: 'order3' }, user: { _id: 'farmer1', role: 'FARMER' }, body: { nextStatus: 'CANCELLED' } },
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

