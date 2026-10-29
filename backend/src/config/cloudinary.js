const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const isCloudinaryConfigured = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
  );
};

/**
 * Upload buffer to Cloudinary or fallback to local disk storage
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original file name
 * @returns {Promise<{ url: string, public_id: string }>}
 */
const uploadToCloudinaryOrDisk = async (buffer, originalname) => {
  if (isCloudinaryConfigured()) {
    // Production Cloudinary CDN upload
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'cropguard/produce',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            public_id: result.public_id
          });
        }
      );
      stream.end(buffer);
    });
  }

  // Development Fallback: Save to local public/uploads directory
  const uploadsDir = path.resolve(__dirname, '../../public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(originalname) || '.jpg';
  const filename = `produce-${uniqueSuffix}${ext}`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, buffer);

  const localUrl = `/uploads/${filename}`;
  return {
    url: localUrl,
    public_id: filename
  };
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinaryOrDisk
};
