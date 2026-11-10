
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../../src/config/db');
const MandiRate = require('../../src/models/MandiRate');

const { extractMandiRates } = require('./extract');
const { transformMandiRates } = require('./transform');

// Connect to MongoDB, retrying if a temporary connection failure occurs.
async function connectWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `\nMongoDB connection attempt ${attempt}/${maxAttempts}`
    );

    await connectDB();

    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB connection established successfully.');
      return;
    }

    if (attempt < maxAttempts) {
      console.log('Connection failed. Retrying in 3 seconds...');

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(
    `Could not connect to MongoDB after ${maxAttempts} attempts.`
  );
}

// Load validated records into MongoDB.
async function loadMandiRates(records) {
  if (records.length === 0) {
    console.log('No valid records to load.');
    return;
  }

  const operations = records.map((record) => ({
    updateOne: {
      filter: {
        commodity: record.commodity,
        state: record.state,
        district: record.district,
        marketCenter: record.marketCenter,
        unit: record.unit,
        priceDate: record.priceDate
      },
      update: {
        $set: record
      },
      upsert: true
    }
  }));

  const result = await MandiRate.bulkWrite(operations, {
    ordered: false
  });

  console.log('\n--- DATABASE LOAD SUMMARY ---');
  console.log('Records processed:', records.length);
  console.log('New records inserted:', result.upsertedCount);
  console.log('Existing records matched:', result.matchedCount);
  console.log('Existing records updated:', result.modifiedCount);
}

// Run the complete Extract, Transform, Load pipeline.
async function main() {
  try {
    // STEP 1: EXTRACT
    const rawRecords = await extractMandiRates();

    // STEP 2: TRANSFORM
    const { validRecords, rejectedRecords } =
      transformMandiRates(rawRecords);

    console.log('\n--- ETL VALIDATION SUMMARY ---');
    console.log('Total records:', rawRecords.length);
    console.log('Valid records:', validRecords.length);
    console.log('Rejected records:', rejectedRecords.length);

    if (rejectedRecords.length > 0) {
      console.log('\nRejected records:');
      console.log(rejectedRecords);
    }

    if (validRecords.length === 0) {
      console.log('Nothing to load.');
      return;
    }

    // STEP 3: LOAD
    await connectWithRetry();

    await loadMandiRates(validRecords);

  } catch (error) {
    console.error('\nETL pipeline failed:', error.message);
    process.exitCode = 1;

  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('\nMongoDB connection closed.');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadMandiRates,
  connectWithRetry
};
