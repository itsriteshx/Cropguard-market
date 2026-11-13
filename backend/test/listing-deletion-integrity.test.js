const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProduceListing = require('../src/models/ProduceListing');
const Order = require('../src/models/Order');
const Negotiation = require('../src/models/Negotiation');
const { deleteListing } = require('../src/controllers/listingController');

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
    Order.exists = originalOrderExists;
    Negotiation.exists = originalNegotiationExists;
  }
});
