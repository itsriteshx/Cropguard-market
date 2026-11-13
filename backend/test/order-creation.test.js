const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Negotiation = require('../src/models/Negotiation');
const Listing = require('../src/models/ProduceListing');
const { createOrder } = require('../src/controllers/orderController');
const query = (value) => ({ session: async () => value });

// Helper to restore original functions
async function withMocks(mockSetup, testFn) {
  const originals = {
    startSession: mongoose.startSession,
    NegotiationFindById: Negotiation.findById,
    NegotiationFindOneAndUpdate: Negotiation.findOneAndUpdate,
    OrderFindOne: Order.findOne,
    OrderFindOneAndUpdate: Order.findOneAndUpdate,
    OrderCreate: Order.create,
    ListingFindById: Listing.findById,
    ListingFindOneAndUpdate: Listing.findOneAndUpdate,
  };
  try {
    mockSetup();
    return await testFn();
  } finally {
    mongoose.startSession = originals.startSession;
    Negotiation.findById = originals.NegotiationFindById;
    Negotiation.findOneAndUpdate = originals.NegotiationFindOneAndUpdate;
    Order.findOne = originals.OrderFindOne;
    Order.findOneAndUpdate = originals.OrderFindOneAndUpdate;
    Order.create = originals.OrderCreate;
    Listing.findById = originals.ListingFindById;
    Listing.findOneAndUpdate = originals.ListingFindOneAndUpdate;
  }
}

test('accepted-deal order checks buyer, reserves stock, and returns existing order on retry', async () => {
  const buyerId = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
  const farmerId = new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');

  const neg = { _id: 'n1', buyer: buyerId, farmer: farmerId, listing: 'l1', status: 'ACCEPTED', order: null, quantity: 5, agreedPrice: 20 };
  const listing = { _id: 'l1', farmer: farmerId, quantity: 10, cropName: 'Wheat', unit: 'KG', pricePerUnit: 20, status: 'AVAILABLE' };

  const call = async (user) => {
    const userId = typeof user === 'string' ? user : user;
    let status, result;
    await createOrder({ user: { _id: userId, role: 'BUYER_RETAIL' }, body: { negotiationId: 'n1' } }, {
      status(s) { status = s; return this; },
      json(r) { result = r; }
    }, (e) => { throw e; });
    return { status, result };
  };

  await withMocks(() => {
    // Mock session handling
    mongoose.startSession = async () => ({
      withTransaction: async (fn) => await fn(),
      endSession: async () => {}
    });
    // Mock Negotiation lookup
    Negotiation.findById = () => query(neg);
    // Mock Negotiation claim (set order field)
    Negotiation.findOneAndUpdate = async (_filter, update) => {
      if (neg.order) return null;
      neg.order = update.$set.order;
      return neg;
    };
    // Mock Listing lookup and stock reservation
    Listing.findById = () => query(listing);
    Listing.findOneAndUpdate = async (filter) => {
      const needed = neg.quantity;
      if (listing.quantity < needed) return null;
      listing.quantity -= needed;
      return listing;
    };
    // Mock Order existence check
    let created = null;
    Order.findOne = () => query(created);
    // Mock Order creation
    Order.create = async ([data]) => {
      created = data;
      return [data];
    };
  }, async () => {
    // stranger (non-buyer) should be forbidden
    assert.equal((await call('stranger')).status, 403);

    // buyer can create order
    const first = await call(buyerId);
    assert.equal(first.status, 201);
    assert.equal(first.result.order.totalAmount, 100);
    assert.equal(listing.quantity, 5);

    // subsequent retry by same buyer should return existing order
    const second = await call(buyerId);
    assert.equal(second.status, 200);
    assert.equal(second.result.created, false);
    assert.equal(listing.quantity, 5);
  });
});

test('direct orders reject non-buyer roles before starting a transaction', async () => {
  let status;
  await createOrder({ user: { _id: 'farmer', role: 'FARMER' }, body: { listingId: 'l1' } }, { status(value) { status = value; return this; }, json() {} }, (error) => { throw error; });
  assert.equal(status, 403);
});

