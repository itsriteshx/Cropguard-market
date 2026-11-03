const express = require('express');
const router = express.Router();

const {
  getMandiRates,
  getBenchmarkForCrop,
  getMandiAnalytics
} = require('../controllers/mandiController');

// Analytics aggregation endpoint
router.get('/analytics', getMandiAnalytics);

// Benchmark guidance endpoint (must be defined before /:id style routes)
router.get('/benchmark', getBenchmarkForCrop);

// Query all APMC rates with filters
router.get('/', getMandiRates);

module.exports = router;
