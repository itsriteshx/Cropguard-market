require('dotenv').config();

const mongoose = require('mongoose');
const MandiRate = require('../../src/models/MandiRate');
const { connectWithRetry } = require('./load');

/**
 * Diagnostic read-only audit for duplicate mandi rate records,
 * UTC midnight date normalization, and index verification.
 *
 * NOTE: This script does NOT create, drop, or mutate database indexes.
 * Index creation is a separate database deployment operation.
 */
async function checkDuplicates() {
  try {
    await connectWithRetry();

    // 1. Run duplicate aggregation (grouped by UTC calendar day)
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

    // 2. Run non-midnight UTC date check
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

    // 3. Inspect existing indexes in a read-only manner
    let indexReport = {
      status: 'ABSENT',
      error: null,
      details: null
    };

    try {
      const indexes = await MandiRate.collection.indexes();
      const targetIndex = indexes.find(
        (idx) => idx.name === 'uniq_mandi_rate_per_market_date'
      );

      if (targetIndex) {
        indexReport.details = targetIndex;
        const expectedKeys = [
          'commodity',
          'state',
          'district',
          'marketCenter',
          'unit',
          'priceDate'
        ];
        const actualKeys = Object.keys(targetIndex.key || {});
        const keysMatch =
          actualKeys.length === expectedKeys.length &&
          expectedKeys.every(
            (k, i) => actualKeys[i] === k && targetIndex.key[k] === 1
          );
        const isUnique = Boolean(targetIndex.unique);

        if (keysMatch && isUnique) {
          indexReport.status = 'VALID';
        } else {
          indexReport.status = 'MISCONFIGURED';
        }
      } else {
        indexReport.status = 'ABSENT';
      }
    } catch (indexErr) {
      indexReport.status = 'INSPECTION_FAILED';
      indexReport.error = indexErr.message;
    }

    // 4. Report findings
    console.log('\n--- DUPLICATE AUDIT REPORT ---');
    console.log('Duplicate groups found (by UTC calendar day):', duplicates.length);

    if (duplicates.length === 0) {
      console.log('No duplicate observations found.');
    } else {
      console.error('Duplicate groups detected:');
      console.error(JSON.stringify(duplicates, null, 2));
      process.exitCode = 1;
    }

    console.log('\n--- DATE INTEGRITY REPORT ---');
    console.log('Records with non-midnight UTC dates:', nonMidnightDates);

    if (nonMidnightDates > 0) {
      console.error(
        `Integrity warning: ${nonMidnightDates} record(s) have non-midnight UTC timestamps.`
      );
      process.exitCode = 1;
    }

    console.log('\n--- INDEX STATUS AUDIT (READ-ONLY) ---');
    if (indexReport.status === 'INSPECTION_FAILED') {
      console.error(
        `Index inspection failed: Could not retrieve collection indexes (${indexReport.error}).`
      );
      process.exitCode = 1;
    } else if (indexReport.status === 'VALID') {
      console.log(
        'Index `uniq_mandi_rate_per_market_date` is present and correctly configured (unique compound natural key).'
      );
    } else if (indexReport.status === 'MISCONFIGURED') {
      console.error(
        'Index `uniq_mandi_rate_per_market_date` exists but definition differs from expected schema:',
        indexReport.details
      );
      process.exitCode = 1;
    } else {
      console.log(
        'Index `uniq_mandi_rate_per_market_date` is not currently present in the database.'
      );
      console.log(
        'Note: This script performs read-only diagnostics and does not create indexes.'
      );
      console.log(
        'Index creation is a separate deployment operation (e.g., via Mongoose schema or DBA migration).'
      );
    }

    console.log('\nDiagnostic audit completed.');
  } catch (error) {
    console.error('\nDuplicate audit failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    }
  }
}

checkDuplicates();
