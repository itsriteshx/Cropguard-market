
const { extractMandiRates } = require('./extract');

const ALLOWED_CATEGORIES = [
  'VEGETABLES',
  'GRAINS',
  'PULSES',
  'FRUITS',
  'OILSEEDS',
  'SPICES',
  'FIBRES'
];

// Convert a string into a valid number
function parseNumber(value, fieldName) {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${fieldName} is missing`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return number;
}

// Validate YYYY-MM-DD dates without accepting invalid dates
function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date');
  }

  return date;
}

function transformMandiRates(records) {
  const validRecords = [];
  const rejectedRecords = [];

  records.forEach((row, index) => {
    try {
      const commodity = row.commodity?.trim().toUpperCase();
      const category = row.category?.trim().toUpperCase();
      const state = row.state?.trim().toUpperCase();
      const district = row.district?.trim().toUpperCase();
      const marketCenter = row.marketCenter?.trim();

      // Validate required text fields
      if (!commodity) throw new Error('Commodity is missing');
      if (!state) throw new Error('State is missing');
      if (!district) throw new Error('District is missing');
      if (!marketCenter) throw new Error('Market center is missing');

      // Validate category
      if (!ALLOWED_CATEGORIES.includes(category)) {
        throw new Error(`Invalid category: ${category}`);
      }

      // Convert numeric fields
      const minPrice = parseNumber(row.minPrice, 'minPrice');
      const maxPrice = parseNumber(row.maxPrice, 'maxPrice');
      const modalPrice = parseNumber(row.modalPrice, 'modalPrice');

      const arrivalQuantity =
        row.arrivalQuantity?.trim() === ''
          ? 0
          : parseNumber(row.arrivalQuantity, 'arrivalQuantity');

      // Validate prices
      if (minPrice < 0 || maxPrice < 0 || modalPrice < 0) {
        throw new Error('Prices cannot be negative');
      }

      if (minPrice > maxPrice) {
        throw new Error('minPrice cannot exceed maxPrice');
      }

      if (modalPrice < minPrice || modalPrice > maxPrice) {
        throw new Error('modalPrice must be between minPrice and maxPrice');
      }

      if (arrivalQuantity < 0) {
        throw new Error('arrivalQuantity cannot be negative');
      }

      // Our current benchmark pipeline supports QUINTAL only
      const unit = row.unit?.trim().toUpperCase() || 'QUINTAL';

      if (unit !== 'QUINTAL') {
        throw new Error(`Unsupported unit: ${unit}`);
      }

      const priceDate = parseDate(row.priceDate?.trim() || '');

      // Store cleaned data
      validRecords.push({
        commodity,
        category,
        state,
        district,
        marketCenter,
        minPrice,
        maxPrice,
        modalPrice,
        unit,
        arrivalQuantity,
        priceDate
      });
    } catch (error) {
      rejectedRecords.push({
        rowNumber: index + 2,
        reason: error.message,
        originalData: row
      });
    }
  });

  return { validRecords, rejectedRecords };
}

// Test transformation independently
async function main() {
  try {
    const records = await extractMandiRates();
    const { validRecords, rejectedRecords } =
      transformMandiRates(records);

    console.log('\n--- TRANSFORMATION SUMMARY ---');
    console.log('Total records:', records.length);
    console.log('Valid records:', validRecords.length);
    console.log('Rejected records:', rejectedRecords.length);

    console.log('\nFirst transformed record:');
    console.log(validRecords[0]);

    if (rejectedRecords.length > 0) {
      console.log('\nRejected records:');
      console.log(rejectedRecords);
    }
  } catch (error) {
    console.error('Transformation failed:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { transformMandiRates };
