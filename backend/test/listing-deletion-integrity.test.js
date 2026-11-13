const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProduceListing = require('../src/models/ProduceListing');
const Order = require('../src/models/Order');
const Negotiation = require('../src/models/Negotiation');
const { deleteListing } = require('../src/controllers/listingController');
const { startNegotiation } = require('../src/controllers/negotiationController');
const { createOrder } = require('../src/controllers/orderController');

const callDeleteListing = async ({
  listingId = new mongoose.Types.ObjectId().toString(),
  user = { _id: new mongoose.Types.ObjectId(), role: 'FARMER' }
} = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    params: { id: listingId },
    user
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  let errorCaught = null;
  const next = (err) => {
    errorCaught = err;
  };
  await deleteListing(req, res, next);
  if (errorCaught) throw errorCaught;
  return { status: statusCode, body: responseData };
};

const callStartNegotiation = async ({
  body = {},
  user = { _id: new mongoose.Types.ObjectId(), role: 'BUYER_RETAIL' }
} = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    body,
    user,
    app: { get: () => null }
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  let errorCaught = null;
  const next = (err) => {
    errorCaught = err;
  };
  await startNegotiation(req, res, next);
  if (errorCaught) throw errorCaught;
  return { status: statusCode, body: responseData };
};

const callCreateOrder = async ({
  body = {},
  user = { _id: new mongoose.Types.ObjectId(), role: 'BUYER_RETAIL' }
} = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    body,
    user
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  let errorCaught = null;
  const next = (err) => {
    errorCaught = err;
  };
  await createOrder(req, res, next);
  if (errorCaught) throw errorCaught;
  return { status: statusCode, body: responseData };
};

test('delete listing: succeeds (200) when no active orders or negotiations exist', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let deletedId = null;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId
    });
    ProduceListing.findOneAndDelete = async (filter) => {
      deletedId = filter._id;
      return { _id: filter._id };
    };
    Order.exists = async () => null;
    Negotiation.exists = async () => null;

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /deleted successfully/i);
    assert.equal(deletedId, listingId);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

for (const orderStatus of ['PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED', 'SETTLED']) {
  test(`delete listing: blocked (409) when order status is ${orderStatus}`, async () => {
    const farmerId = new mongoose.Types.ObjectId();
    const listingId = new mongoose.Types.ObjectId().toString();

    const originalFindById = ProduceListing.findById;
    const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
    const originalOrderExists = Order.exists;
    const originalNegotiationExists = Negotiation.exists;

    try {
      ProduceListing.findById = async () => ({
        _id: listingId,
        farmer: farmerId
      });
      ProduceListing.findOneAndDelete = async () => {
        throw new Error('Should not delete listing when order exists');
      };
      Order.exists = async (filter) => {
        assert.ok(filter.orderStatus.$in.includes(orderStatus));
        return { _id: new mongoose.Types.ObjectId() };
      };
      Negotiation.exists = async () => null;

      const res = await callDeleteListing({
        listingId,
        user: { _id: farmerId, role: 'FARMER' }
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /order/i);
    } finally {
      ProduceListing.findById = originalFindById;
      ProduceListing.findOneAndDelete = originalFindOneAndDelete;
      Order.exists = originalOrderExists;
      Negotiation.exists = originalNegotiationExists;
    }
  });
}

test('delete listing: allows deletion (200) when only CANCELLED orders exist', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let deleted = false;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId
    });
    ProduceListing.findOneAndDelete = async () => {
      deleted = true;
      return { _id: listingId };
    };
    Order.exists = async (filter) => {
      // Filter must NOT include CANCELLED
      assert.ok(!filter.orderStatus.$in.includes('CANCELLED'));
      return null;
    };
    Negotiation.exists = async () => null;

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 200);
    assert.equal(deleted, true);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

