const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field "${err.path}": ${err.value}`;
  }

  // 2. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ') || 'Validation failed';
  }

  // 3. MongoDB Duplicate Key (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. Please use another value.`;
  }

  // 4. Multer Upload Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds maximum allowable limit of 5MB';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded. Maximum allowed is 5 photos';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected upload field "${err.field}". Use the specified field name.`;
    } else if (err.code === 'LIMIT_FILE_TYPE') {
      message = err.message || 'Invalid file type! Please upload only image files (jpg, jpeg, png, webp).';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // 5. Malformed JSON Body (SyntaxError from express.json body-parser)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
  }

  // 6. Payload Too Large (Express body-parser entity.too.large)
  if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    message = 'Request payload exceeds allowable size limit';
  }

  // 7. Sanitize 500 errors in production to avoid leaking database internals or secrets
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  console.error(`[Error] ${req.method} ${req.originalUrl || req.url}:`, err.message);

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
