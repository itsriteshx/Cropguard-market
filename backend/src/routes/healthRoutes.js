const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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

module.exports = router;
