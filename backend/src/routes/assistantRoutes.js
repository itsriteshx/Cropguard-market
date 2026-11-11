const express = require('express');
const router = express.Router();

const { processAssistantQuery } = require('../controllers/assistantController');
const { protect } = require('../middleware/authMiddleware');

router.post('/query', protect, processAssistantQuery);

module.exports = router;

