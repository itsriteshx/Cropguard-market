
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
    name: 'Modal price outside range',
    row: { ...validRow, modalPrice: '3000' },
    shouldPass: false
  },
  {
    name: 'Invalid date',
    row: { ...validRow, priceDate: '2026-02-30' },
    shouldPass: false
  },
  {
    name: 'Unsupported unit',
    row: { ...validRow, unit: 'KG' },
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

console.log('\n--- TEST SUMMARY ---');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${testCases.length}`);

if (failed > 0) {
  process.exitCode = 1;
}