test('order transitions enforce participant roles and state', async () => {
  const { updateOrderStatus } = require('../src/controllers/orderController');
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const buyerId = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
  const farmerId = new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');
  const orderId = new mongoose.Types.ObjectId('cccccccccccccccccccccccc');
  const order = {
    _id: orderId,
    __v: 0,
    buyer: { _id: buyerId },
    farmer: { _id: farmerId },
    orderStatus: 'PLACED',
    paymentStatus: 'PENDING',
    paymentDetails: {},
    timeline: [],
    populate() { return this; },
    async save() {}
  };
  // Mock findById to return a thenable resolving to order
  Order.findById = () => ({
    populate() { return this; },
    then(resolve) { resolve(order); }
  });
  // Mock findOneAndUpdate to simulate atomic update and set paymentStatus on ESCROW_HELD
  Order.findOneAndUpdate = async (filter, update) => {
    if (filter._id?.toString() !== order._id?.toString()) return null;
    if (filter.orderStatus !== order.orderStatus) return null;
    if (filter.__v !== order.__v) return null;
    if (update.$set) Object.assign(order, update.$set);
    if (update.$push?.timeline) order.timeline.push(update.$push.timeline);
    if (update.$inc?.__v) order.__v += update.$inc.__v;
    else order.__v++;
    return order;
  };
  const call = async (actor, nextStatus) => {
    let status, result;
    const isFarmer = actor === 'farmer' || actor === farmerId || actor?.toString() === farmerId.toString();
    const userId = isFarmer ? farmerId : buyerId;
    const role = isFarmer ? 'FARMER' : 'BUYER_RETAIL';
    await updateOrderStatus({ params: { id: order._id.toString() }, user: { _id: userId, role }, body: { nextStatus } }, {
      status(s) { status = s; return this; },
      json(v) { result = v; return this; }
    }, e => { throw e; });
    return { status, result };
  };
  try {
    assert.equal((await call('farmer', 'ESCROW_HELD')).status, 403);
    assert.equal((await call('buyer', 'DISPATCHED')).status, 400);
    assert.equal((await call('buyer', 'ESCROW_HELD')).status, 200);
    assert.equal(order.paymentStatus, 'ESCROW_SECURED');
    assert.equal((await call('buyer', 'DISPATCHED')).status, 403);
    assert.equal((await call('farmer', 'DISPATCHED')).status, 200);
    assert.equal((await call('buyer', 'DELIVERED')).status, 200);
    assert.equal((await call('farmer', 'SETTLED')).status, 403);
    assert.equal((await call('buyer', 'SETTLED')).status, 200);
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('cancellation restores stock once and rolls back if the listing is missing', async () => {
  const { updateOrderStatus } = require('../src/controllers/orderController');
  const originalSession = mongoose.startSession, originalFind = Order.findById, originalUpdate = Order.findOneAndUpdate, originalListing = Listing.findOneAndUpdate;
  let order = { _id: 'o1', __v: 0, listing: 'l1', quantity: 4, stockReserved: true, buyer: { _id: 'buyer' }, farmer: { _id: 'farmer' }, orderStatus: 'PLACED', paymentStatus: 'PENDING', timeline: [] };
  let quantity = 6, missing = false;
  try {
    mongoose.startSession = async () => ({
      withTransaction: async (fn) => {
        const before = { ...order };
        const qty = quantity;
        try { await fn(); } catch (error) { order = before; quantity = qty; throw error; }
      },
      endSession: async () => {}
    });
    Order.findById = () => ({ populate() { return this; }, then(resolve) { resolve({ ...order }); } });
    Order.findOneAndUpdate = async (filter, update) => {
      if (order.orderStatus !== filter.orderStatus || order.__v !== filter.__v) return null;
      order = { ...order, ...update.$set, __v: order.__v + 1 }; return order;
    };
    Listing.findOneAndUpdate = async () => { if (missing) return null; quantity += order.quantity; return { quantity }; };
    const call = async () => {
      let status;
      await updateOrderStatus({ params: { id: 'o1' }, user: { _id: 'buyer', role: 'BUYER_RETAIL' }, body: { nextStatus: 'CANCELLED' } }, {
        status(s) { status = s; return this; },
        json() {}
      }, (e) => { throw e; });
      return status;
    };
    missing = true; assert.equal(await call(), 409);
    assert.equal(order.orderStatus, 'PLACED');
    assert.equal(quantity, 6);
    missing = false; assert.equal(await call(), 200);
    assert.equal(order.orderStatus, 'CANCELLED');
    assert.equal(quantity, 10);
    assert.equal(await call(), 400);
    assert.equal(quantity, 10);
  } finally {
    mongoose.startSession = originalSession;
    Order.findById = originalFind;
    Order.findOneAndUpdate = originalUpdate;
    Listing.findOneAndUpdate = originalListing;
  }
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
