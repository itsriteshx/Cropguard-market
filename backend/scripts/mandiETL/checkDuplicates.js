
require('dotenv').config();

const mongoose = require('mongoose');
const MandiRate = require('../../src/models/MandiRate');
const { connectWithRetry } = require('./load');

async function checkDuplicates() {
  try {
    await connectWithRetry();
    await MandiRate.collection.createIndex(
  {
    commodity: 1,
    state: 1,
    district: 1,
    marketCenter: 1,
    unit: 1,
    priceDate: 1
  },
  {
    unique: true,
    name: 'uniq_mandi_rate_per_market_date'
  }
);

console.log('Unique compound index created successfully.');

    const duplicates = await MandiRate.aggregate([
  {
    $group: {
      _id: {
        commodity: '$commodity',
        state: '$state',
        district: '$district',
        marketCenter: '$marketCenter',
        unit: '$unit',
        priceDay: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$priceDate',
            timezone: 'UTC'
          }
        }
      },
      count: { $sum: 1 }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]);

    const nonMidnightDates = await MandiRate.countDocuments({
  $expr: {
    $ne: [
      '$priceDate',
      {
        $dateTrunc: {
          date: '$priceDate',
          unit: 'day',
          timezone: 'UTC'
        }
      }
    ]
  }
});

console.log('Records with non-midnight UTC dates:', nonMidnightDates);

    console.log('\n--- DUPLICATE CHECK ---');
    console.log('Duplicate groups found:', duplicates.length);

    if (duplicates.length === 0) {
      console.log('No duplicate records found.');
    } else {
      console.log(duplicates);
    }
  } catch (error) {
    console.error('\nDuplicate check failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('\nMongoDB connection closed.');
    }
  }
}

checkDuplicates();
