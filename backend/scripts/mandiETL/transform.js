
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

// Helper to retrieve values from rows with either lowercase or Title-Case keys
function getField(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

// Convert a string or number into a valid finite number
function parseNumber(value, fieldName) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is missing`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return number;
}

// Validate YYYY-MM-DD dates without accepting invalid calendar dates
function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const [year, month, day] = trimmed.split('-').map(Number);
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
      if (!row || typeof row !== 'object') {
        throw new Error('Row must be a valid data object');
      }

      // Support both lowercase and Title-Case source headers
      const rawCommodity = getField(row, 'commodity', 'Commodity', 'cropName', 'CropName');
      const rawCategory = getField(row, 'category', 'Category');
      const rawState = getField(row, 'state', 'State');
      const rawDistrict = getField(row, 'district', 'District');
      const rawMarketCenter = getField(row, 'marketCenter', 'MarketCenter', 'market', 'Market');

      const commodity = typeof rawCommodity === 'string' ? rawCommodity.trim().toUpperCase() : '';
      const category = typeof rawCategory === 'string' ? rawCategory.trim().toUpperCase() : '';
      const state = typeof rawState === 'string' ? rawState.trim().toUpperCase() : '';
      const district = typeof rawDistrict === 'string' ? rawDistrict.trim().toUpperCase() : '';
      const marketCenter = typeof rawMarketCenter === 'string' ? rawMarketCenter.trim() : '';

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
      const rawMinPrice = getField(row, 'minPrice', 'MinPrice', 'min_price');
      const rawMaxPrice = getField(row, 'maxPrice', 'MaxPrice', 'max_price');
      const rawModalPrice = getField(row, 'modalPrice', 'ModalPrice', 'modal_price');
      const rawArrival = getField(row, 'arrivalQuantity', 'ArrivalQuantity', 'arrivals', 'Arrivals');

      const minPrice = parseNumber(rawMinPrice, 'minPrice');
      const maxPrice = parseNumber(rawMaxPrice, 'maxPrice');
      const modalPrice = parseNumber(rawModalPrice, 'modalPrice');

      const arrivalQuantity =
        rawArrival == null || (typeof rawArrival === 'string' && rawArrival.trim() === '')
          ? 0
          : parseNumber(rawArrival, 'arrivalQuantity');

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
      const rawUnit = getField(row, 'unit', 'Unit');
      const unit =
        rawUnit != null && String(rawUnit).trim() !== ''
          ? String(rawUnit).trim().toUpperCase()
          : 'QUINTAL';

      if (unit !== 'QUINTAL') {
        throw new Error(`Unsupported unit: ${unit}`);
      }

      const rawDate = getField(row, 'priceDate', 'PriceDate', 'arrivalDate', 'ArrivalDate');
      const priceDate = parseDate(rawDate ?? '');

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
        originalData: { ...row }
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

module.exports = {
  transformMandiRates,
  parseNumber,
  parseDate,
  ALLOWED_CATEGORIES
};
