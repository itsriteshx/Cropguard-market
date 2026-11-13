const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fork } = require('node:child_process');
const mongoose = require('mongoose');

// If executed as a child worker process in cross-process concurrency tests:
if (process.env.IS_LOCK_WORKER === '1') {
  (async () => {
    try {
      const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cropguard_test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });

      const emailService = require('../src/services/email/emailService');
      const smsService = require('../src/services/sms/smsService');

      let result;
      const action = process.env.WORKER_ACTION;
      const target = process.env.WORKER_TARGET;

      if (action === 'EMAIL') {
        result = await emailService.sendEmailOtp({ email: target });
      } else if (action === 'PHONE') {
        result = await smsService.sendPhoneOtp({ phone: target });
      }

      if (process.send) {
        process.send({ success: true, result });
      }
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      if (process.send) {
        process.send({ success: false, error: err.message });
      }
      process.exit(1);
    }
  })();
  return;
}

const {
  acquireDistributedLock,
  renewDistributedLock,
  releaseDistributedLock,
  withResendLock,
  DistributedLock
} = require('../src/utils/resendLock');
const emailService = require('../src/services/email/emailService');
const smsService = require('../src/services/sms/smsService');
const VerificationOtp = require('../src/models/VerificationOtp');

describe('Distributed OTP Resend Lock (M7.1 Final Fix)', () => {
  // 1. Lease expiry: lock held with expired lease is acquired atomically
  test('acquireDistributedLock: atomically takes over an expired lease', async () => {
    const lockKey = 'test:lock:expired_lease';
    const oldToken = 'old_expired_token';
    const newToken = 'new_winner_token';

    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    let findOneAndUpdateFilter = null;
    let findOneAndUpdateUpdate = null;

    try {
      DistributedLock.findOneAndUpdate = async (filter, update) => {
        findOneAndUpdateFilter = filter;
        findOneAndUpdateUpdate = update;
        return {
          _id: lockKey,
          token: update.$set.token,
          expiresAt: update.$set.expiresAt
        };
      };

      const acquired = await acquireDistributedLock(lockKey, newToken, { leaseMs: 4000 });
      assert.equal(acquired, true, 'Must acquire lock when lease is expired');
      assert.equal(findOneAndUpdateFilter._id, lockKey);
      assert.ok(findOneAndUpdateFilter.expiresAt.$lte instanceof Date, 'Filter must require expiresAt <= now');
      assert.equal(findOneAndUpdateUpdate.$set.token, newToken);
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  // 2. Ownership-safe release: only deletes lock matching both _id and ownership token
  test('releaseDistributedLock: ownership-safe release only deletes when token matches', async () => {
    const lockKey = 'test:lock:ownership_release';
    const correctToken = 'token_owner_valid';
    const wrongToken = 'token_imposter';

    const origDeleteOne = DistributedLock.deleteOne;
    let deleteFilter = null;

    try {
      DistributedLock.deleteOne = async (filter) => {
        deleteFilter = filter;
        return { deletedCount: filter.token === correctToken ? 1 : 0 };
      };

      // Release attempt with wrong token
      await releaseDistributedLock(lockKey, wrongToken);
      assert.equal(deleteFilter._id, lockKey);
      assert.equal(deleteFilter.token, wrongToken);

      // Release attempt with correct token
      await releaseDistributedLock(lockKey, correctToken);
      assert.equal(deleteFilter._id, lockKey);
      assert.equal(deleteFilter.token, correctToken);
    } finally {
      DistributedLock.deleteOne = origDeleteOne;
    }
  });

  // 3. Database failure: fail-closed on acquisition error
  test('acquireDistributedLock: database failure fails closed and rethrows error', async () => {
    const lockKey = 'test:lock:db_failure';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;

    try {
      DistributedLock.findOneAndUpdate = async () => {
        throw new Error('MongoNetworkError: connection lost');
      };

      await assert.rejects(
        async () => {
          await acquireDistributedLock(lockKey, 'token_db_fail');
        },
        /MongoNetworkError: connection lost/
      );
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  // 4. Bounded acquisition timeout: fails closed when lock cannot be acquired within timeout
  test('acquireDistributedLock: bounded timeout fails closed when lock held by another process', async () => {
    const lockKey = 'test:lock:timeout';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;

    try {
      // Lease not expired
      DistributedLock.findOneAndUpdate = async () => null;
      // Key collision (held by another process)
      DistributedLock.create = async () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      };

      const start = Date.now();
      const acquired = await acquireDistributedLock(lockKey, 'token_timeout_test', {
        timeoutMs: 150,
        retryIntervalMs: 25
      });
      const duration = Date.now() - start;

      assert.equal(acquired, false, 'Must return false after bounded timeout without acquiring lock');
      assert.ok(duration >= 140, `Must respect bounded timeout (elapsed: ${duration}ms)`);
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
    }
  });

  // 5. withResendLock: fail-closed on timeout throws explicit error and does not execute critical section
  test('withResendLock: throws error and aborts action if lock cannot be acquired', async () => {
    const lockKey = 'TARGET:user_fail_closed';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;
    let criticalSectionExecuted = false;

    try {
      DistributedLock.findOneAndUpdate = async () => null;
      DistributedLock.create = async () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      };

      await assert.rejects(
        async () => {
          await withResendLock(
            lockKey,
            async () => {
              criticalSectionExecuted = true;
            },
            { timeoutMs: 100, retryIntervalMs: 20 }
          );
        },
        /Failed to acquire distributed OTP resend lock.*failing closed/
      );

      assert.equal(criticalSectionExecuted, false, 'Critical section must never execute if lock was not acquired');
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
    }
  });

  // 6. Critical section boundary: lock is released BEFORE adapter delivery
  test('sendEmailOtp: lock is released before adapter delivery, and delivery failure invalidates OTP', async () => {
    const email = 'lock.boundary@uasd.agri.in';
    const origFindOne = VerificationOtp.findOne;
    const origCreate = VerificationOtp.create;
    const origUpdateOne = VerificationOtp.updateOne;
    const origUpdateMany = VerificationOtp.updateMany;

    let otpDoc = null;
    let lockReleasedBeforeSend = false;

    // We track release inside a mock DistributedLock.deleteOne
    const origDeleteOne = DistributedLock.deleteOne;
    try {
      VerificationOtp.findOne = () => ({ sort: () => null });
      VerificationOtp.updateMany = async () => ({ modifiedCount: 0 });
      VerificationOtp.create = async (payload) => {
        otpDoc = { _id: 'otp_boundary_test_id', ...payload };
        return otpDoc;
      };
      VerificationOtp.updateOne = async (filter, update) => {
        if (otpDoc && otpDoc._id === filter._id) {
          otpDoc.consumedAt = update.$set.consumedAt;
        }
        return { modifiedCount: 1 };
      };

      DistributedLock.deleteOne = async () => {
        lockReleasedBeforeSend = true;
        return { deletedCount: 1 };
      };

      const failingAdapter = {
        send: async () => {
          // Verify that lock was released before adapter send is invoked!
          assert.equal(lockReleasedBeforeSend, true, 'Distributed lock must be released before sending via adapter');
          throw new Error('SMTP network timeout');
        }
      };

      const result = await emailService.sendEmailOtp({ email, adapter: failingAdapter });
      assert.equal(result.success, false);
      assert.equal(result.deliveryFailed, true);
      assert.ok(otpDoc.consumedAt instanceof Date, 'OTP must be marked consumed upon delivery failure');
    } finally {
      VerificationOtp.findOne = origFindOne;
      VerificationOtp.create = origCreate;
      VerificationOtp.updateOne = origUpdateOne;
      VerificationOtp.updateMany = origUpdateMany;
      DistributedLock.deleteOne = origDeleteOne;
    }
  });

  // 7. Different targets independence: different target locks do not interfere
  test('different targets acquire independent locks without contention', async () => {
    const key1 = 'TARGET:user_alpha';
    const key2 = 'TARGET:user_beta';

    let key1Executed = false;
    let key2Executed = false;

    await Promise.all([
      withResendLock(key1, async () => {
        key1Executed = true;
      }),
      withResendLock(key2, async () => {
        key2Executed = true;
      })
    ]);

    assert.equal(key1Executed, true);
    assert.equal(key2Executed, true);
  });

  // 8. Lease renewal: atomically renews lease with matching ownership token
  test('renewDistributedLock: extends expiresAt with matching ownership token', async () => {
    const lockKey = 'test:lock:renewal_valid';
    const token = 'token_valid_renewal_123';
    let capturedFilter = null;
    let capturedUpdate = null;

    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    try {
      DistributedLock.findOneAndUpdate = async (filter, update) => {
        capturedFilter = filter;
        capturedUpdate = update;
        return {
          _id: filter._id,
          token: filter.token,
          expiresAt: update.$set.expiresAt
        };
      };

      const renewed = await renewDistributedLock(lockKey, token, 6000);
      assert.equal(renewed, true, 'Must return true on successful renewal');
      assert.equal(capturedFilter._id, lockKey);
      assert.equal(capturedFilter.token, token);
      assert.ok(capturedUpdate.$set.expiresAt instanceof Date, 'Must set new expiresAt Date');
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  // 9. Ownership mismatch during lease renewal: rejects and returns false
  test('renewDistributedLock: returns false when ownership token does not match', async () => {
    const lockKey = 'test:lock:renewal_mismatch';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    try {
      DistributedLock.findOneAndUpdate = async (filter) => {
        // Simulating MongoDB document matching: token does not match persisted owner
        if (filter.token !== 'persisted_owner_token') {
          return null;
        }
        return { _id: filter._id };
      };

      const renewed = await renewDistributedLock(lockKey, 'wrong_token', 5000);
      assert.equal(renewed, false, 'Renewal must fail when ownership token mismatches');
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  // 10. Ownership mismatch during release: does not delete lock held by another token
  test('releaseDistributedLock: does not delete lock if ownership token does not match', async () => {
    const lockKey = 'test:lock:release_mismatch';
    const origDeleteOne = DistributedLock.deleteOne;
    try {
      DistributedLock.deleteOne = async (filter) => {
        if (filter.token === 'token_legit') {
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      };

      const res = await releaseDistributedLock(lockKey, 'token_adversary');
      assert.equal(res.deletedCount, 0, 'Must not delete lock document when ownership token differs');
    } finally {
      DistributedLock.deleteOne = origDeleteOne;
    }
  });

  // 11. Release failure: reports cleanup failures safely without exposing OTP targets or secrets
  test('releaseDistributedLock: logs error without exposing secrets and throws on database error', async () => {
    const lockKey = 'lock:PHONE:9876543210';
    const origDeleteOne = DistributedLock.deleteOne;
    const origError = console.error;
    const loggedErrors = [];

    try {
      DistributedLock.deleteOne = async () => {
        throw new Error('MongoServerSelectionError: cluster unavailable');
      };
      console.error = (msg) => {
        loggedErrors.push(String(msg));
      };

      await assert.rejects(
        async () => {
          await releaseDistributedLock(lockKey, 'secret_token_123');
        },
        /MongoServerSelectionError/
      );

      assert.equal(loggedErrors.length, 1);
      assert.match(loggedErrors[0], /\[DistributedLock\] Failed to release lock safely:/);
      assert.doesNotMatch(loggedErrors[0], /9876543210/, 'Safe error logging must not leak phone number');
      assert.doesNotMatch(loggedErrors[0], /secret_token_123/, 'Safe error logging must not leak ownership token');
    } finally {
      DistributedLock.deleteOne = origDeleteOne;
      console.error = origError;
    }
  });

  // 12. Safe renewal during critical section prevents premature expiration
  test('withResendLock: heartbeat renews lease during active critical section', async () => {
    const key = 'user_heartbeat_renewal';
    let renewals = 0;

    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origFindOne = DistributedLock.findOne;

    try {
      DistributedLock.findOneAndUpdate = async (filter, update) => {
        if (update && update.$set && update.$set.expiresAt && filter.token) {
          renewals++;
          return { _id: filter._id, token: filter.token, expiresAt: update.$set.expiresAt };
        }
        return null;
      };
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 1 });
      DistributedLock.findOne = async (filter) => ({
        _id: filter._id,
        token: filter.token,
        expiresAt: new Date(Date.now() + 10000)
      });

      await withResendLock(
        key,
        async () => {
          // Wait slightly to allow heartbeat renewal to fire
          await new Promise((resolve) => setTimeout(resolve, 80));
        },
        { leaseMs: 100, renewalIntervalMs: 30 }
      );

      assert.ok(renewals >= 1, `Heartbeat must execute lease renewal (renewals count: ${renewals})`);
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origFindOne;
    }
  });

  // 13. Disconnected unit-test fallback isolated to tests; fails closed in production
  test('withResendLock: refuses in-memory fallback in production when database is disconnected', async () => {
    const key = 'user_prod_fallback';
    const prevEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      // Mongoose is disconnected in unit tests
      await assert.rejects(
        async () => {
          await withResendLock(key, async () => 'should_not_run');
        },
        /Database connection unavailable; refusing to use in-memory lock in production environment/
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 14. renewDistributedLock: database failure rethrows error and does not swallow failure
  test('renewDistributedLock: database failure rethrows error and logs safely', async () => {
    const lockKey = 'test:lock:renewal_db_err';
    const token = 'token_renewal_err';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origError = console.error;
    const logged = [];

    try {
      DistributedLock.findOneAndUpdate = async () => {
        throw new Error('MongoNetworkTimeoutException');
      };
      console.error = (msg) => logged.push(String(msg));

      await assert.rejects(
        async () => {
          await renewDistributedLock(lockKey, token, 5000);
        },
        /MongoNetworkTimeoutException/
      );

      assert.equal(logged.length, 1);
      assert.match(logged[0], /Database failure during lock renewal/);
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      console.error = origError;
    }
  });

  // 15. withResendLock: aborts and throws explicit error when renewal returns false during active operation
  test('withResendLock: aborts active operation when renewal returns false (ownership lost)', async () => {
    const key = 'user_lock_lost_mismatch';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origFindOne = DistributedLock.findOne;

    let operationCompleted = false;

    try {
      // First findOneAndUpdate for takeover (returns null so create is used)
      // Renewal findOneAndUpdate (with filter.token) returns null to simulate lost ownership
      DistributedLock.findOneAndUpdate = async (filter, update) => {
        if (filter.token) {
          // Renewal attempt: lock lost!
          return null;
        }
        return null;
      };
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 0 });
      DistributedLock.findOne = async () => null;

      await assert.rejects(
        async () => {
          await withResendLock(
            key,
            async () => {
              // Operation takes longer than renewal interval
              await new Promise((resolve) => setTimeout(resolve, 100));
              operationCompleted = true;
            },
            { leaseMs: 100, renewalIntervalMs: 25 }
          );
        },
        /Distributed lock lost: ownership token mismatch or lease expired/
      );

      assert.equal(operationCompleted, false, 'Operation must not complete after lock loss');
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origFindOne;
    }
  });

  // 16. withResendLock: aborts and throws explicit error when renewal encounters database failure
  test('withResendLock: aborts active operation when renewal encounters database failure', async () => {
    const key = 'user_lock_lost_db_err';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origFindOne = DistributedLock.findOne;

    let operationCompleted = false;

    try {
      DistributedLock.findOneAndUpdate = async (filter) => {
        if (filter.token) {
          throw new Error('MongoServerSelectionError: topology destroyed');
        }
        return null;
      };
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 0 });
      DistributedLock.findOne = async () => null;

      await assert.rejects(
        async () => {
          await withResendLock(
            key,
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 100));
              operationCompleted = true;
            },
            { leaseMs: 100, renewalIntervalMs: 25 }
          );
        },
        /Distributed lock lost due to renewal database error/
      );

      assert.equal(operationCompleted, false, 'Operation must not complete after database failure in renewal');
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origFindOne;
    }
  });

  // 17. withResendLock: fails closed when lock verification fails before completion
  test('withResendLock: fails closed when lock verification fails before critical section completion', async () => {
    const key = 'user_lock_stolen_before_finish';
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origFindOne = DistributedLock.findOne;

    try {
      DistributedLock.findOneAndUpdate = async () => null;
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 0 });
      // Final verification returns null (e.g. lease expired or another token took over)
      DistributedLock.findOne = async () => null;

      await assert.rejects(
        async () => {
          await withResendLock(
            key,
            async () => 'some_result',
            { renewalIntervalMs: 0 } // no background renewal
          );
        },
        /Distributed lock validation failed for .* lock was lost or expired before critical section completion/
      );
    } finally {
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origFindOne;
    }
  });

  // 18. sendEmailOtp & sendPhoneOtp: prevents any subsequent OTP writes after lock loss
  test('sendEmailOtp: prevents subsequent OTP writes (updateMany and create) after lock loss', async () => {
    const email = 'lockloss.nowrites@uasd.agri.in';
    let updateManyCalled = false;
    let createCalled = false;

    const origFindOne = VerificationOtp.findOne;
    const origUpdateMany = VerificationOtp.updateMany;
    const origCreate = VerificationOtp.create;
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origLockCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origLockFindOne = DistributedLock.findOne;

    try {
      // Setup DistributedLock so renewal fails immediately on first renewal tick
      DistributedLock.findOneAndUpdate = async (filter) => {
        if (filter.token) {
          // Renewal fails: ownership lost!
          return null;
        }
        return null;
      };
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 0 });
      DistributedLock.findOne = async () => null;

      // VerificationOtp.findOne waits for renewal tick to fail lock
      VerificationOtp.findOne = () => ({
        sort: async () => {
          // Pause long enough for renewal to fail and mark lock as lost
          await new Promise((resolve) => setTimeout(resolve, 60));
          return {
            target: email,
            type: 'EMAIL',
            consumedAt: null,
            expiresAt: new Date(Date.now() + 60000),
            resendAvailableAt: new Date(Date.now() - 1000)
          };
        }
      });

      VerificationOtp.updateMany = async () => {
        updateManyCalled = true;
        return { modifiedCount: 1 };
      };

      VerificationOtp.create = async () => {
        createCalled = true;
        return { _id: 'should_not_exist' };
      };

      await assert.rejects(
        async () => {
          await emailService.sendEmailOtp({
            email,
            lockOptions: {
              renewalIntervalMs: 20,
              leaseMs: 80
            }
          });
        },
        /Distributed lock lost/
      );

      assert.equal(updateManyCalled, false, 'No updateMany write must execute after lock loss');
      assert.equal(createCalled, false, 'No create write must execute after lock loss');
    } finally {
      VerificationOtp.findOne = origFindOne;
      VerificationOtp.updateMany = origUpdateMany;
      VerificationOtp.create = origCreate;
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origLockCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origLockFindOne;
    }
  });

  // 19. sendPhoneOtp: prevents any subsequent OTP writes after lock loss
  test('sendPhoneOtp: prevents subsequent OTP writes (updateMany and create) after lock loss', async () => {
    const phone = '9876543299';
    let updateManyCalled = false;
    let createCalled = false;

    const origFindOne = VerificationOtp.findOne;
    const origUpdateMany = VerificationOtp.updateMany;
    const origCreate = VerificationOtp.create;
    const origFindOneAndUpdate = DistributedLock.findOneAndUpdate;
    const origLockCreate = DistributedLock.create;
    const origDeleteOne = DistributedLock.deleteOne;
    const origLockFindOne = DistributedLock.findOne;

    try {
      DistributedLock.findOneAndUpdate = async (filter) => {
        if (filter.token) {
          // Renewal fails: ownership lost!
          return null;
        }
        return null;
      };
      DistributedLock.create = async (doc) => doc;
      DistributedLock.deleteOne = async () => ({ deletedCount: 0 });
      DistributedLock.findOne = async () => null;

      VerificationOtp.findOne = () => ({
        sort: async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
          return {
            target: phone,
            type: 'PHONE',
            consumedAt: null,
            expiresAt: new Date(Date.now() + 60000),
            resendAvailableAt: new Date(Date.now() - 1000)
          };
        }
      });

      VerificationOtp.updateMany = async () => {
        updateManyCalled = true;
        return { modifiedCount: 1 };
      };

      VerificationOtp.create = async () => {
        createCalled = true;
        return { _id: 'should_not_exist' };
      };

      await assert.rejects(
        async () => {
          await smsService.sendPhoneOtp({
            phone,
            lockOptions: {
              renewalIntervalMs: 20,
              leaseMs: 80
            }
          });
        },
        /Distributed lock lost/
      );

      assert.equal(updateManyCalled, false, 'No updateMany write must execute after lock loss');
      assert.equal(createCalled, false, 'No create write must execute after lock loss');
    } finally {
      VerificationOtp.findOne = origFindOne;
      VerificationOtp.updateMany = origUpdateMany;
      VerificationOtp.create = origCreate;
      DistributedLock.findOneAndUpdate = origFindOneAndUpdate;
      DistributedLock.create = origLockCreate;
      DistributedLock.deleteOne = origDeleteOne;
      DistributedLock.findOne = origLockFindOne;
    }
  });
});

// Live cross-process test suite sharing MongoDB (when MongoDB is reachable)
describe('Cross-Process Distributed Lock Integration with MongoDB', () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cropguard_test';
  let mongoConnected = false;

  before(async () => {
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 });
      mongoConnected = true;
      // Clean up previous test locks and test OTPs
      await DistributedLock.deleteMany({ _id: { $regex: /^lock:(EMAIL|PHONE):crossproc_/ } });
      await VerificationOtp.deleteMany({ target: { $regex: /^crossproc_/ } });
    } catch (_) {
      mongoConnected = false;
    }
  });

  after(async () => {
    if (mongoConnected) {
      await DistributedLock.deleteMany({ _id: { $regex: /^lock:(EMAIL|PHONE):crossproc_/ } });
      await VerificationOtp.deleteMany({ target: { $regex: /^crossproc_/ } });
      await mongoose.disconnect();
    }
  });

  function runChildWorker({ action, target }) {
    return new Promise((resolve) => {
      const child = fork(__filename, [], {
        env: {
          ...process.env,
          IS_LOCK_WORKER: '1',
          MONGO_URI,
          WORKER_ACTION: action,
          WORKER_TARGET: target,
          NODE_ENV: 'test'
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      });

      let response = null;
      child.on('message', (msg) => {
        response = msg;
      });

      child.on('close', (code) => {
        resolve({ code, response });
      });

      child.on('error', (err) => {
        resolve({ code: 1, response: { success: false, error: err.message } });
      });
    });
  }

  test('cross-process email resend concurrency across independent worker processes', async (t) => {
    if (!mongoConnected) {
      t.skip('MongoDB not reachable in current execution environment; skipping live multi-process test');
      return;
    }

    const testEmail = `crossproc_email_${Date.now()}@uasd.agri.in`;

    // Concurrently trigger sendEmailOtp across 2 separate worker child processes
    const [workerA, workerB] = await Promise.all([
      runChildWorker({ action: 'EMAIL', target: testEmail }),
      runChildWorker({ action: 'EMAIL', target: testEmail })
    ]);

    const resA = workerA.response && workerA.response.result;
    const resB = workerB.response && workerB.response.result;

    assert.ok(resA, 'Worker A must return a result');
    assert.ok(resB, 'Worker B must return a result');

    const successes = [resA, resB].filter((r) => r.success === true);
    const cooldowns = [resA, resB].filter((r) => r.cooldown === true);

    assert.equal(successes.length, 1, 'Exactly one worker process must acquire the distributed lock and issue an OTP');
    assert.equal(cooldowns.length, 1, 'The competing worker process must receive a cooldown response');
    assert.match(cooldowns[0].message, /Please wait .* seconds before requesting a new verification email/);

    // Verify in MongoDB that exactly ONE active unconsumed OTP record was persisted
    const activeRecords = await VerificationOtp.find({
      target: testEmail,
      type: 'EMAIL',
      consumedAt: null
    });
    assert.equal(activeRecords.length, 1, 'Exactly one unconsumed OTP record must exist in MongoDB for this target');
  });

  test('cross-process phone resend concurrency across independent worker processes', async (t) => {
    if (!mongoConnected) {
      t.skip('MongoDB not reachable in current execution environment; skipping live multi-process test');
      return;
    }

    // Generate valid 10-digit Indian test phone number starting with 9
    const suffix = String(Date.now()).slice(-8);
    const testPhone = `99${suffix}`;

    // Concurrently trigger sendPhoneOtp across 2 separate worker child processes
    const [workerA, workerB] = await Promise.all([
      runChildWorker({ action: 'PHONE', target: testPhone }),
      runChildWorker({ action: 'PHONE', target: testPhone })
    ]);

    const resA = workerA.response && workerA.response.result;
    const resB = workerB.response && workerB.response.result;

    assert.ok(resA, 'Worker A must return a result');
    assert.ok(resB, 'Worker B must return a result');

    const successes = [resA, resB].filter((r) => r.success === true);
    const cooldowns = [resA, resB].filter((r) => r.cooldown === true);

    assert.equal(successes.length, 1, 'Exactly one worker process must acquire the distributed lock and issue an OTP');
    assert.equal(cooldowns.length, 1, 'The competing worker process must receive a cooldown response');
    assert.match(cooldowns[0].message, /Please wait .* seconds before requesting a new SMS verification code/);

    // Verify in MongoDB that exactly ONE active unconsumed OTP record was persisted
    const activeRecords = await VerificationOtp.find({
      target: testPhone,
      type: 'PHONE',
      consumedAt: null
    });
    assert.equal(activeRecords.length, 1, 'Exactly one unconsumed OTP record must exist in MongoDB for this target');
  });
});
