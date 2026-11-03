const express = require('express');
const router = express.Router();

const {
  getAuditLogs,
  getAuditSummary
} = require('../controllers/auditController');

// Statutory Fair-Trade compliance summary
router.get('/summary', getAuditSummary);

// Transparent audit logs query
router.get('/', getAuditLogs);

module.exports = router;