for (const negStatus of ['OPEN', 'COUNTER_OFFERED']) {
  test(`delete listing: blocked (409) when active negotiation is ${negStatus}`, async () => {
    const farmerId = new mongoose.Types.ObjectId();
    const listingId = new mongoose.Types.ObjectId().toString();

    const originalFindById = ProduceListing.findById;
    const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
    const originalOrderExists = Order.exists;
    const originalNegotiationExists = Negotiation.exists;

    try {
      ProduceListing.findById = async () => ({
        _id: listingId,
        farmer: farmerId
      });
      ProduceListing.findOneAndDelete = async () => {
        throw new Error('Should not delete listing when active negotiation exists');
      };
      Order.exists = async () => null;
      Negotiation.exists = async () => ({ _id: new mongoose.Types.ObjectId() });

      const res = await callDeleteListing({
        listingId,
        user: { _id: farmerId, role: 'FARMER' }
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /negotiation/i);
    } finally {
      ProduceListing.findById = originalFindById;
      ProduceListing.findOneAndDelete = originalFindOneAndDelete;
      Order.exists = originalOrderExists;
      Negotiation.exists = originalNegotiationExists;
    }
  });
}

test('delete listing: blocked (409) when ACCEPTED negotiation without order exists', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId
    });
    ProduceListing.findOneAndDelete = async () => {
      throw new Error('Should not delete listing');
    };
    Order.exists = async () => null;
    Negotiation.exists = async (filter) => {
      // Must cover { status: 'ACCEPTED', order: null }
      assert.ok(filter.$or);
      return { _id: new mongoose.Types.ObjectId() };
    };

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /negotiation/i);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('delete listing: allows deletion (200) when negotiations are EXPIRED or REJECTED', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let deleted = false;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId
    });
    ProduceListing.findOneAndDelete = async () => {
      deleted = true;
      return { _id: listingId };
    };
    Order.exists = async () => null;
    Negotiation.exists = async () => null; // No active negotiations match

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 200);
    assert.equal(deleted, true);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('delete listing: returns 404 when listing does not exist', async () => {
  const originalFindById = ProduceListing.findById;
  try {
    ProduceListing.findById = async () => null;

    const res = await callDeleteListing({
      listingId: new mongoose.Types.ObjectId().toString(),
      user: { _id: new mongoose.Types.ObjectId(), role: 'FARMER' }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /not found/i);
  } finally {
    ProduceListing.findById = originalFindById;
  }
});

test('delete listing: returns 403 when user is neither the owner nor an admin', async () => {
  const ownerFarmerId = new mongoose.Types.ObjectId();
  const intruderFarmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: ownerFarmerId
    });

    const res = await callDeleteListing({
      listingId,
      user: { _id: intruderFarmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /not authorized/i);
  } finally {
    ProduceListing.findById = originalFindById;
  }
});

test('delete listing: allows deletion (200) by ADMIN even if not owner', async () => {
  const ownerFarmerId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let deleted = false;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: ownerFarmerId
    });
    ProduceListing.findOneAndDelete = async () => {
      deleted = true;
      return { _id: listingId };
    };
    Order.exists = async () => null;
    Negotiation.exists = async () => null;

    const res = await callDeleteListing({
      listingId,
      user: { _id: adminId, role: 'ADMIN' }
    });

    assert.equal(res.status, 200);
    assert.equal(deleted, true);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('models declare referential indexes: Order { listing: 1, orderStatus: 1 } and Negotiation { listing: 1, status: 1 }', () => {
  const orderIndexes = Order.schema.indexes();
  const hasOrderListingStatus = orderIndexes.some(
    ([fields]) => fields.listing === 1 && fields.orderStatus === 1
  );
  assert.ok(hasOrderListingStatus, 'Order schema must declare { listing: 1, orderStatus: 1 } index');

  const negIndexes = Negotiation.schema.indexes();
  const hasNegListingStatus = negIndexes.some(
    ([fields]) => fields.listing === 1 && fields.status === 1
  );
  assert.ok(hasNegListingStatus, 'Negotiation schema must declare { listing: 1, status: 1 } index');
});

