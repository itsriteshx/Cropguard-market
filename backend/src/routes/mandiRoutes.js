const express = require('express');
const router = express.Router();

const {
  getMandiRates,
  getLiveAgmarknetRates,
  getDistrictWeather,
  lookupPincode,
  getBenchmarkForCrop,
  getMandiAnalytics,
  getMandiPriceTrends,
  getMandiMarketComparison
} = require('../controllers/mandiController');

// Live external Agmarknet, Open-Meteo Weather & India Post Pincode APIs
router.get('/live', getLiveAgmarknetRates);
router.get('/weather', getDistrictWeather);
router.get('/pincode/:pincode', lookupPincode);

// Analytics aggregation endpoint
router.get('/analytics', getMandiAnalytics);
router.get('/analytics/trends', getMandiPriceTrends);
router.get('/analytics/markets', getMandiMarketComparison);

// Benchmark guidance endpoint (must be defined before /:id style routes)
router.get('/benchmark', getBenchmarkForCrop);

// Query all APMC rates with filters
router.get('/', getMandiRates);


module.exports = router;
