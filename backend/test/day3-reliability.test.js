const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const express = require('express');
const errorHandler = require('../src/middleware/errorHandler');
const { sanitizeData, shouldSkipApiLimiter, sanitizeMiddleware, sanitizeParams } = require('../src/middleware/securityMiddleware');
const { isValidImageBuffer, validateImageStructure, uploadProduceImages } = require('../src/controllers/uploadController');
const { getAuditLogs } = require('../src/controllers/auditController');
const AuditLog = require('../src/models/AuditLog');

// Helper to simulate Express res object
const createMockRes = (initialStatusCode = 200) => {
  return {
    statusCode: initialStatusCode,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
};

// ----------------------------------------------------
// 1. Centralized Error Handler Tests
// ----------------------------------------------------
test('errorHandler: maps Mongoose CastError to HTTP 400', () => {
  const err = new Error('Cast to ObjectId failed');
  err.name = 'CastError';
  err.path = '_id';
  err.value = 'invalid-mongo-id-123';

  const req = { method: 'GET', originalUrl: '/api/listings/invalid-id' };
  const res = createMockRes();

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Invalid format for field "_id"/);
});

test('errorHandler: maps Mongoose ValidationError to HTTP 400', () => {
  const err = new Error('Validation failed');
  err.name = 'ValidationError';
  err.errors = {
    cropName: { message: 'Crop name is required' },
    quantity: { message: 'Quantity must be greater than zero' }
  };

  const req = { method: 'POST', originalUrl: '/api/listings' };
  const res = createMockRes();

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Crop name is required/);
  assert.match(res.body.message, /Quantity must be greater than zero/);
});

test('errorHandler: maps MongoDB Duplicate Key error (E11000) to HTTP 400', () => {
  const err = new Error('E11000 duplicate key error');
  err.code = 11000;
  err.keyValue = { phone: '9876543210' };

  const req = { method: 'POST', originalUrl: '/api/auth/register' };
  const res = createMockRes();

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Duplicate value entered for phone/);
});

test('errorHandler: maps MulterError (LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, LIMIT_UNEXPECTED_FILE) to HTTP 400', () => {
  const req = { method: 'POST', originalUrl: '/api/upload' };

  // 1. File size limit
  const errSize = new Error('File too large');
  errSize.name = 'MulterError';
  errSize.code = 'LIMIT_FILE_SIZE';
  const resSize = createMockRes();
  errorHandler(errSize, req, resSize, () => {});
  assert.equal(resSize.statusCode, 400);
  assert.match(resSize.body.message, /exceeds maximum allowable limit of 5MB/);

  // 2. File count limit
  const errCount = new Error('Too many files');
  errCount.name = 'MulterError';
  errCount.code = 'LIMIT_FILE_COUNT';
  const resCount = createMockRes();
  errorHandler(errCount, req, resCount, () => {});
  assert.equal(resCount.statusCode, 400);
  assert.match(resCount.body.message, /Maximum allowed is 5 photos/);

  // 3. Unexpected field
  const errField = new Error('Unexpected field');
  errField.name = 'MulterError';
  errField.code = 'LIMIT_UNEXPECTED_FILE';
  errField.field = 'maliciousField';
  const resField = createMockRes();
  errorHandler(errField, req, resField, () => {});
  assert.equal(resField.statusCode, 400);
  assert.match(resField.body.message, /Unexpected upload field "maliciousField"/);
});

test('errorHandler: maps malformed JSON body SyntaxError to HTTP 400', () => {
  const err = new SyntaxError('Unexpected token in JSON at position 12');
  err.status = 400;
  err.body = '{ malformed: json';

  const req = { method: 'POST', originalUrl: '/api/orders' };
  const res = createMockRes();

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Malformed JSON payload in request body');
});

test('errorHandler: maps entity.too.large payload error to HTTP 413', () => {
  const err = new Error('request entity too large');
  err.type = 'entity.too.large';

  const req = { method: 'POST', originalUrl: '/api/orders' };
  const res = createMockRes();

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Request payload exceeds allowable size limit');
});