test('delete listing concurrency: two simultaneous delete requests result in exactly one 200 and one 404', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let activeListing = { _id: listingId, farmer: farmerId };

  try {
    ProduceListing.findById = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve(activeListing ? { ...activeListing } : null);
      }
    });

    Order.exists = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve(null);
      }
    });

    Negotiation.exists = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve(null);
      }
    });

    ProduceListing.findOneAndDelete = () => ({
      then(resolve) {
        if (activeListing) {
          const doc = { ...activeListing };
          activeListing = null; // Atomically consumed by first caller
          resolve(doc);
        } else {
          resolve(null);
        }
      }
    });

    const results = await Promise.all([
      callDeleteListing({ listingId, user: { _id: farmerId, role: 'FARMER' } }),
      callDeleteListing({ listingId, user: { _id: farmerId, role: 'FARMER' } })
    ]);

    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 404]);
    assert.equal(activeListing, null);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('delete listing runs inside MongoDB session when session is active', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let sessionCreated = false;
  let transactionCommitted = false;
  let sessionEnded = false;

  const mockSession = {
    withTransaction: async (fn) => {
      await fn();
      transactionCommitted = true;
    },
    endSession: async () => {
      sessionEnded = true;
    }
  };

  try {
    mongoose.startSession = async () => {
      sessionCreated = true;
      return mockSession;
    };
    mongoose.startSession.__isMock = true;

    ProduceListing.findById = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve({ _id: listingId, farmer: farmerId });
      }
    });

    ProduceListing.findOneAndUpdate = () => ({
      then(resolve) {
        resolve({ _id: listingId, deletionPending: true });
      }
    });

    Order.exists = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve(null);
      }
    });

    Negotiation.exists = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve(null);
      }
    });

    ProduceListing.findOneAndDelete = () => ({
      then(resolve) {
        resolve({ _id: listingId });
      }
    });

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 200);
    assert.equal(sessionCreated, true);
    assert.equal(transactionCommitted, true);
    assert.equal(sessionEnded, true);
  } finally {
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('concurrency: startNegotiation cannot create an active negotiation once listing deletion has begun (409)', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalListingFindById = ProduceListing.findById;
  const originalListingFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalNegFindOne = Negotiation.findOne;
  const originalNegUpdateMany = Negotiation.updateMany;
  const originalNegCreate = Negotiation.create;

  let state = {
    _id: listingId,
    farmer: farmerId,
    cropName: 'Wheat',
    quantity: 100,
    unit: 'KG',
    pricePerUnit: 50,
    status: 'AVAILABLE',
    deletionPending: true // Deletion has begun!
  };

  try {
    ProduceListing.findById = async () => ({ ...state });
    ProduceListing.findOneAndUpdate = async (filter, update) => {
      if (filter.deletionPending?.$ne === true && state.deletionPending) {
        return null; // Blocked by deletion claim!
      }
      return { ...state };
    };
    ProduceListing.findOneAndUpdate.__isMock = true;

    Negotiation.updateMany = async () => ({ modifiedCount: 0 });
    Negotiation.findOne = async () => null;
    Negotiation.create = async () => {
      throw new Error('Should not create negotiation on deleting listing');
    };

    const res = await callStartNegotiation({
      body: { listingId, offeredPrice: 45, quantity: 10 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /deleted|unavailable/i);
  } finally {
    ProduceListing.findById = originalListingFindById;
    ProduceListing.findOneAndUpdate = originalListingFindOneAndUpdate;
    Negotiation.findOne = originalNegFindOne;
    Negotiation.updateMany = originalNegUpdateMany;
    Negotiation.create = originalNegCreate;
  }
});

test('concurrency: direct createOrder cannot place an order against a listing whose deletion has begun (409)', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalListingFindById = ProduceListing.findById;
  const originalListingFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalOrderCreate = Order.create;

  const mockSession = {
    withTransaction: async (fn) => {
      await fn();
    },
    endSession: async () => {}
  };

  try {
    mongoose.startSession = async () => mockSession;

    ProduceListing.findById = () => ({
      session() {
        return this;
      },
      then(resolve) {
        resolve({
          _id: listingId,
          farmer: farmerId,
          cropName: 'Wheat',
          quantity: 100,
          unit: 'KG',
          pricePerUnit: 50,
          status: 'AVAILABLE',
          deletionPending: true // Deletion in progress
        });
      }
    });

    ProduceListing.findOneAndUpdate = async (filter) => {
      // Stock reservation check ensures deletionPending !== true
      if (filter.deletionPending?.$ne === true) {
        return null;
      }
      return { _id: listingId };
    };

    Order.create = async () => {
      throw new Error('Should not create order on deleting listing');
    };

    const res = await callCreateOrder({
      body: { listingId, quantity: 10 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /deleted|unavailable/i);
  } finally {
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalListingFindById;
    ProduceListing.findOneAndUpdate = originalListingFindOneAndUpdate;
    Order.create = originalOrderCreate;
  }
});

test('concurrency: failed deletion (due to active order) releases deletionPending claim so listing is not locked', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalUpdateOne = ProduceListing.updateOne;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let state = {
    _id: listingId,
    farmer: farmerId,
    deletionPending: false
  };

  let claimReleased = false;

  try {
    ProduceListing.findById = async () => ({ ...state });
    ProduceListing.findOneAndUpdate = async (filter, update) => {
      if (filter.deletionPending?.$ne === true && !state.deletionPending) {
        state.deletionPending = true; // Claim acquired
        return { ...state };
      }
      return null;
    };
    ProduceListing.findOneAndUpdate.__isMock = true;

    ProduceListing.updateOne = async (filter, update) => {
      if (update.$set?.deletionPending === false) {
        state.deletionPending = false;
        claimReleased = true;
      }
      return { modifiedCount: 1 };
    };
    ProduceListing.updateOne.__isMock = true;

    // Active order exists!
    Order.exists = async () => ({ _id: new mongoose.Types.ObjectId() });
    Negotiation.exists = async () => null;

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /order/i);
    assert.equal(claimReleased, true);
    assert.equal(state.deletionPending, false); // Fully unlocked!
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    ProduceListing.updateOne = originalUpdateOne;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('concurrency: failed negotiation creation does not lock the listing', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalListingFindById = ProduceListing.findById;
  const originalListingFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalNegFindOne = Negotiation.findOne;
  const originalNegUpdateMany = Negotiation.updateMany;
  const originalNegCreate = Negotiation.create;

  let state = {
    _id: listingId,
    farmer: farmerId,
    quantity: 100,
    pricePerUnit: 50,
    status: 'AVAILABLE',
    deletionPending: false
  };

  try {
    ProduceListing.findById = async () => ({ ...state });
    ProduceListing.findOneAndUpdate = async () => ({ ...state });
    ProduceListing.findOneAndUpdate.__isMock = true;

    Negotiation.updateMany = async () => ({ modifiedCount: 0 });
    Negotiation.findOne = async () => null;

    // Simulate database duplicate error
    Negotiation.create = async () => {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    };

    const res = await callStartNegotiation({
      body: { listingId, offeredPrice: 45, quantity: 10 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });

    assert.equal(res.status, 409);
    assert.equal(state.deletionPending, false);
    assert.equal(state.status, 'AVAILABLE');
  } finally {
    ProduceListing.findById = originalListingFindById;
    ProduceListing.findOneAndUpdate = originalListingFindOneAndUpdate;
    Negotiation.findOne = originalNegFindOne;
    Negotiation.updateMany = originalNegUpdateMany;
    Negotiation.create = originalNegCreate;
  }
});

test('concurrency: repeated deletion requests handle state safely (200, then 404)', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndDelete = ProduceListing.findOneAndDelete;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let state = {
    _id: listingId,
    farmer: farmerId,
    deletionPending: false
  };

  try {
    ProduceListing.findById = async () => (state ? { ...state } : null);
    ProduceListing.findOneAndUpdate = async () => {
      if (!state) return null;
      state.deletionPending = true;
      return { ...state };
    };
    ProduceListing.findOneAndDelete = async () => {
      if (!state) return null;
      const doc = { ...state };
      state = null; // deleted!
      return doc;
    };
    Order.exists = async () => null;
    Negotiation.exists = async () => null;

    // First deletion succeeds
    const firstRes = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });
    assert.equal(firstRes.status, 200);
    assert.equal(state, null);

    // Second deletion of already deleted listing returns 404
    const secondRes = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });
    assert.equal(secondRes.status, 404);
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndDelete = originalFindOneAndDelete;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('authorization: non-owner buyer and non-owner farmer cannot delete listing (403)', async () => {
  const ownerFarmerId = new mongoose.Types.ObjectId();
  const otherFarmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;

  try {
    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: ownerFarmerId
    });

    const buyerRes = await callDeleteListing({
      listingId,
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });
    assert.equal(buyerRes.status, 403);

    const otherFarmerRes = await callDeleteListing({
      listingId,
      user: { _id: otherFarmerId, role: 'FARMER' }
    });
    assert.equal(otherFarmerRes.status, 403);
  } finally {
    ProduceListing.findById = originalFindById;
  }
});

