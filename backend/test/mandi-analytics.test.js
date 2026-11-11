const test = require('node:test');
const assert = require('node:assert/strict');

const MandiRate = require('../src/models/MandiRate');
const { getMandiAnalytics } = require('../src/controllers/mandiController');

const originalAggregate = MandiRate.aggregate;

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return response;
};

test('analytics applies normalized filters to both aggregation pipelines', async () => {
  const pipelines = [];

  try {
    MandiRate.aggregate = async (pipeline) => {
      pipelines.push(pipeline);
      return [];
    };

    const req = {
      query: {
        state: ' maharashtra ',
        district: ' pune ',
        from: '2026-11-08',
        to: '2026-11-09'
      }
    };

    const res = createResponse();

    await getMandiAnalytics(req, res, (err) => {
      throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(pipelines.length, 2);

    for (const pipeline of pipelines) {
      const match = pipeline[0].$match;

      assert.equal(match.state, 'MAHARASHTRA');
      assert.equal(match.district, 'PUNE');

      assert.equal(
        match.priceDate.$gte.toISOString(),
        '2026-11-08T00:00:00.000Z'
      );

      assert.equal(
        match.priceDate.$lt.toISOString(),
        '2026-11-10T00:00:00.000Z'
      );
    }
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('analytics rejects an invalid calendar date', async () => {
  let aggregateCalled = false;

  try {
    MandiRate.aggregate = async () => {
      aggregateCalled = true;
      return [];
    };

    const res = createResponse();

    await getMandiAnalytics(
      { query: { from: '2026-02-30' } },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid from calendar date/);
    assert.equal(aggregateCalled, false);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('analytics rejects a reversed date range', async () => {
  let aggregateCalled = false;

  try {
    MandiRate.aggregate = async () => {
      aggregateCalled = true;
      return [];
    };

    const res = createResponse();

    await getMandiAnalytics(
      {
        query: {
          from: '2026-11-10',
          to: '2026-11-08'
        }
      },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /cannot be after/);
    assert.equal(aggregateCalled, false);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('analytics uses an empty match when no filters are supplied', async () => {
  const pipelines = [];

  try {
    MandiRate.aggregate = async (pipeline) => {
      pipelines.push(pipeline);
      return [];
    };

    const res = createResponse();

    await getMandiAnalytics(
      { query: {} },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(pipelines[0][0].$match, {});
    assert.deepEqual(pipelines[1][0].$match, {});
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('analytics counts distinct market centers instead of documents', async () => {
  const pipelines = [];

  const originalAggregate = MandiRate.aggregate;

  try {
    MandiRate.aggregate = async (pipeline) => {
      pipelines.push(pipeline);
      return [];
    };

    const res = createResponse();

    await getMandiAnalytics(
      { query: {} },
      res,
      (err) => { throw err; }
    );

    const commodityGroup = pipelines[0][1].$group;
    const commodityProject = pipelines[0][2].$project;

    assert.deepEqual(commodityGroup.marketCenters, {
      $addToSet: '$marketCenter'
    });

    assert.deepEqual(commodityProject.marketsCount, {
      $size: '$marketCenters'
    });

    const districtGroup = pipelines[1][1].$group;
    const districtProject = pipelines[1][2].$project;

    assert.deepEqual(districtGroup.marketCenters, {
      $addToSet: '$marketCenter'
    });

    assert.deepEqual(districtProject.mandiCount, {
      $size: '$marketCenters'
    });
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('historical trends groups by date and commodity and sorts chronologically', async () => {
  const { getMandiPriceTrends } = require('../src/controllers/mandiController');

  let capturedPipeline;

  try {
    MandiRate.aggregate = async (pipeline) => {
      capturedPipeline = pipeline;
      return [];
    };

    const res = createResponse();

    await getMandiPriceTrends(
      { query: { commodity: ' onion ' } },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.trends, []);

    assert.deepEqual(capturedPipeline[0].$match, {
      commodity: 'ONION'
    });

    assert.deepEqual(capturedPipeline[1].$group._id, {
      date: '$priceDate',
      commodity: '$commodity'
    });

    assert.deepEqual(capturedPipeline[1].$group.marketCenters, {
      $addToSet: '$marketCenter'
    });

    assert.deepEqual(capturedPipeline[2].$project.marketsCount, {
      $size: '$marketCenters'
    });

    assert.deepEqual(capturedPipeline[3].$sort, {
      date: 1,
      commodity: 1
    });
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});


test('market comparison requires a commodity filter', async () => {
  const { getMandiMarketComparison } = require('../src/controllers/mandiController');

  let aggregateCalled = false;

  try {
    MandiRate.aggregate = async () => {
      aggregateCalled = true;
      return [];
    };

    const res = createResponse();

    await getMandiMarketComparison(
      { query: {} },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Commodity filter is required/);
    assert.equal(aggregateCalled, false);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});


test('market comparison groups by market identity and sorts by average price', async () => {
  const { getMandiMarketComparison } = require('../src/controllers/mandiController');

  let capturedPipeline;

  try {
    MandiRate.aggregate = async (pipeline) => {
      capturedPipeline = pipeline;
      return [];
    };

    const res = createResponse();

    await getMandiMarketComparison(
      { query: { commodity: ' onion ' } },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.commodity, 'ONION');

    assert.deepEqual(capturedPipeline[0].$match, {
      commodity: 'ONION'
    });

    assert.deepEqual(capturedPipeline[1].$group._id, {
      state: '$state',
      district: '$district',
      marketCenter: '$marketCenter',
      unit: '$unit'
    });

    assert.deepEqual(capturedPipeline[3].$sort, {
      avgModalPrice: 1
    });
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});


test('analytics rejects empty or whitespace-only text filter', async () => {
  const res = createResponse();
  await getMandiAnalytics(
    { query: { commodity: '   ' } },
    res,
    (err) => { throw err; }
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Invalid commodity filter/);
});

test('analytics rejects non-string text filter', async () => {
  const res = createResponse();
  await getMandiAnalytics(
    { query: { category: ['VEGETABLES', 'GRAINS'] } },
    res,
    (err) => { throw err; }
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Invalid category filter/);
});

test('analytics rejects malformed date format', async () => {
  const res = createResponse();
  await getMandiAnalytics(
    { query: { from: '2026/11/08' } },
    res,
    (err) => { throw err; }
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Use YYYY-MM-DD/);
});

test('analytics handles single-boundary date filters (from-only and to-only)', async () => {
  const pipelines = [];
  try {
    MandiRate.aggregate = async (p) => { pipelines.push(p); return []; };
    const resFrom = createResponse();
    await getMandiAnalytics({ query: { from: '2026-11-08' } }, resFrom, (err) => { throw err; });
    assert.equal(resFrom.statusCode, 200);
    assert.ok(pipelines[0][0].$match.priceDate.$gte);
    assert.equal(pipelines[0][0].$match.priceDate.$lt, undefined);

    pipelines.length = 0;
    const resTo = createResponse();
    await getMandiAnalytics({ query: { to: '2026-11-09' } }, resTo, (err) => { throw err; });
    assert.equal(resTo.statusCode, 200);
    assert.equal(pipelines[0][0].$match.priceDate.$gte, undefined);
    assert.ok(pipelines[0][0].$match.priceDate.$lt);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('analytics forwards unexpected database errors to next()', async () => {
  const dbError = new Error('Database connection failed');
  try {
    MandiRate.aggregate = async () => { throw dbError; };
    const res = createResponse();
    let caughtError = null;
    await getMandiAnalytics({ query: {} }, res, (err) => { caughtError = err; });
    assert.equal(caughtError, dbError);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('historical trends forwards unexpected database errors to next()', async () => {
  const { getMandiPriceTrends } = require('../src/controllers/mandiController');
  const dbError = new Error('Database timeout');
  try {
    MandiRate.aggregate = async () => { throw dbError; };
    const res = createResponse();
    let caughtError = null;
    await getMandiPriceTrends({ query: {} }, res, (err) => { caughtError = err; });
    assert.equal(caughtError, dbError);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('market comparison forwards unexpected database errors to next()', async () => {
  const { getMandiMarketComparison } = require('../src/controllers/mandiController');
  const dbError = new Error('Aggregation execution error');
  try {
    MandiRate.aggregate = async () => { throw dbError; };
    const res = createResponse();
    let caughtError = null;
    await getMandiMarketComparison({ query: { commodity: 'ONION' } }, res, (err) => { caughtError = err; });
    assert.equal(caughtError, dbError);
  } finally {
    MandiRate.aggregate = originalAggregate;
  }
});

test('market comparison rejects empty or whitespace-only commodity parameter', async () => {
  const { getMandiMarketComparison } = require('../src/controllers/mandiController');
  const res = createResponse();
  await getMandiMarketComparison({ query: { commodity: '   ' } }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Invalid commodity filter/);
});

test('benchmark endpoint supports both commodity and cropName aliases', async () => {
  const { getBenchmarkForCrop } = require('../src/controllers/mandiController');
  const originalFindOne = MandiRate.findOne;
  const findOneQueries = [];
  try {
    const mockRecord = {
      commodity: 'TOMATO',
      marketCenter: 'Pune APMC',
      district: 'Pune',
      state: 'Maharashtra',
      modalPrice: 2100,
      minPrice: 1800,
      maxPrice: 2400,
      unit: 'QUINTAL',
      priceDate: new Date('2026-11-08T00:00:00.000Z')
    };

    MandiRate.findOne = (query) => {
      findOneQueries.push(query);
      return {
        sort: () => mockRecord
      };
    };

    const res1 = createResponse();
    await getBenchmarkForCrop({ query: { commodity: 'Tomato' } }, res1, (err) => { throw err; });
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.commodity, 'TOMATO');
    assert.equal(res1.body.farmerPriceGuidance.modalRatePerKg, 21);

    const res2 = createResponse();
    await getBenchmarkForCrop({ query: { cropName: 'Tomato' } }, res2, (err) => { throw err; });
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.commodity, 'TOMATO');
  } finally {
    MandiRate.findOne = originalFindOne;
  }

  // After restoring findOne, verify commodity takes precedence over cropName
  const originalFindOne2 = MandiRate.findOne;
  const precedenceQueries = [];
  try {
    const mockRecord2 = {
      commodity: 'ONION',
      marketCenter: 'Nashik APMC',
      district: 'Nashik',
      state: 'Maharashtra',
      modalPrice: 2500,
      minPrice: 2000,
      maxPrice: 2800,
      unit: 'QUINTAL',
      priceDate: new Date('2026-11-08T00:00:00.000Z')
    };

    MandiRate.findOne = (query) => {
      precedenceQueries.push(query);
      return {
        sort: () => mockRecord2
      };
    };

    const res3 = createResponse();
    await getBenchmarkForCrop(
      { query: { commodity: 'Onion', cropName: 'Tomato' } },
      res3,
      (err) => { throw err; }
    );
    assert.equal(res3.statusCode, 200);
    assert.equal(precedenceQueries[0].commodity.$regex, 'Onion');
  } finally {
    MandiRate.findOne = originalFindOne2;
  }
});

test('benchmark endpoint returns 400 when neither commodity nor cropName is provided', async () => {
  const { getBenchmarkForCrop } = require('../src/controllers/mandiController');
  const res = createResponse();
  await getBenchmarkForCrop({ query: {} }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /specify a commodity/);
});

test('benchmark geographic fallback: district -> state -> any market', async () => {
  const { getBenchmarkForCrop } = require('../src/controllers/mandiController');
  const originalFindOne = MandiRate.findOne;
  const findOneQueries = [];
  let callCount = 0;

  try {
    const mockRecord = {
      commodity: 'TOMATO',
      marketCenter: 'Bengaluru APMC',
      district: 'Bengaluru',
      state: 'Karnataka',
      modalPrice: 2000,
      minPrice: 1600,
      maxPrice: 2400,
      unit: 'QUINTAL',
      priceDate: new Date('2026-11-08T00:00:00.000Z')
    };

    MandiRate.findOne = (query) => {
      findOneQueries.push(JSON.parse(JSON.stringify(query)));
      callCount++;
      return {
        sort: () => (callCount <= 2 ? null : mockRecord)
      };
    };

    const res = createResponse();
    await getBenchmarkForCrop(
      { query: { commodity: 'Tomato', district: 'Dharwad', state: 'Karnataka' } },
      res,
      (err) => { throw err; }
    );

    assert.equal(res.statusCode, 200);
    // First query should include district + state
    assert.equal(findOneQueries[0].district, 'DHARWAD');
    assert.equal(findOneQueries[0].state, 'KARNATAKA');
    // Second query should fall back to state only
    assert.equal(findOneQueries[1].district, undefined);
    assert.equal(findOneQueries[1].state, 'KARNATAKA');
    // Third query: any market globally
    assert.equal(findOneQueries[2].district, undefined);
    assert.equal(findOneQueries[2].state, undefined);
  } finally {
    MandiRate.findOne = originalFindOne;
  }
});
