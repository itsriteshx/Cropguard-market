const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const { getMyOrders } = require('../src/controllers/orderController');

const callGetMyOrders = async ({
  user = { _id: new mongoose.Types.ObjectId(), role: 'BUYER_RETAIL' },
  query = {}
} = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = { user, query };
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
  await getMyOrders(req, res, next);
  if (errorCaught) throw errorCaught;
  return { status: statusCode, body: responseData };
};

const mockOrderQuery = ({ countResult = 0, findResult = [], onFind = null } = {}) => {
  const originalCount = Order.countDocuments;
  const originalFind = Order.find;

  Order.countDocuments = async (filter) => {
    return typeof countResult === 'function' ? countResult(filter) : countResult;
  };

  Order.find = (filter) => {
    let skipVal = 0;
    let limitVal = 50;
    const queryObj = {
      populate() {
        return queryObj;
      },
      sort() {
        return queryObj;
      },
      skip(s) {
        skipVal = s;
        return queryObj;
      },
      limit(l) {
        limitVal = l;
        return queryObj;
      },
      then(resolve, reject) {
        if (onFind) onFind({ filter, skip: skipVal, limit: limitVal });
        const res = typeof findResult === 'function' ? findResult({ filter, skip: skipVal, limit: limitVal }) : findResult;
        return Promise.resolve(res).then(resolve, reject);
      }
    };
    return queryObj;
  };

  return () => {
    Order.countDocuments = originalCount;
    Order.find = originalFind;
  };
};

test('orders pagination: default pagination applies page=1 and limit=50', async () => {
  let captured = null;
  const restore = mockOrderQuery({
    countResult: 120,
    findResult: Array.from({ length: 50 }, (_, i) => ({ _id: `o${i}` })),
    onFind: (params) => {
      captured = params;
    }
  });
  try {
    const res = await callGetMyOrders();
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.total, 120);
    assert.equal(res.body.pages, 3); // Math.ceil(120 / 50)
    assert.equal(res.body.count, 50);
    assert.equal(res.body.orders.length, 50);
    assert.equal(captured.skip, 0);
    assert.equal(captured.limit, 50);
  } finally {
    restore();
  }
});

test('orders pagination: custom page and limit within bounds', async () => {
  let captured = null;
  const restore = mockOrderQuery({
    countResult: 45,
    findResult: Array.from({ length: 15 }, (_, i) => ({ _id: `o${i}` })),
    onFind: (params) => {
      captured = params;
    }
  });
  try {
    const res = await callGetMyOrders({ query: { page: '2', limit: '15' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.total, 45);
    assert.equal(res.body.pages, 3);
    assert.equal(res.body.count, 15);
    assert.equal(captured.skip, 15); // (2 - 1) * 15
    assert.equal(captured.limit, 15);
  } finally {
    restore();
  }
});

test('orders pagination: maximum allowed limit (limit=100) is accepted', async () => {
  let captured = null;
  const restore = mockOrderQuery({
    countResult: 200,
    findResult: [],
    onFind: (params) => {
      captured = params;
    }
  });
  try {
    const res = await callGetMyOrders({ query: { page: '1', limit: '100' } });
    assert.equal(res.status, 200);
    assert.equal(captured.limit, 100);
    assert.equal(res.body.pages, 2);
  } finally {
    restore();
  }
});

test('orders pagination: limit exceeding 100 returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { limit: '101' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);
  } finally {
    restore();
  }
});

test('orders pagination: limit of 0 returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { limit: '0' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);
  } finally {
    restore();
  }
});

test('orders pagination: negative limit returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { limit: '-10' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);
  } finally {
    restore();
  }
});

test('orders pagination: page of 0 returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { page: '0' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /page/i);
  } finally {
    restore();
  }
});

test('orders pagination: negative page returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { page: '-3' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /page/i);
  } finally {
    restore();
  }
});

test('orders pagination: non-numeric page string returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { page: 'first' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /page/i);
  } finally {
    restore();
  }
});

test('orders pagination: non-numeric limit string returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { limit: 'all' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);
  } finally {
    restore();
  }
});

test('orders pagination: floating-point page returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { page: '1.5' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /page/i);
  } finally {
    restore();
  }
});

test('orders pagination: floating-point limit returns HTTP 400', async () => {
  const restore = mockOrderQuery();
  try {
    const res = await callGetMyOrders({ query: { limit: '20.5' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);
  } finally {
    restore();
  }
});

test('orders pagination: empty result sets total=0, pages=0, count=0, orders=[]', async () => {
  const restore = mockOrderQuery({
    countResult: 0,
    findResult: []
  });
  try {
    const res = await callGetMyOrders();
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.equal(res.body.pages, 0);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.orders, []);
  } finally {
    restore();
  }
});

test('orders pagination: role filtering is preserved with pagination query', async () => {
  let capturedFilter = null;
  const userId = new mongoose.Types.ObjectId();
  const restore = mockOrderQuery({
    countResult: 5,
    findResult: [],
    onFind: ({ filter }) => {
      capturedFilter = filter;
    }
  });
  try {
    const res = await callGetMyOrders({
      user: { _id: userId, role: 'BUYER_WHOLESALE' },
      query: { role: 'buyer', page: '1', limit: '10' }
    });
    assert.equal(res.status, 200);
    assert.equal(capturedFilter.buyer, userId);
  } finally {
    restore();
  }
});

test('orders pagination: status filtering is preserved and converted to uppercase', async () => {
  let capturedFilter = null;
  const restore = mockOrderQuery({
    countResult: 8,
    findResult: [],
    onFind: ({ filter }) => {
      capturedFilter = filter;
    }
  });
  try {
    const res = await callGetMyOrders({
      query: { status: 'settled', page: '1', limit: '25' }
    });
    assert.equal(res.status, 200);
    assert.equal(capturedFilter.orderStatus, 'SETTLED');
  } finally {
    restore();
  }
});

test('orders pagination: admin role queries without role filter', async () => {
  let capturedFilter = null;
  const restore = mockOrderQuery({
    countResult: 500,
    findResult: [],
    onFind: ({ filter }) => {
      capturedFilter = filter;
    }
  });
  try {
    const res = await callGetMyOrders({
      user: { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' },
      query: { page: '2', limit: '50' }
    });
    assert.equal(res.status, 200);
    assert.equal(capturedFilter.buyer, undefined);
    assert.equal(capturedFilter.farmer, undefined);
    assert.equal(capturedFilter.$or, undefined);
  } finally {
    restore();
  }
});
