const mongoose = require('mongoose');
const crypto = require('crypto');

// Distributed Lock Schema using collection's built-in unique _id index
const distributedLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  {
    collection: 'distributed_locks',
    timestamps: true,
    versionKey: false
  }
);

const DistributedLock =
  mongoose.models.DistributedLock || mongoose.model('DistributedLock', distributedLockSchema);

// In-memory queue fallback strictly for disconnected unit tests
const inMemoryQueues = new Map();

async function withInMemoryLock(key, fn) {
  const prev = (inMemoryQueues.get(key) || Promise.resolve()).catch(() => {});
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  inMemoryQueues.set(key, next);

  await prev;
  const lockContext = {
    key: `lock:${key}`,
    token: 'in_memory',
    assertValid: () => {},
    isLost: () => false
  };
  try {
    return await fn(lockContext);
  } finally {
    release();
    if (inMemoryQueues.get(key) === next) {
      inMemoryQueues.delete(key);
    }
  }
}

/**
 * Acquires a distributed lock in MongoDB using atomic findOneAndUpdate / insert strategy on _id.
 */
async function acquireDistributedLock(
  lockKey,
  ownershipToken,
  { leaseMs = 5000, timeoutMs = 2000, retryIntervalMs = 50 } = {}
) {
  const startTime = Date.now();

  while (Date.now() - startTime <= timeoutMs) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    // 1. Try to take over an expired lease atomically
    try {
      const updated = await DistributedLock.findOneAndUpdate(
        {
          _id: lockKey,
          expiresAt: { $lte: now }
        },
        {
          $set: {
            token: ownershipToken,
            expiresAt
          }
        },
        { new: true }
      );

      if (updated) {
        return true;
      }
    } catch (err) {
      throw err; // Fail closed on database failure
    }

    // 2. Try to insert new lock if document does not exist yet (unique _id enforces atomicity)
    try {
      await DistributedLock.create({
        _id: lockKey,
        token: ownershipToken,
        expiresAt
      });
      return true;
    } catch (err) {
      if (err.code === 11000) {
        // Document exists and is currently held by another process
      } else {
        throw err; // Fail closed on database failure
      }
    }

    const elapsed = Date.now() - startTime;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryIntervalMs, remaining)));
  }

  return false;
}

/**
 * Renews the lease for an actively held distributed lock atomically.
 * Requires matching ownershipToken so only the legitimate owner can renew.
 * Propagates database errors and returns false if ownership was lost.
 */
async function renewDistributedLock(lockKey, ownershipToken, leaseMs = 5000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);

  let updated;
  try {
    updated = await DistributedLock.findOneAndUpdate(
      {
        _id: lockKey,
        token: ownershipToken
      },
      {
        $set: { expiresAt }
      },
      { new: true }
    );
  } catch (err) {
    console.error(`[DistributedLock] Database failure during lock renewal: ${err.message || 'Database error'}`);
    throw err;
  }

  if (!updated) {
    console.error('[DistributedLock] Lock renewal failed: lock ownership lost or document missing');
    return false;
  }

  return true;
}

/**
 * Verifies that the lock document is currently held by ownershipToken and has not expired.
 */
async function verifyDistributedLock(lockKey, ownershipToken) {
  try {
    const now = new Date();
    const lock = await DistributedLock.findOne({
      _id: lockKey,
      token: ownershipToken,
      expiresAt: { $gt: now }
    });
    return Boolean(lock);
  } catch (err) {
    console.error(`[DistributedLock] Database failure during lock verification: ${err.message || 'Database error'}`);
    throw err;
  }
}

/**
 * Releases the distributed lock only if matching the unique ownershipToken.
 * Reports errors safely without exposing targets, numbers, or secrets.
 */
async function releaseDistributedLock(lockKey, ownershipToken) {
  try {
    const result = await DistributedLock.deleteOne({
      _id: lockKey,
      token: ownershipToken
    });
    return result;
  } catch (err) {
    console.error(`[DistributedLock] Failed to release lock safely: ${err.message || 'Database error'}`);
    throw err;
  }
}

/**
 * Active renewal monitor that replaces unmonitored fire-and-forget intervals.
 * Can be awaited, tracks in-flight renewals, and fails closed immediately on lock loss.
 */
class LockRenewalMonitor {
  constructor(lockKey, ownershipToken, leaseMs, renewalIntervalMs) {
    this.lockKey = lockKey;
    this.ownershipToken = ownershipToken;
    this.leaseMs = leaseMs;
    this.renewalIntervalMs = renewalIntervalMs;
    this.isLost = false;
    this.lostReason = null;
    this.stopped = false;
    this.timer = null;
    this.inFlightRenewal = null;
    this.currentExpiresAt = new Date(Date.now() + leaseMs);
    this._rejectLost = null;
    this.lostPromise = new Promise((_, reject) => {
      this._rejectLost = reject;
    });
    // Prevent unhandled rejection warning if stopped before lostPromise is observed
    this.lostPromise.catch(() => {});
  }

