
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Locate the CSV file
const csvFilePath = path.join(
  __dirname,
  '../../data/mandi_rates_sample.csv'
);

// Extract rows from CSV
function extractMandiRates() {
  return new Promise((resolve, reject) => {
    const records = [];

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', () => {
        console.log(`Successfully extracted ${records.length} records`);
        resolve(records);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Run extraction independently
async function main() {
  try {
    const records = await extractMandiRates();

    console.log('\nFirst extracted record:');
    console.log(records[0]);

    return records;
  } catch (error) {
    console.error('CSV extraction failed:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractMandiRates };
