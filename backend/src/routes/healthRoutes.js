const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ProduceListing = require('../models/ProduceListing');
const Order = require('../models/Order');
const User = require('../models/User');
const MandiRate = require('../models/MandiRate');

// @route   GET /api/health
// @desc    Check server and database status
router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    success: true,
    service: 'CropGuard Market Backend',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// @route   GET /api/health/stats
// @desc    Public live marketplace telemetry aggregated directly from MongoDB
router.get('/stats', async (req, res, next) => {
  try {
    const [listingAgg, orderAgg, farmersCount, mandiCount] = await Promise.all([
      ProduceListing.aggregate([
        { $match: { status: { $in: ['AVAILABLE', 'UNDER_NEGOTIATION'] } } },
        {
          $group: {
            _id: null,
            activeLots: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' }
          }
        }
      ]),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalVolumeRupees: { $sum: '$totalAmount' },
            totalMiddlemanSaved: { $sum: '$middlemanFeeSaved' }
          }
        }
      ]),
      User.countDocuments({ role: 'FARMER' }),
      MandiRate.countDocuments({})
    ]);

    const listingsStats = listingAgg[0] || { activeLots: 0, totalQuantity: 0 };
    const orderStats = orderAgg[0] || { totalOrders: 0, totalVolumeRupees: 0, totalMiddlemanSaved: 0 };

    res.status(200).json({
      success: true,
      stats: {
        activeLots: listingsStats.activeLots,
        totalAvailableQuintals: listingsStats.totalQuantity,
        totalAvailableMetricTons: Math.round((listingsStats.totalQuantity / 10) * 10) / 10,
        activeFarmersCount: farmersCount,
        mandiRatesTrackedCount: mandiCount,
        totalOrdersCount: orderStats.totalOrders,
        totalDirectVolumeRupees: orderStats.totalVolumeRupees,
        totalMiddlemanSavedRupees: orderStats.totalMiddlemanSaved
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