test('transaction abort does not trigger an unsafe manual claim reset', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalFindById = ProduceListing.findById;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalUpdateOne = ProduceListing.updateOne;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let updateOneCalled = false;
  let transactionAborted = false;

  const mockSession = {
    withTransaction: async (fn) => {
      try {
        await fn();
      } catch (err) {
        transactionAborted = true; // MongoDB rolls back automatically
        throw err;
      }
    },
    endSession: async () => {}
  };

  try {
    mongoose.startSession = async () => mockSession;
    mongoose.startSession.__isMock = true;

    ProduceListing.findById = () => ({
      session() { return this; },
      then(resolve) { resolve({ _id: listingId, farmer: farmerId }); }
    });

    ProduceListing.findOneAndUpdate = () => ({
      then(resolve) { resolve({ _id: listingId, deletionPending: true }); }
    });

    ProduceListing.updateOne = async () => {
      updateOneCalled = true;
      return { modifiedCount: 1 };
    };

    // Active order blocks deletion
    Order.exists = () => ({
      session() { return this; },
      then(resolve) { resolve({ _id: new mongoose.Types.ObjectId() }); }
    });
    Negotiation.exists = () => ({
      session() { return this; },
      then(resolve) { resolve(null); }
    });

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 409);
    assert.equal(transactionAborted, true);
    // Crucial check: outer catch must NOT manually call updateOne when in a transaction
    assert.equal(updateOneCalled, false, 'Outer catch must not manually call updateOne when transaction handles rollback');
  } finally {
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    ProduceListing.updateOne = originalUpdateOne;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('a failed non-transactional deletion cannot clear a subsequent request claim', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = ProduceListing.findById;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalUpdateOne = ProduceListing.updateOne;
  const originalOrderExists = Order.exists;
  const originalNegotiationExists = Negotiation.exists;

  let simulatedListing = {
    _id: listingId,
    farmer: farmerId,
    deletionPending: true,
    deletionClaimToken: 'token_owned_by_request_2'
  };

  let tokenMatchAttempted = null;

  try {
    ProduceListing.findById = async () => ({ ...simulatedListing });
    ProduceListing.findOneAndUpdate = async () => ({ ...simulatedListing });
    ProduceListing.findOneAndUpdate.__isMock = true;

    ProduceListing.updateOne = async (filter, update) => {
      tokenMatchAttempted = filter.deletionClaimToken;
      // If the token matches, update the document; otherwise do not touch it
      if (filter.deletionClaimToken === simulatedListing.deletionClaimToken) {
        simulatedListing.deletionPending = false;
        simulatedListing.deletionClaimToken = null;
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    };
    ProduceListing.updateOne.__isMock = true;

    // Active order causes failure
    Order.exists = async () => ({ _id: new mongoose.Types.ObjectId() });
    Negotiation.exists = async () => null;

    const res = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });

    assert.equal(res.status, 409);
    // Request 1 generated its own token, which did not match Request 2's token
    assert.notEqual(tokenMatchAttempted, 'token_owned_by_request_2');
    // Request 2's claim remains fully protected and intact
    assert.equal(simulatedListing.deletionPending, true);
    assert.equal(simulatedListing.deletionClaimToken, 'token_owned_by_request_2');
  } finally {
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    ProduceListing.updateOne = originalUpdateOne;
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});

