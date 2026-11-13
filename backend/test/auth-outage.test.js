const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { getJwtSecret } = require('../src/config/jwtSecret');
const { protect } = require('../src/middleware/authMiddleware');

test('database failures during authentication are passed to the error handler, not returned as 401', async () => {
  const original = User.findById;
  const dbError = new Error('database unavailable');
  try {
    User.findById = () => ({ select: async () => { throw dbError; } });
    const token = jwt.sign({ id: 'buyer' }, getJwtSecret());
    let forwarded, status;
    await protect({ headers: { authorization: `Bearer ${token}` } }, { status(s) { status = s; return this; }, json() {} }, (error) => { forwarded = error; });
    assert.equal(forwarded, dbError);
    assert.equal(status, undefined);
  } finally { User.findById = original; }
});

test('invalid and missing tokens remain unauthorized', async () => {
  for (const authorization of ['', 'Bearer invalid']) {
    let status;
    await protect({ headers: { authorization } }, { status(s) { status = s; return this; }, json() {} }, () => { throw new Error('must not reach route'); });
    assert.equal(status, 401);
  }
});
