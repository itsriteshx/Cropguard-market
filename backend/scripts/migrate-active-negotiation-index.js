const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const INDEX_NAME = 'active_negotiation_listing_buyer_unique';
const TARGET_KEYS = { listing: 1, buyer: 1 };
const TARGET_PARTIAL = { status: { $in: ['OPEN', 'COUNTER_OFFERED'] } };

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[Migration Error]: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('[Migration]: Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('[Migration]: Connected successfully.');

    const db = mongoose.connection.db;
    const collection = db.collection('negotiations');

    // 1. Inspect existing indexes
    const existingIndexes = await collection.indexes();
    console.log(`[Migration]: Found ${existingIndexes.length} existing indexes on negotiations collection.`);

    // 2. Pre-check: Find duplicate active (listing, buyer) pairs
    console.log('[Migration]: Checking for active duplicate negotiations (status in OPEN, COUNTER_OFFERED)...');
    const duplicates = await collection.aggregate([
      { $match: { status: { $in: ['OPEN', 'COUNTER_OFFERED'] } } },
      {
        $group: {
          _id: { listing: '$listing', buyer: '$buyer' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          statuses: { $push: '$status' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length > 0) {
      console.error(`[Migration Aborted]: Found ${duplicates.length} duplicate active negotiation pair(s):`);
      console.error(JSON.stringify(duplicates, null, 2));
      console.error('[Migration Aborted]: Please resolve duplicate active negotiations before applying unique index.');
      process.exitCode = 1;
      return;
    }
    console.log('[Migration]: No duplicate active negotiations found. Safe to proceed.');

    // 3. Check if target index already exists with correct options
    const existingTargetIndex = existingIndexes.find((idx) => {
      const keys = idx.key || {};
      const matchesKeys = keys.listing === 1 && keys.buyer === 1 && Object.keys(keys).length === 2;
      const matchesUnique = idx.unique === true;
      const partial = idx.partialFilterExpression;
      const matchesPartial = partial &&
        partial.status &&
        Array.isArray(partial.status.$in) &&
        partial.status.$in.length === 2 &&
        partial.status.$in.includes('OPEN') &&
        partial.status.$in.includes('COUNTER_OFFERED');
      return matchesKeys && matchesUnique && matchesPartial;
    });

    if (existingTargetIndex) {
      console.log(`[Migration Success]: Target partial unique index already exists (${existingTargetIndex.name}). No changes required.`);

      // Check if an obsolete non-unique index on { listing: 1, buyer: 1 } still lingers alongside it
      const redundantOld = existingIndexes.find((idx) => {
        const keys = idx.key || {};
        return keys.listing === 1 && keys.buyer === 1 && Object.keys(keys).length === 2 && !idx.unique && idx.name !== existingTargetIndex.name;
      });
      if (redundantOld) {
        console.log(`[Migration]: Dropping redundant legacy non-unique index: ${redundantOld.name}`);
        await collection.dropIndex(redundantOld.name);
      }
      return;
    }

    // 4. Check for old non-unique index on { listing: 1, buyer: 1 }
    const oldListingBuyerIndex = existingIndexes.find((idx) => {
      const keys = idx.key || {};
      return keys.listing === 1 && keys.buyer === 1 && Object.keys(keys).length === 2 && idx.name !== INDEX_NAME;
    });

    if (oldListingBuyerIndex) {
      console.log(`[Migration]: Dropping legacy non-unique index: ${oldListingBuyerIndex.name}`);
      await collection.dropIndex(oldListingBuyerIndex.name);
      console.log(`[Migration]: Successfully dropped ${oldListingBuyerIndex.name}.`);
    }

    // 5. Create new partial unique index
    console.log(`[Migration]: Creating partial unique index "${INDEX_NAME}"...`);
    await collection.createIndex(
      TARGET_KEYS,
      {
        unique: true,
        partialFilterExpression: TARGET_PARTIAL,
        name: INDEX_NAME
      }
    );
    console.log(`[Migration]: Created index "${INDEX_NAME}".`);

    // 6. Verify final index definition
    const updatedIndexes = await collection.indexes();
    const verified = updatedIndexes.find((idx) => idx.name === INDEX_NAME);
    if (!verified || !verified.unique || !verified.partialFilterExpression) {
      throw new Error(`Verification failed: Index "${INDEX_NAME}" not found or lacks unique/partial options.`);
    }

    console.log('[Migration Success]: Successfully created and verified active negotiation partial unique index:');
    console.log(JSON.stringify({
      name: verified.name,
      key: verified.key,
      unique: verified.unique,
      partialFilterExpression: verified.partialFilterExpression
    }, null, 2));

  } catch (error) {
    console.error(`[Migration Error]: ${error.message}`);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
      console.log('[Migration]: Disconnected from MongoDB.');
    } catch (disconnectErr) {
      console.error(`[Migration Error]: Disconnect failed: ${disconnectErr.message}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  migrate().then(() => {
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
}

module.exports = migrate;