test('errorHandler: sanitizes unexpected 500 errors in production', () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    const err = new Error('Sensitive MongoDB Atlas connection string leak: mongodb+srv://admin:pass@cluster.mongodb.net');
    const req = { method: 'GET', originalUrl: '/api/sensitive' };
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Internal Server Error');
    assert.equal(res.body.stack, null);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// ----------------------------------------------------
// 2. Security Middleware & Sanitization Tests
// ----------------------------------------------------
test('sanitizeData: removes NoSQL injection operators ($) and dotted keys (.) recursively', () => {
  const payload = {
    username: 'farmer_ramesh',
    $where: 'sleep(5000)',
    nested: {
      'invalid.dot.key': true,
      safeKey: 'valid',
      $gt: 10
    },
    list: [
      { $ne: null, validItem: 'corn' },
      { 'sub.key': 'evil' }
    ]
  };

  sanitizeData(payload);

  assert.equal(payload.username, 'farmer_ramesh');
  assert.equal(payload.$where, undefined);
  assert.equal(payload.nested['invalid.dot.key'], undefined);
  assert.equal(payload.nested.$gt, undefined);
  assert.equal(payload.nested.safeKey, 'valid');
  assert.equal(payload.list[0].$ne, undefined);
  assert.equal(payload.list[0].validItem, 'corn');
  assert.equal(payload.list[1]['sub.key'], undefined);
});

test('sanitizeData: blocks prototype pollution keys (__proto__, constructor, prototype)', () => {
  const payload = JSON.parse('{"__proto__": {"admin": true}, "constructor": "bad", "name": "Crop"}');

  sanitizeData(payload);

  assert.equal(payload.__proto__.admin, undefined);
  assert.equal(payload.constructor, Object);
  assert.equal(payload.name, 'Crop');
});

test('sanitizeData: preserves Date, Buffer, and RegExp instances without modification', () => {
  const testDate = new Date('2026-11-12T00:00:00.000Z');
  const testBuffer = Buffer.from('cropguard-image-buffer');
  const testRegex = /^[a-z]+$/i;

  const payload = {
    date: testDate,
    buffer: testBuffer,
    regex: testRegex,
    $bad: 'remove'
  };

  sanitizeData(payload);

  assert.equal(payload.$bad, undefined);
  assert.equal(payload.date.toISOString(), '2026-11-12T00:00:00.000Z');
  assert.equal(Buffer.isBuffer(payload.buffer), true);
  assert.equal(payload.buffer.toString(), 'cropguard-image-buffer');
  assert.equal(payload.regex.test('crop'), true);
});

test('shouldSkipApiLimiter: skips /api/auth endpoints so auth routes have dedicated rate limits', () => {
  assert.equal(typeof shouldSkipApiLimiter, 'function');

  assert.equal(shouldSkipApiLimiter({ originalUrl: '/api/auth/login' }), true);
  assert.equal(shouldSkipApiLimiter({ originalUrl: '/api/auth/register' }), true);
  assert.equal(shouldSkipApiLimiter({ originalUrl: '/api/listings' }), false);
  assert.equal(shouldSkipApiLimiter({ originalUrl: '/api/orders' }), false);
});

test('Express 4 query sanitization integration: preserves valid params and prevents malicious keys from reappearing', (t, done) => {
  const app = express();
  app.use(sanitizeMiddleware);

  let firstRead;
  let secondRead;

  app.get('/api/test-query', (req, res) => {
    // Controller reads req.query multiple times
    firstRead = req.query;
    secondRead = req.query;

    res.json({
      equal: firstRead === secondRead,
      crop: req.query.crop,
      page: req.query.page,
      limit: req.query.limit,
      allKeys: Object.keys(req.query),
      hasWhere: '$where' in req.query,
      hasDotted: 'user.role' in req.query
    });
  });

  const socket = new PassThrough();
  const req = new http.IncomingMessage(socket);
  req.url = '/api/test-query?crop=Wheat&page=2&limit=10&$where=sleep(5000)&user.role=ADMIN&nested[$gt]=50';
  req.method = 'GET';

  const res = new http.ServerResponse(req);
  res.assignSocket(socket);

  let rawData = '';
  res.write = (chunk) => { rawData += chunk; return true; };
  res.end = (chunk) => {
    if (chunk) rawData += chunk;
    const body = JSON.parse(rawData);

    assert.equal(body.equal, true);
    assert.equal(body.crop, 'Wheat');
    assert.equal(body.page, '2');
    assert.equal(body.limit, '10');
    assert.equal(body.hasWhere, false);
    assert.equal(body.hasDotted, false);
    assert.equal(body.allKeys.includes('$where'), false);
    assert.equal(body.allKeys.includes('user.role'), false);
    assert.equal(firstRead.$where, undefined);
    assert.equal(secondRead.$where, undefined);

    done();
  };

  app.handle(req, res);
});

test('sanitizeParams: route-level parameter sanitizer strips NoSQL and dotted keys when populated', () => {
  const req = {
    params: {
      id: 'valid-id-123',
      $where: 'evil',
      'sub.param': 'malicious'
    }
  };

  sanitizeParams(req, {}, () => {});

  assert.equal(req.params.id, 'valid-id-123');
  assert.equal(req.params.$where, undefined);
  assert.equal(req.params['sub.param'], undefined);
});

test('sanitizeParams route integration: middleware executes on matched route and preserves valid ObjectId', (t, done) => {
  const ProduceListing = require('../src/models/ProduceListing');
  const listingRoutes = require('../src/routes/listingRoutes');

  // Verify listingRoutes router stack has sanitizeParams mounted on /:id
  const stackLayer = listingRoutes.stack.find(
    (l) => l.handle === sanitizeParams
  );
  assert.ok(stackLayer, 'sanitizeParams must be mounted in listingRoutes stack');

  const originalFindById = ProduceListing.findById;
  let receivedId = null;

  ProduceListing.findById = (id) => {
    receivedId = id;
    return {
      populate: () => Promise.resolve({
        _id: id,
        cropName: 'Organic Wheat',
        pricePerUnit: 2500,
        quantity: 100
      })
    };
  };

  const app = express();
  app.use('/api/listings', listingRoutes);

  const socket = new PassThrough();
  const req = new http.IncomingMessage(socket);
  req.url = '/api/listings/65e9b8f2c3d4e5f6a7b8c9d0';
  req.method = 'GET';

  const res = new http.ServerResponse(req);
  res.assignSocket(socket);

  let raw = '';
  res.write = (chunk) => { raw += chunk; return true; };
  res.end = (chunk) => {
    if (chunk) raw += chunk;
    const data = JSON.parse(raw);

    assert.equal(data.success, true);
    assert.equal(receivedId, '65e9b8f2c3d4e5f6a7b8c9d0', 'Controller must receive sanitized ObjectId');
    assert.equal(data.listing.cropName, 'Organic Wheat');

    ProduceListing.findById = originalFindById;
    done();
  };

  app.handle(req, res);
});

// ----------------------------------------------------
// 3. File Upload Security & Deep Structural Validation Tests
// ----------------------------------------------------
test('validateImageStructure: validates genuine JPEG and rejects truncated/malformed JPEGs', () => {
  // Genuine JPEG: SOI, APP0 JFIF, and EOI
  const validJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xd9
  ]);
  const validRes = validateImageStructure(validJpeg);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.format, 'JPEG');
  assert.equal(isValidImageBuffer(validJpeg), true);

  // Truncated JPEG (missing EOI 0xFF, 0xD9)
  const truncatedJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00
  ]);
  const truncRes = validateImageStructure(truncatedJpeg);
  assert.equal(truncRes.valid, false);
  assert.match(truncRes.reason, /missing End-of-Image \(EOI\) marker/);
  assert.equal(isValidImageBuffer(truncatedJpeg), false);

  // Malformed JPEG (segment length exceeds buffer)
  const overflowJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, // declared 65535 byte segment
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9
  ]);
  const overflowRes = validateImageStructure(overflowJpeg);
  assert.equal(overflowRes.valid, false);
  assert.match(overflowRes.reason, /segment length exceeds buffer boundaries/);
});

