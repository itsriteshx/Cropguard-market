const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const mandiRoutes = require('./routes/mandiRoutes');
const negotiationRoutes = require('./routes/negotiationRoutes');

// Initialize Express App
const app = express();

// Connect to MongoDB Atlas
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/mandi-rates', mandiRoutes);
app.use('/api/negotiations', negotiationRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'CropGuard Market API Gateway',
    status: 'online',
    healthCheck: '/api/health'
  });
});

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});
