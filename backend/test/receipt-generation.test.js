const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const { getOrderReceipt } = require('../src/controllers/orderController');

test('getOrderReceipt enriches receipt with APMC exemption, SHA-256 hash, and 10% middleman commission saved', async () => {
  const originalFindById = Order.findById;
  const mockOrder = {
    _id: '672000000000000000000123',
    orderNumber: 'CGM-987654321',
    orderStatus: 'DELIVERED',
    paymentStatus: 'ESCROW_SECURED',
    paymentDetails: { paymentMethod: 'UPI_ESCROW', transactionId: 'TXN-999888' },
    farmer: {
      _id: '672000000000000000000001',
      name: 'Ramesh Patil',
      phone: '9845012345',
      location: { village: 'Navalgund', district: 'Dharwad', state: 'Karnataka' },
      fpoAffiliation: 'Navalgund Farmers Producer Co.'
    },
    buyer: {
      _id: '672000000000000000000002',
      name: 'Karnataka State Apex Co-op',
      phone: '9845099999'
    },
    deliveryAddress: {
      village: 'APMC Yard',
      district: 'Hubballi',
      state: 'Karnataka'
    },
    cropName: 'Red Onion (Garva Special)',
    quantity: 100,
    unit: 'QUINTAL',
    unitPrice: 2450,
    totalAmount: 245000,
    createdAt: new Date('2026-10-25T10:00:00.000Z')
  };

  try {
    Order.findById = () => ({
      populate: () => ({
        populate: async () => mockOrder
      })
    });

    const call = async (userId, role = 'BUYER_WHOLESALE') => {
      let status, result;
      await getOrderReceipt(
        {
          params: { id: mockOrder._id },
          user: { _id: userId, role },
          language: 'hi'
        },
        {
          status(s) {
            status = s;
            return this;
          },
          json(r) {
            result = r;
            return this;
          }
        },
        (err) => {
          throw err;
        }
      );
      return { status, result };
    };

    // 1. Unauthorized user should receive 403
    const unauthorized = await call('672000000000000000000999', 'BUYER_RETAIL');
    assert.equal(unauthorized.status, 403);

    // 2. Buyer can fetch receipt
    const buyerCall = await call('672000000000000000000002');
    assert.equal(buyerCall.status, 200);
    const receipt = buyerCall.result.receipt;

    // Check receipt identifiers
    assert.equal(receipt.receiptNumber, 'REC-CGM-987654321');
    assert.equal(receipt.orderNumber, 'CGM-987654321');
    assert.equal(receipt.language, 'hi');

    // Check financial breakdown & 10% middleman savings
    assert.equal(receipt.financialBreakdown.subtotal, 245000);
    assert.equal(receipt.financialBreakdown.intermediaryCommissionFee, 0);
    assert.equal(receipt.financialBreakdown.intermediaryCommissionSaved, 24500); // 10% of 245,000
    assert.equal(receipt.financialBreakdown.farmerRealizationRate, '100%');
    assert.equal(receipt.financialBreakdown.grandTotal, 245000);

    // Check statutory APMC compliance
    assert.ok(receipt.apmcCompliance.governingAct.includes('Karnataka Agricultural Produce Marketing'));
    assert.equal(receipt.apmcCompliance.mandiFeeLevied, 0);
    assert.equal(receipt.apmcCompliance.arhatiyaCommissionDeducted, 0);
    assert.ok(receipt.apmcCompliance.accreditationAuthority.includes('UASD'));

    // Check verification payload & SHA-256 signature
    assert.ok(receipt.verification.hash.length === 64); // SHA-256 hex string length
    assert.equal(receipt.verification.shortHash.length, 16);
    assert.ok(receipt.verification.qrPayload.startsWith('https://cropguard.agri.gov.in/verify?receipt=REC-CGM-987654321'));
    assert.equal(receipt.verification.digitalKhataAuditId, 'AUD-KHATA-000123');

    // 3. Farmer can also fetch receipt
    const farmerCall = await call('672000000000000000000001', 'FARMER');
    assert.equal(farmerCall.status, 200);
    assert.equal(farmerCall.result.receipt.verification.hash, receipt.verification.hash);
  } finally {
    Order.findById = originalFindById;
  }
});