  start() {
    if (this.renewalIntervalMs <= 0) return;

    const scheduleNext = () => {
      if (this.stopped) return;
      this.timer = setTimeout(async () => {
        if (this.stopped) return;
        try {
          this.inFlightRenewal = renewDistributedLock(
            this.lockKey,
            this.ownershipToken,
            this.leaseMs
          );
          const renewed = await this.inFlightRenewal;
          if (!renewed && !this.stopped) {
            const err = new Error(
              `Distributed lock lost: ownership token mismatch or lease expired`
            );
            this.markLost(err);
            return;
          }
          if (renewed) {
            this.currentExpiresAt = new Date(Date.now() + this.leaseMs);
          }
        } catch (err) {
          if (!this.stopped) {
            const lockErr = new Error(
              `Distributed lock lost due to renewal database error: ${err.message || 'database failure'}`
            );
            this.markLost(lockErr);
            return;
          }
        } finally {
          this.inFlightRenewal = null;
        }

        scheduleNext();
      }, this.renewalIntervalMs);

      if (this.timer && typeof this.timer.unref === 'function') {
        this.timer.unref();
      }
    };

    scheduleNext();
  }

  markLost(err) {
    this.isLost = true;
    this.lostReason = err;
    if (this._rejectLost) {
      this._rejectLost(err);
    }
  }

  assertValid() {
    if (this.isLost) {
      throw this.lostReason || new Error(`Distributed lock lost for ${this.lockKey}`);
    }
    if (this.currentExpiresAt && Date.now() >= this.currentExpiresAt.getTime()) {
      const err = new Error(`Distributed lock lease expired for ${this.lockKey}`);
      this.markLost(err);
      throw err;
    }
  }

  async stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlightRenewal) {
      try {
        await this.inFlightRenewal;
      } catch (_) {}
    }
  }
}

/**
 * Executes an async action with distributed mutual exclusion per target/type key.
 */
async function withResendLock(key, fn, options = {}) {
  const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
  const isMocked =
    DistributedLock.findOneAndUpdate &&
    DistributedLock.findOneAndUpdate !== mongoose.Model.findOneAndUpdate;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isConnected && !isMocked) {
    // Strictly isolate in-memory fallback to disconnected test/dev environments; never in production
    if (isProduction) {
      throw new Error('Database connection unavailable; refusing to use in-memory lock in production environment (fail closed)');
    }
    return withInMemoryLock(key, fn);
  }

  const lockKey = `lock:${key}`;
  const ownershipToken = crypto.randomUUID
    ? crypto.randomUUID()
    : new mongoose.Types.ObjectId().toString();

  const leaseMs = options.leaseMs || 5000;
  const acquired = await acquireDistributedLock(lockKey, ownershipToken, { ...options, leaseMs });
  if (!acquired) {
    throw new Error(`Failed to acquire distributed OTP resend lock for ${key} within timeout; failing closed`);
  }

  const renewalIntervalMs =
    options.renewalIntervalMs !== undefined
      ? options.renewalIntervalMs
      : Math.max(100, Math.floor(leaseMs / 3));

  const monitor = new LockRenewalMonitor(lockKey, ownershipToken, leaseMs, renewalIntervalMs);
  monitor.start();

  const lockContext = {
    key: lockKey,
    token: ownershipToken,
    assertValid: () => monitor.assertValid(),
    isLost: () => monitor.isLost
  };

  let actionError = null;
  try {
    // Race action against monitor failure for immediate interruption on lock loss
    const result = await Promise.race([
      fn(lockContext),
      monitor.lostPromise
    ]);

    // Ensure monitor did not record a loss before completing
    monitor.assertValid();

    // Verify current ownership token still holds a valid, unexpired lock in MongoDB
    const isStillHeld = await verifyDistributedLock(lockKey, ownershipToken);
    if (!isStillHeld) {
      throw new Error(`Distributed lock validation failed for ${key}: lock was lost or expired before critical section completion`);
    }

    return result;
  } catch (err) {
    actionError = err;
    throw err;
  } finally {
    await monitor.stop();
    try {
      await releaseDistributedLock(lockKey, ownershipToken);
    } catch (releaseErr) {
      if (!actionError) {
        throw releaseErr;
      }
    }
  }
}

module.exports = {
  withResendLock,
  acquireDistributedLock,
  renewDistributedLock,
  verifyDistributedLock,
  releaseDistributedLock,
  LockRenewalMonitor,
  DistributedLock
};
