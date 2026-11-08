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
