const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Negotiation = require('../src/models/Negotiation');
const Listing = require('../src/models/ProduceListing');
const { createOrder } = require('../src/controllers/orderController');
const query = (value) => ({ session: async () => value });

test('accepted-deal order checks buyer, reserves stock, and returns existing order on retry', async () => {
  const originals = { session: mongoose.startSession, neg: Negotiation.findById, claim: Negotiation.findOneAndUpdate, listing: Listing.findById, reserve: Listing.findOneAndUpdate, find: Order.findOne, create: Order.create };
  const neg = { _id: 'n1', buyer: 'buyer', farmer: 'farmer', listing: 'l1', status: 'ACCEPTED', order: null, quantity: 5, agreedPrice: 20 };
  const listing = { _id: 'l1', farmer: 'farmer', quantity: 10, cropName: 'Wheat', unit: 'KG', status: 'AVAILABLE' };
  let order;
  try {
    mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
    Negotiation.findById = () => query(neg);
    Negotiation.findOneAndUpdate = async (_filter, update) => { if (neg.order) return null; neg.order = update.$set.order; return neg; };
    Listing.findById = () => query(listing);
    Listing.findOneAndUpdate = async (filter) => { if (listing.quantity < filter.quantity.$gte) return null; listing.quantity -= filter.quantity.$gte; return listing; };
    Order.findOne = () => query(order);
    Order.create = async ([data]) => { order = data; return [data]; };
    const call = async (user) => { let status, result; await createOrder({ user: { _id: user, role: 'BUYER_RETAIL' }, body: { negotiationId: 'n1' } }, { status(s) { status = s; return this; }, json(r) { result = r; } }, (e) => { throw e; }); return { status, result }; };
    assert.equal((await call('stranger')).status, 403);
    const first = await call('buyer');
    assert.equal(first.status, 201); assert.equal(first.result.order.totalAmount, 100); assert.equal(listing.quantity, 5);
    const second = await call('buyer');
    assert.equal(second.status, 200); assert.equal(second.result.created, false); assert.equal(listing.quantity, 5);
  } finally {
    mongoose.startSession = originals.session; Negotiation.findById = originals.neg; Negotiation.findOneAndUpdate = originals.claim; Listing.findById = originals.listing; Listing.findOneAndUpdate = originals.reserve; Order.findOne = originals.find; Order.create = originals.create;
  }
});

test('direct orders reject non-buyer roles before starting a transaction', async () => {
  let status;
  await createOrder({ user: { _id: 'farmer', role: 'FARMER' }, body: { listingId: 'l1' } }, { status(value) { status = value; return this; }, json() {} }, (error) => { throw error; });
  assert.equal(status, 403);
});

test('order transitions enforce participant roles and state', async () => {
  const { updateOrderStatus } = require('../src/controllers/orderController');
  const original = Order.findById;
  const order = { buyer: { _id: 'buyer' }, farmer: { _id: 'farmer' }, orderStatus: 'PLACED', paymentStatus: 'PENDING', paymentDetails: {}, timeline: [], populate() { return this; }, async save() {} };
  const call = async (id, nextStatus) => {
    let status, result;
    await updateOrderStatus({ params: { id: 'o1' }, user: { _id: id, role: id === 'farmer' ? 'FARMER' : 'BUYER_RETAIL' }, body: { nextStatus } }, { status(s) { status = s; return this; }, json(v) { result = v; return this; } }, (e) => { throw e; });
    return { status, result };
  };
  try {
    Order.findById = () => order;
    assert.equal((await call('farmer', 'ESCROW_HELD')).status, 403);
    assert.equal((await call('buyer', 'DISPATCHED')).status, 400);
    assert.equal((await call('buyer', 'ESCROW_HELD')).status, 200);
    assert.equal(order.paymentStatus, 'ESCROW_SECURED');
    assert.equal((await call('buyer', 'DISPATCHED')).status, 403);
    assert.equal((await call('farmer', 'DISPATCHED')).status, 200);
    assert.equal((await call('buyer', 'DELIVERED')).status, 200);
    assert.equal((await call('farmer', 'SETTLED')).status, 403);
    assert.equal((await call('buyer', 'SETTLED')).status, 200);
  } finally { Order.findById = original; }
});

