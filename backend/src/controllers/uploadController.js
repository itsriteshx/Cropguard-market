const { uploadToCloudinaryOrDisk } = require('../config/cloudinary');

/**
 * Deep structural validation for JPEG, PNG, and WebP buffers.
 * Enforces magic-byte verification and verifies internal container integrity
 * to reject truncated, corrupted, or synthetic image files without requiring external C-bindings.
 */
const validateImageStructure = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, reason: 'File buffer is missing, empty, or too small to be a valid image' };
  }

  // 1. JPEG Validation: SOI (FF D8 FF), segment boundary traversal, and EOI (FF D9)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    // Scan backwards from the end of the buffer (within last 64 bytes) for EOI marker
    let eoiFound = false;
    const scanLimit = Math.max(0, buffer.length - 64);
    for (let i = buffer.length - 2; i >= scanLimit; i--) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) {
        eoiFound = true;
        break;
      }
    }

    if (!eoiFound) {
      return { valid: false, reason: 'Malformed or truncated JPEG: missing End-of-Image (EOI) marker' };
    }

    // Traverse JPEG segment headers
    let offset = 2;
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) {
        break;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd9) {
        break;
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (offset + 4 > buffer.length) {
        return { valid: false, reason: 'Truncated JPEG segment header' };
      }
      const segmentLen = buffer.readUInt16BE(offset + 2);
      if (segmentLen < 2 || offset + 2 + segmentLen > buffer.length) {
        return { valid: false, reason: 'Malformed JPEG: segment length exceeds buffer boundaries' };
      }
      if (marker === 0xda) {
        // Start of Scan: entropy data follows until EOI
        break;
      }
      offset += 2 + segmentLen;
    }

    return { valid: true, format: 'JPEG' };
  }

  // 2. PNG Validation: 8-byte signature, chunk hierarchy starting with IHDR and terminating with IEND
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    let offset = 8;
    let hasIHDR = false;
    let hasIEND = false;

    while (offset + 8 <= buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);

      if (offset === 8 && chunkType !== 'IHDR') {
        return { valid: false, reason: 'Malformed PNG: first chunk must be IHDR' };
      }
      if (chunkType === 'IHDR') hasIHDR = true;

      const totalChunkSize = 8 + chunkLen + 4; // length + type + data + crc
      if (offset + totalChunkSize > buffer.length) {
        return { valid: false, reason: `Malformed or truncated PNG chunk "${chunkType}"` };
      }

      if (chunkType === 'IEND') {
        hasIEND = true;
        break;
      }

      offset += totalChunkSize;
    }

    if (!hasIHDR) {
      return { valid: false, reason: 'Malformed PNG: missing IHDR header chunk' };
    }
    if (!hasIEND) {
      return { valid: false, reason: 'Malformed or truncated PNG: missing IEND termination chunk' };
    }

    return { valid: true, format: 'PNG' };
  }

  // 3. WebP Validation: RIFF container, WEBP fourcc, declared size check, valid VP8 chunk
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const riffSize = buffer.readUInt32LE(4);
    // Buffer must hold at least the declared RIFF payload
    if (buffer.length < riffSize + 8) {
      return {
        valid: false,
        reason: `Truncated WebP file: declared RIFF size (${riffSize + 8} bytes) exceeds buffer (${buffer.length} bytes)`
      };
    }

    if (buffer.length < 20) {
      return { valid: false, reason: 'Truncated WebP chunk header' };
    }

    const chunkType = buffer.toString('ascii', 12, 16);
    if (!['VP8 ', 'VP8L', 'VP8X'].includes(chunkType)) {
      return { valid: false, reason: `Invalid or unrecognized WebP chunk type "${chunkType}"` };
    }

    const chunkLen = buffer.readUInt32LE(16);
    if (12 + 8 + chunkLen > buffer.length) {
      return { valid: false, reason: `Truncated WebP chunk "${chunkType}": payload exceeds buffer boundaries` };
    }

    return { valid: true, format: 'WEBP' };
  }

  return { valid: false, reason: 'Unsupported or unidentifiable image format (not genuine JPEG, PNG, or WebP)' };
};

/**
 * Convenience boolean check for image buffer validity
 */
const isValidImageBuffer = (buffer) => {
  return validateImageStructure(buffer).valid;
};

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

    // Verify magic bytes and deep structural validity for each file before processing
    for (const file of files) {
      const validation = validateImageStructure(file.buffer);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `File content for "${file.originalname}" is invalid: ${validation.reason}`
        });
      }
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
  uploadProduceImages,
  isValidImageBuffer,
  validateImageStructure
};
