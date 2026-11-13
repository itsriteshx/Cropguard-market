const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const { getFarmerLedger } = require('../src/controllers/orderController');

const callLedger = async (user = { _id: new mongoose.Types.ObjectId(), role: 'FARMER' }) => {
  let statusCode = 200;
  let responseData = null;
  const req = { user };
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
  await getFarmerLedger(req, res, next);
  if (errorCaught) throw errorCaught;
  return { status: statusCode, body: responseData };
};

test('farmer ledger: settled earnings and settled count calculated correctly', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 45000,
        settledOrdersCount: 3,
        activeOrdersCount: 0,
        pendingEscrowAmount: 0,
        totalVolumeKg: 1500
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledger.totalRevenue, 45000);
    assert.equal(res.body.ledger.totalTransactions, 3);
    assert.equal(res.body.ledgerSummary.totalEarnings, 45000);
    assert.equal(res.body.ledgerSummary.settledOrdersCount, 3);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: active orders count and pending escrow amount calculated correctly', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 0,
        settledOrdersCount: 0,
        activeOrdersCount: 2,
        pendingEscrowAmount: 18500,
        totalVolumeKg: 800
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledger.pendingEscrowAmount, 18500);
    assert.equal(res.body.ledgerSummary.activeOrdersCount, 2);
    assert.equal(res.body.ledgerSummary.pendingEscrowAmount, 18500);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: KG volume calculation (1:1 conversion)', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  let pipelineCaptured = null;
  try {
    Order.aggregate = async (pipeline) => {
      pipelineCaptured = pipeline;
      return [
        {
          totalEarnings: 10000,
          settledOrdersCount: 1,
          activeOrdersCount: 0,
          pendingEscrowAmount: 0,
          totalVolumeKg: 250 // 250 KG
        }
      ];
    };
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledgerSummary.totalVolumeKg, 250);
    assert.equal(res.body.ledger.totalQuintals, 2.5); // 250 / 100
    assert.ok(pipelineCaptured);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: QUINTAL volume calculation (1 QUINTAL = 100 KG)', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 50000,
        settledOrdersCount: 2,
        activeOrdersCount: 0,
        pendingEscrowAmount: 0,
        totalVolumeKg: 2000 // 20 QUINTAL * 100 = 2000 KG
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledgerSummary.totalVolumeKg, 2000);
    assert.equal(res.body.ledger.totalQuintals, 20); // 2000 / 100
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: TON volume calculation (1 TON = 1000 KG)', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 80000,
        settledOrdersCount: 1,
        activeOrdersCount: 0,
        pendingEscrowAmount: 0,
        totalVolumeKg: 5000 // 5 TON * 1000 = 5000 KG
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledgerSummary.totalVolumeKg, 5000);
    assert.equal(res.body.ledger.totalQuintals, 50); // 5000 / 100
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: aggregation pipeline filters out CANCELLED orders in match stage', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  let matchStage = null;
  try {
    Order.aggregate = async (pipeline) => {
      matchStage = pipeline[0].$match;
      return [];
    };
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    await callLedger();
    assert.ok(matchStage);
    assert.deepEqual(matchStage.orderStatus.$in, [
      'SETTLED',
      'PLACED',
      'ESCROW_HELD',
      'DISPATCHED',
      'DELIVERED'
    ]);
    assert.ok(!matchStage.orderStatus.$in.includes('CANCELLED'));
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: mixed units aggregation pipeline structure converts KG, QUINTAL, and TON', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  let projectStage = null;
  try {
    Order.aggregate = async (pipeline) => {
      projectStage = pipeline[1].$project;
      return [
        {
          totalEarnings: 150000,
          settledOrdersCount: 3,
          activeOrdersCount: 0,
          pendingEscrowAmount: 0,
          totalVolumeKg: 3600 // 100 KG + 5 QUINTAL(500 KG) + 3 TON(3000 KG)
        }
      ];
    };
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.ok(projectStage);
    assert.ok(projectStage.volumeKg.$switch);
    assert.equal(projectStage.volumeKg.$switch.branches.length, 2);
    assert.equal(res.body.ledgerSummary.totalVolumeKg, 3600);
    assert.equal(res.body.ledger.totalQuintals, 36);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: zero orders / empty state returns default zeros and fallback rate', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.status, 200);
    assert.equal(res.body.ledger.totalRevenue, 0);
    assert.equal(res.body.ledger.totalMiddlemanSaved, 0);
    assert.equal(res.body.ledger.totalTransactions, 0);
    assert.equal(res.body.ledger.totalQuintals, 0);
    assert.equal(res.body.ledger.averageRatePerQuintal, 2525); // Fallback rate
    assert.equal(res.body.ledger.pendingEscrowAmount, 0);
    assert.equal(res.body.ledger.fairPriceComplianceRate, '100%');
    assert.equal(res.body.ledger.currency, 'INR');

    assert.equal(res.body.ledgerSummary.totalEarnings, 0);
    assert.equal(res.body.ledgerSummary.pendingEscrowAmount, 0);
    assert.equal(res.body.ledgerSummary.totalVolumeKg, 0);
    assert.equal(res.body.ledgerSummary.settledOrdersCount, 0);
    assert.equal(res.body.ledgerSummary.activeOrdersCount, 0);
    assert.equal(res.body.ledgerSummary.estimatedMiddlemanSavings, 0);
    assert.equal(res.body.ledgerSummary.currency, 'INR');

    assert.deepEqual(res.body.recentTransactions, []);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: preserves both ledger and ledgerSummary contract structures', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 100000,
        settledOrdersCount: 5,
        activeOrdersCount: 2,
        pendingEscrowAmount: 25000,
        totalVolumeKg: 4000
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    // Validate ledger contract
    assert.ok('totalRevenue' in res.body.ledger);
    assert.ok('totalMiddlemanSaved' in res.body.ledger);
    assert.ok('totalTransactions' in res.body.ledger);
    assert.ok('totalQuintals' in res.body.ledger);
    assert.ok('averageRatePerQuintal' in res.body.ledger);
    assert.ok('fairPriceComplianceRate' in res.body.ledger);
    assert.ok('pendingEscrowAmount' in res.body.ledger);
    assert.ok('currency' in res.body.ledger);

    // Validate ledgerSummary contract
    assert.ok('totalEarnings' in res.body.ledgerSummary);
    assert.ok('pendingEscrowAmount' in res.body.ledgerSummary);
    assert.ok('totalVolumeKg' in res.body.ledgerSummary);
    assert.ok('settledOrdersCount' in res.body.ledgerSummary);
    assert.ok('activeOrdersCount' in res.body.ledgerSummary);
    assert.ok('estimatedMiddlemanSavings' in res.body.ledgerSummary);
    assert.ok('currency' in res.body.ledgerSummary);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: recent transactions limits to 10 orders and maps all fields correctly', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [];
    const dummyOrders = Array.from({ length: 15 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      orderNumber: `CGM-ORDER-${i + 1}`,
      cropName: `Crop ${i + 1}`,
      quantity: 10 + i,
      unit: 'QUINTAL',
      totalAmount: 2500 * (10 + i),
      buyer: { name: `Buyer ${i + 1}`, phone: '9876543210' },
      orderStatus: 'SETTLED',
      paymentStatus: 'PAID_TO_FARMER',
      createdAt: new Date()
    }));

    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: (n) => ({
              lean: async () => dummyOrders.slice(0, n)
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.body.recentTransactions.length, 10);
    const tx = res.body.recentTransactions[0];
    assert.ok(tx.orderId);
    assert.equal(tx.orderNumber, 'CGM-ORDER-1');
    assert.equal(tx.cropName, 'Crop 1');
    assert.equal(tx.quantity, '10 QUINTAL');
    assert.equal(tx.amount, 25000);
    assert.equal(tx.buyerName, 'Buyer 1');
    assert.equal(tx.orderStatus, 'SETTLED');
    assert.equal(tx.paymentStatus, 'PAID_TO_FARMER');
    assert.ok(tx.date);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: handles unpopulated buyer in recent transactions with Unknown Buyer fallback', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => [
                {
                  _id: new mongoose.Types.ObjectId(),
                  orderNumber: 'CGM-TEST-1',
                  cropName: 'Tomato',
                  quantity: 50,
                  unit: 'KG',
                  totalAmount: 1500,
                  buyer: null,
                  orderStatus: 'PLACED',
                  paymentStatus: 'PENDING',
                  createdAt: new Date()
                }
              ]
            })
          })
        })
      })
    });

    const res = await callLedger();
    assert.equal(res.body.recentTransactions.length, 1);
    assert.equal(res.body.recentTransactions[0].buyerName, 'Unknown Buyer');
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: no NaN, null, or undefined values in numeric calculations', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 73529.5,
        settledOrdersCount: 7,
        activeOrdersCount: 3,
        pendingEscrowAmount: 14200.25,
        totalVolumeKg: 2841.5
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    const l = res.body.ledger;
    const s = res.body.ledgerSummary;

    assert.ok(!Number.isNaN(l.totalRevenue));
    assert.ok(!Number.isNaN(l.totalMiddlemanSaved));
    assert.ok(!Number.isNaN(l.totalTransactions));
    assert.ok(!Number.isNaN(l.totalQuintals));
    assert.ok(!Number.isNaN(l.averageRatePerQuintal));
    assert.ok(!Number.isNaN(l.pendingEscrowAmount));

    assert.ok(!Number.isNaN(s.totalEarnings));
    assert.ok(!Number.isNaN(s.pendingEscrowAmount));
    assert.ok(!Number.isNaN(s.totalVolumeKg));
    assert.ok(!Number.isNaN(s.settledOrdersCount));
    assert.ok(!Number.isNaN(s.activeOrdersCount));
    assert.ok(!Number.isNaN(s.estimatedMiddlemanSavings));
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: 10% intermediary commission savings rounded to integer', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 33333,
        settledOrdersCount: 1,
        activeOrdersCount: 0,
        pendingEscrowAmount: 0,
        totalVolumeKg: 1000
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    // 33333 * 0.1 = 3333.3 -> Math.round -> 3333
    assert.equal(res.body.ledger.totalMiddlemanSaved, 3333);
    assert.equal(res.body.ledgerSummary.estimatedMiddlemanSavings, 3333);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: averageRatePerQuintal calculated correctly from revenue and quintals', async () => {
  const originalAggregate = Order.aggregate;
  const originalFind = Order.find;
  try {
    Order.aggregate = async () => [
      {
        totalEarnings: 60000,
        settledOrdersCount: 2,
        activeOrdersCount: 0,
        pendingEscrowAmount: 0,
        totalVolumeKg: 2000 // 20 Quintals
      }
    ];
    Order.find = () => ({
      select: () => ({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });

    const res = await callLedger();
    // 60000 / (2000 / 100) = 60000 / 20 = 3000
    assert.equal(res.body.ledger.averageRatePerQuintal, 3000);
  } finally {
    Order.aggregate = originalAggregate;
    Order.find = originalFind;
  }
});

test('farmer ledger: Order model defines compound index on { farmer: 1, createdAt: -1 }', () => {
  const indexes = Order.schema.indexes();
  const hasFarmerCreatedAtIndex = indexes.some(([fields]) => fields.farmer === 1 && fields.createdAt === -1);
  assert.ok(hasFarmerCreatedAtIndex, 'Order schema must declare compound index on { farmer: 1, createdAt: -1 }');
});
