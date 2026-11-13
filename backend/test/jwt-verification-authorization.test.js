const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { getJwtSecret } = require('../src/config/jwtSecret');
const { protect, authorize } = require('../src/middleware/authMiddleware');

const mockReq = (token, url = '/api/orders') => ({
  headers: {
    authorization: token ? `Bearer ${token}` : ''
  },
  originalUrl: url,
  url
});

const mockRes = () => {
  const res = {
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
  return res;
};

test('protect: permits fully verified access token on operational routes', async () => {
  const origFindOne = User.findById;
  try {
    const verifiedUser = {
      _id: 'user_ver_1',
      role: 'FARMER',
      isVerified: true,
      syncVerificationState: () => true
    };
    User.findById = () => ({ select: async () => verifiedUser });

    const token = jwt.sign({ id: 'user_ver_1', role: 'FARMER', scope: 'access' }, getJwtSecret());
    const req = mockReq(token, '/api/listings');
    const res = mockRes();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user, verifiedUser);
  } finally {
    User.findById = origFindOne;
  }
});

test('protect: blocks restricted verification_pending token from operational routes', async () => {
  const restrictedToken = jwt.sign(
    { id: 'user_pending_1', role: 'FARMER', scope: 'verification_pending' },
    getJwtSecret()
  );
  const req = mockReq(restrictedToken, '/api/orders');
  const res = mockRes();
  let nextCalled = false;

  await protect(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.requiresVerification, true);
  assert.match(res.body.message, /verification pending/i);
});

test('protect: permits verification_pending token on /auth/me for profile inspection', async () => {
  const origFindOne = User.findById;
  try {
    const pendingUser = {
      _id: 'user_pending_1',
      role: 'FARMER',
      isVerified: false,
      syncVerificationState: () => false
    };
    User.findById = () => ({ select: async () => pendingUser });

    const restrictedToken = jwt.sign(
      { id: 'user_pending_1', role: 'FARMER', scope: 'verification_pending' },
      getJwtSecret()
    );
    const req = mockReq(restrictedToken, '/api/auth/me');
    const res = mockRes();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user, pendingUser);
  } finally {
    User.findById = origFindOne;
  }
});

test('protect: blocks unverified user from operational routes even with access-scope token', async () => {
  const origFindOne = User.findById;
  try {
    const unverifiedUser = {
      _id: 'user_unverified_1',
      role: 'FARMER',
      isVerified: false,
      phoneVerified: false,
      syncVerificationState: () => false
    };
    User.findById = () => ({ select: async () => unverifiedUser });

    const token = jwt.sign({ id: 'user_unverified_1', role: 'FARMER', scope: 'access' }, getJwtSecret());
    const req = mockReq(token, '/api/negotiations');
    const res = mockRes();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.requiresVerification, true);
  } finally {
    User.findById = origFindOne;
  }
});

test('authorize: preserves role-based permissions and blocks unauthorized roles', () => {
  const farmerReq = { user: { role: 'FARMER' } };
  const buyerReq = { user: { role: 'BUYER_RETAIL' } };

  let farmerPassed = false;
  authorize('FARMER')(farmerReq, mockRes(), () => { farmerPassed = true; });
  assert.equal(farmerPassed, true);

  const buyerRes = mockRes();
  let buyerPassed = false;
  authorize('FARMER')(buyerReq, buyerRes, () => { buyerPassed = true; });
  assert.equal(buyerPassed, false);
  assert.equal(buyerRes.statusCode, 403);
  assert.match(buyerRes.body.message, /not authorized/i);
});