test('validateImageStructure: validates genuine PNG and rejects truncated/malformed PNGs', () => {
  // Genuine PNG with 8-byte signature, IHDR chunk, and IEND chunk
  const validPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]), // length 13
    Buffer.from('IHDR'),
    Buffer.alloc(13),                      // IHDR data
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // crc
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // length 0
    Buffer.from('IEND'),
    Buffer.from([0xae, 0x42, 0x60, 0x82])  // crc
  ]);
  const validRes = validateImageStructure(validPng);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.format, 'PNG');

  // Truncated PNG (missing IEND)
  const truncatedPng = validPng.subarray(0, 30);
  const truncRes = validateImageStructure(truncatedPng);
  assert.equal(truncRes.valid, false);
  assert.match(truncRes.reason, /missing IEND termination chunk|truncated PNG chunk/);

  // Malformed PNG (first chunk not IHDR)
  const badFirstChunkPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x04]),
    Buffer.from('tEXt'),
    Buffer.from('evil'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('IEND'),
    Buffer.from([0xae, 0x42, 0x60, 0x82])
  ]);
  const badRes = validateImageStructure(badFirstChunkPng);
  assert.equal(badRes.valid, false);
  assert.match(badRes.reason, /first chunk must be IHDR/);
});

test('validateImageStructure: validates genuine WebP and rejects truncated/malformed WebPs', () => {
  // Genuine WebP with RIFF, size, WEBP, and VP8 chunk (total 30 bytes, RIFF size 22)
  const payload = Buffer.alloc(10);
  const validWebp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([22, 0x00, 0x00, 0x00]),      // 22 bytes LE
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
    Buffer.from([10, 0x00, 0x00, 0x00]),      // 10 bytes LE
    payload
  ]);
  const validRes = validateImageStructure(validWebp);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.format, 'WEBP');

  // Truncated WebP: declared RIFF size 1000 bytes, buffer only 20 bytes
  const truncatedWebp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0xe8, 0x03, 0x00, 0x00]), // 1000 bytes LE
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
    Buffer.from([10, 0x00, 0x00, 0x00])
  ]);
  const truncRes = validateImageStructure(truncatedWebp);
  assert.equal(truncRes.valid, false);
  assert.match(truncRes.reason, /declared RIFF size/);

  // Malformed WebP: unrecognized chunk
  const badChunkWebp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([22, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('EVIL'),
    Buffer.from([10, 0x00, 0x00, 0x00]),
    payload
  ]);
  const badRes = validateImageStructure(badChunkWebp);
  assert.equal(badRes.valid, false);
  assert.match(badRes.reason, /Invalid or unrecognized WebP chunk type/);
});