test('cancellation restores stock once and rolls back if the listing is missing', async () => {
  const { updateOrderStatus } = require('../src/controllers/orderController');
  const originalSession = mongoose.startSession, originalFind = Order.findById, originalUpdate = Order.findOneAndUpdate, originalListing = Listing.findOneAndUpdate;
  let order = { _id: 'o1', __v: 0, listing: 'l1', quantity: 4, stockReserved: true, buyer: { _id: 'buyer' }, farmer: { _id: 'farmer' }, orderStatus: 'PLACED', paymentStatus: 'PENDING', timeline: [] };
  let quantity = 6, missing = false;
  try {
    mongoose.startSession = async () => ({ withTransaction: async (fn) => { const before = { ...order }; const qty = quantity; try { await fn(); } catch (error) { order = before; quantity = qty; throw error; } }, endSession: async () => {} });
    Order.findById = () => ({ populate() { return this; }, then(resolve) { resolve({ ...order }); } });
    Order.findOneAndUpdate = async (filter, update) => {
      if (order.orderStatus !== filter.orderStatus || order.__v !== filter.__v) return null;
      order = { ...order, ...update.$set, __v: order.__v + 1 }; return order;
    };
    Listing.findOneAndUpdate = async () => { if (missing) return null; quantity += order.quantity; return { quantity }; };
    const call = async () => { let status; await updateOrderStatus({ params: { id: 'o1' }, user: { _id: 'buyer', role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } }, { status(s) { status = s; return this; }, json() {} }, (e) => { throw e; }); return status; };
    missing = true; assert.equal(await call(), 409); assert.equal(order.orderStatus, 'PLACED'); assert.equal(quantity, 6);
    missing = false; assert.equal(await call(), 200); assert.equal(order.orderStatus, 'CANCELLED'); assert.equal(quantity, 10);
    assert.equal(await call(), 400); assert.equal(quantity, 10);
  } finally { mongoose.startSession = originalSession; Order.findById = originalFind; Order.findOneAndUpdate = originalUpdate; Listing.findOneAndUpdate = originalListing; }
});

test('direct order ignores client-supplied price and uses listing price', async () => {
  const originals = {
    session: mongoose.startSession,
    listing: Listing.findById,
    reserve: Listing.findOneAndUpdate,
    create: Order.create
  };

  const listing = {
    _id: 'l1',
    farmer: 'farmer',
    quantity: 10,
    cropName: 'Wheat',
    unit: 'KG',
    pricePerUnit: 25,
    status: 'AVAILABLE'
  };

  let createdOrder;

  try {
    mongoose.startSession = async () => ({
      withTransaction: async (fn) => fn(),
      endSession: async () => {}
    });

    Listing.findById = () => query(listing);
    Listing.findOneAndUpdate = async () => listing;

    Order.create = async ([data]) => {
      createdOrder = data;
      return [data];
    };

    let status;

    await createOrder(
      {
        user: { _id: 'buyer', role: 'BUYER_RETAIL' },
        body: {
          listingId: 'l1',
          quantity: 2,
          agreedPrice: 1
        }
      },
      {
        status(value) {
          status = value;
          return this;
        },
        json() {}
      },
      (error) => { throw error; }
    );

    assert.equal(status, 201);
    assert.equal(createdOrder.unitPrice, 25);
    assert.equal(createdOrder.totalAmount, 50);
  } finally {
    mongoose.startSession = originals.session;
    Listing.findById = originals.listing;
    Listing.findOneAndUpdate = originals.reserve;
    Order.create = originals.create;
  }
});
