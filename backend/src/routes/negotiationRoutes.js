const express = require('express');
const router = express.Router();

const {
  startNegotiation,
  counterOffer,
  acceptDeal,
  rejectDeal,
  getMyNegotiations,
  getNegotiationById
} = require('../controllers/negotiationController');

const { protect } = require('../middleware/authMiddleware');

// All negotiation routes require JWT authentication
router.use(protect);

router.post('/', startNegotiation);
router.get('/my', getMyNegotiations);
router.get('/:id', getNegotiationById);
router.post('/:id/counter', counterOffer);
router.post('/:id/accept', acceptDeal);
router.post('/:id/reject', rejectDeal);

module.exports = router;
