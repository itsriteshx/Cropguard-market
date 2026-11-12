const express = require('express');
const router = express.Router();

const {
  createListing,
  getAllListings,
  getListingById,
  getMyListings,
  updateListing,
  deleteListing
} = require('../controllers/listingController');

const { protect, authorize, optionalProtect } = require('../middleware/authMiddleware');
const { sanitizeParams } = require('../middleware/securityMiddleware');

// Public listing browsing & farmer protected creation
router
  .route('/')
  .get(optionalProtect, getAllListings)
  .post(protect, authorize('FARMER', 'ADMIN'), createListing);

// Logged-in farmer's inventory
router
  .route('/my-listings')
  .get(protect, authorize('FARMER', 'ADMIN'), getMyListings);

// Single listing operations - sanitize route params after route matching
router.use('/:id', sanitizeParams);
router
  .route('/:id')
  .get(getListingById)
  .put(protect, authorize('FARMER', 'ADMIN'), updateListing)
  .delete(protect, authorize('FARMER', 'ADMIN'), deleteListing);

module.exports = router;
