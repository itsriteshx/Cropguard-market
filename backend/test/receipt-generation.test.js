const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const { getOrderReceipt } = require('../src/controllers/orderController');

test('receipt provides participant data and clearly labels simulated payment', async () => {
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

    assert.equal(receipt.financialBreakdown.subtotal, 245000);
    assert.equal(receipt.financialBreakdown.grandTotal, 245000);
    assert.equal(receipt.simulated, true);
    assert.equal(receipt.paymentStatus, 'ESCROW_SECURED');
    assert.match(receipt.declaration, /simulated/);
    assert.equal(receipt.verification, undefined);
    assert.equal(receipt.apmcCompliance, undefined);
    const farmerCall = await call('672000000000000000000001', 'FARMER');
    assert.equal(farmerCall.status, 200);
  } finally {
    Order.findById = originalFindById;
  }
});
