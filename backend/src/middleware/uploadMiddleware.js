const multer = require('multer');

// Memory storage to process in-memory buffers
const storage = multer.memoryStorage();

// File filter: accept only image MIME types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type! Please upload only image files (jpg, jpeg, png, webp).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 5 // Maximum 5 produce photos per upload
  }
});

module.exports = upload;
