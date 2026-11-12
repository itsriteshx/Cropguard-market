const express = require('express');
const router = express.Router();

const {
  createOrder,
  updateOrderStatus,
  getOrderById,
  getMyOrders,
  getFarmerLedger,
  getOrderReceipt
} = require('../controllers/orderController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { sanitizeParams } = require('../middleware/securityMiddleware');

// All order endpoints require JWT authentication
router.use(protect);

// Farmer Digital Ledger (Khata) - Must be before /:id
router.get('/farmer-ledger', authorize('FARMER', 'ADMIN'), getFarmerLedger);

// Orders query (admin or participant orders)
router.get('/', getMyOrders);
router.get('/my-orders', getMyOrders);

// Order creation
router.post('/', createOrder);

// Single order operations - sanitize route params after matching
router.use('/:id', sanitizeParams);
router.get('/:id', getOrderById);
router.get('/:id/receipt', getOrderReceipt);
router.put('/:id/status', updateOrderStatus);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
