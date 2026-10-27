const express = require('express');
const router = express.Router();

const {
  getMandiRates,
  getBenchmarkForCrop
} = require('../controllers/mandiController');

// Benchmark guidance endpoint (must be defined before /:id style routes)
router.get('/benchmark', getBenchmarkForCrop);

// Query all APMC rates with filters
router.get('/', getMandiRates);

module.exports = router;
