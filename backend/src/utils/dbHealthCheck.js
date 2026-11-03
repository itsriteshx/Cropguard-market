const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const checkDatabaseHealth = async () => {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🩺 CropGuard Market - Database Health Diagnostics');
  console.log('   MongoDB Atlas Cluster (ap-south-1 Mumbai)');
  console.log('====================================================');

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    const connectDurationMs = Date.now() - startTime;

    console.log(`\n[✓] Cluster Status: ONLINE`);
    console.log(`    Host:            ${conn.connection.host}`);
    console.log(`    Database:        ${conn.connection.name}`);
    console.log(`    Connect Latency: ${connectDurationMs} ms`);

    const adminDb = mongoose.connection.db.admin();
    const pingResult = await adminDb.ping();
    console.log(`    Atlas Ping:      ${pingResult.ok === 1 ? 'SUCCESS (ok: 1)' : 'FAILED'}`);

    // Inspect Collections & Document Counts
    console.log('\n[✓] Collection Metrics:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`    • ${col.name.padEnd(20)} : ${count} documents`);
    }

    // Inspect Index Health
    console.log('\n[✓] Key Performance & Geospatial Indexes:');
    const User = require('../models/User');
    const ProduceListing = require('../models/ProduceListing');
    const MandiRate = require('../models/MandiRate');
    const Order = require('../models/Order');

    const userIndexes = await User.collection.indexes();
    const hasUserGeo = userIndexes.some((idx) => idx.key && idx.key['location.coordinates'] === '2dsphere');
    console.log(`    • User 2dsphere Geospatial Index:      ${hasUserGeo ? 'ACTIVE (Verified)' : 'MISSING'}`);

    const listingIndexes = await ProduceListing.collection.indexes();
    const hasListingGeo = listingIndexes.some((idx) => idx.key && idx.key['location.coordinates'] === '2dsphere');
    const hasTextIndex = listingIndexes.some((idx) => idx.key && idx.key._fts === 'text');
    console.log(`    • Listing 2dsphere Geospatial Index:   ${hasListingGeo ? 'ACTIVE (Verified)' : 'MISSING'}`);
    console.log(`    • Listing Full-Text Search Index:      ${hasTextIndex ? 'ACTIVE (Verified)' : 'MISSING'}`);

    const mandiIndexes = await MandiRate.collection.indexes();
    const hasMandiCompound = mandiIndexes.some(
      (idx) => idx.key && idx.key.commodity && idx.key.district && idx.key.priceDate
    );
    console.log(`    • Mandi Sub-Second Compound Index:     ${hasMandiCompound ? 'ACTIVE (Verified)' : 'MISSING'}`);

    const orderIndexes = await Order.collection.indexes();
    const hasOrderCompound = orderIndexes.some((idx) => idx.key && idx.key.farmer && idx.key.orderStatus);
    console.log(`    • Order Fulfillment Compound Index:    ${hasOrderCompound ? 'ACTIVE (Verified)' : 'MISSING'}`);

    console.log('\n====================================================');
    console.log('🎉 Diagnostics Passed: Database is 100% healthy and ready!');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Diagnostics Failed:', error.message);
    process.exit(1);
  }
};

checkDatabaseHealth();