test('session creation failure returns 503 in production-mode test conditions', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalNodeEnv = process.env.NODE_ENV;
  const originalStartSession = mongoose.startSession;
  const originalFindById = ProduceListing.findById;

  try {
    process.env.NODE_ENV = 'production';
    mongoose.startSession = async () => {
      throw new Error('MongoServerSelectionError: connection timed out');
    };

    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId,
      status: 'AVAILABLE',
      quantity: 50,
      pricePerUnit: 100,
      deletionPending: false
    });

    // deleteListing must fail closed with 503
    const delRes = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });
    assert.equal(delRes.status, 503);
    assert.match(delRes.body.message, /transaction support/i);

    // startNegotiation must fail closed with 503
    const negRes = await callStartNegotiation({
      body: { listingId, offeredPrice: 90, quantity: 5 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });
    assert.equal(negRes.status, 503);
    assert.match(negRes.body.message, /transaction support/i);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalFindById;
  }
});

test('transaction support missing (code 20) returns 503', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalFindById = ProduceListing.findById;
  const originalNegUpdateMany = Negotiation.updateMany;
  const originalNegFindOne = Negotiation.findOne;

  const code20Session = {
    withTransaction: async () => {
      const err = new Error('Transaction numbers are only allowed on a replica set member or mongos');
      err.code = 20;
      throw err;
    },
    endSession: async () => {}
  };

  try {
    mongoose.startSession = async () => code20Session;
    mongoose.startSession.__isMock = true;

    Negotiation.updateMany = async () => ({ modifiedCount: 0 });
    Negotiation.findOne = async () => null;

    ProduceListing.findById = () => ({
      session() { return this; },
      then(resolve) {
        resolve({
          _id: listingId,
          farmer: farmerId,
          status: 'AVAILABLE',
          quantity: 50,
          pricePerUnit: 100,
          deletionPending: false
        });
      }
    });

    const delRes = await callDeleteListing({
      listingId,
      user: { _id: farmerId, role: 'FARMER' }
    });
    assert.equal(delRes.status, 503);
    assert.match(delRes.body.message, /replica set/i);

    const negRes = await callStartNegotiation({
      body: { listingId, offeredPrice: 90, quantity: 5 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });
    assert.equal(negRes.status, 503);
    assert.match(negRes.body.message, /replica set/i);
  } finally {
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalFindById;
    Negotiation.updateMany = originalNegUpdateMany;
    Negotiation.findOne = originalNegFindOne;
  }
});

