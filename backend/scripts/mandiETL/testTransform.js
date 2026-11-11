const { transformMandiRates } = require('./transform');

const validRow = {
  commodity: 'Tomato',
  category: 'VEGETABLES',
  state: 'Maharashtra',
  district: 'Pune',
  marketCenter: 'Pune APMC',
  minPrice: '1800',
  maxPrice: '2400',
  modalPrice: '2100',
  unit: 'QUINTAL',
  arrivalQuantity: '120',
  priceDate: '2026-11-08'
};

const titleCaseRow = {
  Commodity: 'Wheat',
  Category: 'GRAINS',
  State: 'Punjab',
  District: 'Ludhiana',
  MarketCenter: 'Ludhiana APMC',
  MinPrice: '2200',
  MaxPrice: '2600',
  ModalPrice: '2450',
  Unit: 'QUINTAL',
  ArrivalQuantity: '300',
  PriceDate: '2026-11-08'
};

const testCases = [
  {
    name: 'Valid record',
    row: { ...validRow },
    shouldPass: true
  },
  {
    name: 'Negative minimum price',
    row: { ...validRow, minPrice: '-100' },
    shouldPass: false
  },
  {
    name: 'Invalid category',
    row: { ...validRow, category: 'UNKNOWN' },
    shouldPass: false
  },
  {
    name: 'Modal price outside range (above max)',
    row: { ...validRow, modalPrice: '3000' },
    shouldPass: false
  },
  {
    name: 'Modal price below minimum price',
    row: { ...validRow, modalPrice: '1500' },
    shouldPass: false
  },
  {
    name: 'Minimum price exceeds maximum price',
    row: { ...validRow, minPrice: '2800', maxPrice: '2400', modalPrice: '2600' },
    shouldPass: false
  },
  {
    name: 'Non-numeric price value',
    row: { ...validRow, modalPrice: 'not-a-number' },
    shouldPass: false
  },
  {
    name: 'Negative arrival quantity',
    row: { ...validRow, arrivalQuantity: '-10' },
    shouldPass: false
  },
  {
    name: 'Empty arrival quantity string defaults to 0',
    row: { ...validRow, arrivalQuantity: '' },
    shouldPass: true
  },
  {
    name: 'Missing arrival quantity field defaults to 0',
    row: (({ arrivalQuantity, ...rest }) => rest)(validRow),
    shouldPass: true
  },
  {
    name: 'Null arrival quantity defaults to 0',
    row: { ...validRow, arrivalQuantity: null },
    shouldPass: true
  },
  {
    name: 'Numeric zero arrival quantity is accepted',
    row: { ...validRow, arrivalQuantity: 0 },
    shouldPass: true
  },
  {
    name: 'Numeric positive arrival quantity is accepted',
    row: { ...validRow, arrivalQuantity: 150 },
    shouldPass: true
  },
  {
    name: 'Missing required commodity',
    row: { ...validRow, commodity: '   ' },
    shouldPass: false
  },
  {
    name: 'Missing required state',
    row: { ...validRow, state: '' },
    shouldPass: false
  },
  {
    name: 'Missing required district',
    row: { ...validRow, district: '  ' },
    shouldPass: false
  },
  {
    name: 'Missing required marketCenter',
    row: { ...validRow, marketCenter: '' },
    shouldPass: false
  },
  {
    name: 'Title-Case source headers handled correctly',
    row: { ...titleCaseRow },
    shouldPass: true
  },
  {
    name: 'Missing optional unit defaults to QUINTAL',
    row: (({ unit, ...rest }) => rest)(validRow),
    shouldPass: true
  },
  {
    name: 'Unsupported unit',
    row: { ...validRow, unit: 'KG' },
    shouldPass: false
  },
  {
    name: 'Invalid date format (DD-MM-YYYY)',
    row: { ...validRow, priceDate: '08-11-2026' },
    shouldPass: false
  },
  {
    name: 'Invalid calendar date (Feb 30)',
    row: { ...validRow, priceDate: '2026-02-30' },
    shouldPass: false
  }
];

let passed = 0;
let failed = 0;

console.log('\n--- TRANSFORMATION TESTS ---\n');

for (const test of testCases) {
  const result = transformMandiRates([test.row]);

  const actualPass = result.validRecords.length === 1;
  const success = actualPass === test.shouldPass;

  if (success) {
    passed++;
    console.log(`PASS: ${test.name}`);
  } else {
    failed++;
    console.log(`FAIL: ${test.name}`);
    console.log(result.rejectedRecords);
  }
}

// Additional validation: Normalization & Non-mutation verification
console.log('\n--- NORMALIZATION & DIAGNOSTICS INTEGRITY CHECKS ---');

const rawInput = {
  commodity: '  onion  ',
  category: 'vegetables',
  state: 'maharashtra',
  district: 'nashik',
  marketCenter: ' Lasalgaon APMC ',
  minPrice: 2000,
  maxPrice: 2800,
  modalPrice: 2400,
  priceDate: '2026-11-08'
};

const inputClone = JSON.stringify(rawInput);
const normResult = transformMandiRates([rawInput]);
const nonMutated = JSON.stringify(rawInput) === inputClone;

if (nonMutated && normResult.validRecords.length === 1) {
  const record = normResult.validRecords[0];
  const isNormalized =
    record.commodity === 'ONION' &&
    record.category === 'VEGETABLES' &&
    record.state === 'MAHARASHTRA' &&
    record.district === 'NASHIK' &&
    record.marketCenter === 'Lasalgaon APMC' &&
    record.unit === 'QUINTAL' &&
    record.arrivalQuantity === 0 &&
    record.priceDate.toISOString() === '2026-11-08T00:00:00.000Z';

  if (isNormalized) {
    passed++;
    console.log('PASS: Normalization & source non-mutation verified');
  } else {
    failed++;
    console.log('FAIL: Normalization output mismatch');
  }
} else {
  failed++;
  console.log('FAIL: Source object was unexpectedly mutated');
}

// Verification of rejected record diagnostics
const invalidRow = { commodity: '', state: 'MH', priceDate: 'invalid-date' };
const diagResult = transformMandiRates([invalidRow]);
if (
  diagResult.rejectedRecords.length === 1 &&
  diagResult.rejectedRecords[0].rowNumber === 2 &&
  typeof diagResult.rejectedRecords[0].reason === 'string' &&
  diagResult.rejectedRecords[0].originalData.state === 'MH'
) {
  passed++;
  console.log('PASS: Rejection diagnostics (rowNumber, reason, originalData) verified');
} else {
  failed++;
  console.log('FAIL: Rejection diagnostics mismatch');
}

const totalTests = testCases.length + 2;

console.log('\n--- TEST SUMMARY ---');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${totalTests}`);

if (failed > 0) {
  process.exitCode = 1;
}