test('uploadProduceImages: rejects request with no files', async () => {
  const req = { files: [] };
  const res = createMockRes();

  await uploadProduceImages(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /provide at least one image file/);
});

test('uploadProduceImages: rejects truncated image content and ensures storage is not invoked', async () => {
  const truncatedJpegFile = {
    originalname: 'corrupt-crop.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01
    ]) // 16 bytes, missing EOI (FF D9)
  };

  const req = { files: [truncatedJpegFile] };
  const res = createMockRes();

  await uploadProduceImages(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /missing End-of-Image \(EOI\) marker/);
});

// ----------------------------------------------------
// 4. Audit Controller PII & IP Address Privacy Tests
// ----------------------------------------------------
test('getAuditLogs: excludes ipAddress and sensitive actor phone from public audit response', async () => {
  const originalCount = AuditLog.countDocuments;
  const originalFind = AuditLog.find;

  let selectedFields = '';
  let populatedFields = '';

  try {
    AuditLog.countDocuments = async () => 1;
    AuditLog.find = () => ({
      select(fields) {
        selectedFields = fields;
        return this;
      },
      populate(field, projection) {
        if (field === 'actor') {
          populatedFields = projection;
        }
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return [{
          _id: 'audit-log-1',
          action: 'ORDER_PLACED',
          title: 'Direct procurement contract executed',
          actor: {
            name: 'Ramesh Patil',
            role: 'FARMER',
            location: { district: 'Dharwad', state: 'Karnataka' }
          },
          financialSnapshot: {
            dealAmount: 50000,
            middlemanFeeSaved: 5000
          },
          complianceAuthority: 'UASD APMC Cell',
          isVerified: true
        }];
      }
    });

    const req = { query: {} };
    const res = createMockRes();

    await getAuditLogs(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.logs.length, 1);

    // Verify ipAddress is explicitly excluded from database query
    assert.equal(selectedFields, '-ipAddress');

    // Verify actor projection excludes phone
    assert.equal(populatedFields, 'name role location');
    assert.equal(populatedFields.includes('phone'), false);

    // Verify response payload contract preserves all ComplianceAuditPage fields
    const log = res.body.logs[0];
    assert.equal(log.ipAddress, undefined, 'ipAddress must not be present in public audit response');
    assert.equal(log.actor.phone, undefined, 'phone must not be present in public audit actor object');
    assert.equal(log.action, 'ORDER_PLACED');
    assert.equal(log.financialSnapshot.dealAmount, 50000);
    assert.equal(log.isVerified, true);
  } finally {
    AuditLog.countDocuments = originalCount;
    AuditLog.find = originalFind;
  }
});
