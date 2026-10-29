const { uploadToCloudinaryOrDisk } = require('../config/cloudinary');

/**
 * @desc    Upload produce photos (Single or Multiple)
 * @route   POST /api/upload
 * @access  Private (FARMER or ADMIN)
 */
const uploadProduceImages = async (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one image file to upload'
      });
    }

    // Upload all files in parallel
    const uploadPromises = files.map((file) =>
      uploadToCloudinaryOrDisk(file.buffer, file.originalname)
    );

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      message: `${results.length} image(s) uploaded successfully`,
      count: results.length,
      images: results.map((r) => r.url),
      details: results
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProduceImages
};
