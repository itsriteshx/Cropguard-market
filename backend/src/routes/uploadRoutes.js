const express = require('express');
const router = express.Router();

const { uploadProduceImages } = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Route: POST /api/upload (accepts array of images with field name 'photos' or 'image')
router.post(
  '/',
  protect,
  authorize('FARMER', 'ADMIN'),
  upload.array('photos', 5),
  uploadProduceImages
);

module.exports = router;