test('negotiation creation uses the same session for listing guard and document creation', async () => {
  const farmerId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalFindById = ProduceListing.findById;
  const originalFindOneAndUpdate = ProduceListing.findOneAndUpdate;
  const originalNegFindOne = Negotiation.findOne;
  const originalNegUpdateMany = Negotiation.updateMany;
  const originalNegCreate = Negotiation.create;

  const testSession = {
    id: 'test_session_xyz',
    withTransaction: async (fn) => { await fn(); },
    endSession: async () => {}
  };

  let guardSessionReceived = null;
  let createSessionReceived = null;

  try {
    mongoose.startSession = async () => testSession;
    mongoose.startSession.__isMock = true;

    ProduceListing.findById = async () => ({
      _id: listingId,
      farmer: farmerId,
      quantity: 100,
      unit: 'KG',
      pricePerUnit: 50,
      status: 'AVAILABLE',
      deletionPending: false
    });

    ProduceListing.findOneAndUpdate = (filter, update, options) => {
      guardSessionReceived = options?.session;
      return {
        then(resolve) {
          resolve({ _id: listingId, status: 'AVAILABLE', deletionPending: false });
        }
      };
    };

    Negotiation.updateMany = async () => ({ modifiedCount: 0 });
    Negotiation.findOne = async () => null;
    Negotiation.create = async (docs, options) => {
      createSessionReceived = options?.session;
      return [{ _id: 'n_same_session', listing: listingId, currentOfferedPrice: 45 }];
    };

    const res = await callStartNegotiation({
      body: { listingId, offeredPrice: 45, quantity: 10 },
      user: { _id: buyerId, role: 'BUYER_RETAIL' }
    });

    assert.equal(res.status, 201);
    assert.equal(guardSessionReceived, testSession, 'Listing guard must receive the active session');
    assert.equal(createSessionReceived, testSession, 'Negotiation.create must receive the exact same session');
  } finally {
    mongoose.startSession = originalStartSession;
    ProduceListing.findById = originalFindById;
    ProduceListing.findOneAndUpdate = originalFindOneAndUpdate;
    Negotiation.findOne = originalNegFindOne;
    Negotiation.updateMany = originalNegUpdateMany;
    Negotiation.create = originalNegCreate;
  }
});
