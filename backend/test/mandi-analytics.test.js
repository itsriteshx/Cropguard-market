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
