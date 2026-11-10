const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all statutory audit log entries with optional filters
 * @route   GET /api/audit
 * @access  Public (Transparent Public Khata / Mandi Authority)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, targetEntity, limit = 20, page = 1 } = req.query;

    const query = {};
    if (action) query.action = action.toUpperCase();
    if (targetEntity) query.targetEntity = targetEntity.toUpperCase();

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actor', 'name phone role location')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Fair-Trade and APMC statutory compliance summary metrics
 * @route   GET /api/audit/summary
 * @access  Public
 */
const getAuditSummary = async (req, res, next) => {
  try {
    const aggregate = await AuditLog.aggregate([
      {
        $group: {
          _id: null,
          totalMiddlemanSaved: { $sum: '$financialSnapshot.middlemanFeeSaved' },
          totalDirectVolumeRupees: { $sum: '$financialSnapshot.dealAmount' },
          verifiedCount: { $sum: { $cond: ['$isVerified', 1, 0] } },
          totalLogs: { $sum: 1 }
        }
      }
    ]);

    const summary = aggregate[0] || {
      totalMiddlemanSaved: 0,
      totalDirectVolumeRupees: 0,
      verifiedCount: 0,
      totalLogs: 0
    };

    const complianceRate = summary.totalLogs > 0
      ? `${Math.round((summary.verifiedCount / summary.totalLogs) * 100)}%`
      : '0%';

    return res.status(200).json({
      success: true,
      metrics: {
        totalMiddlemanSaved: summary.totalMiddlemanSaved,
        totalDirectVolumeRupees: summary.totalDirectVolumeRupees,
        complianceRate,
        directFarmerMarginRetained: summary.totalDirectVolumeRupees > 0 ? '+10.0%' : '0.0%',
        verifiedTransactionsCount: summary.verifiedCount,
        totalAuditLogsCount: summary.totalLogs,
        governingBodies: ['Ministry of Agriculture & Farmers Welfare', 'UASD Dharwad APMC Cell', 'ICAR']
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditSummary
};
