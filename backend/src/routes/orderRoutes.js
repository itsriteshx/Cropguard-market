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

// All order endpoints require JWT authentication
router.use(protect);

// Farmer Digital Ledger (Khata) - Must be before /:id
router.get('/farmer-ledger', authorize('FARMER', 'ADMIN'), getFarmerLedger);

// My orders history
router.get('/my-orders', getMyOrders);

// Order creation
router.post('/', createOrder);

// Single order operations
router.get('/:id', getOrderById);
router.get('/:id/receipt', getOrderReceipt);
router.put('/:id/status', updateOrderStatus);

module.exports = router;
