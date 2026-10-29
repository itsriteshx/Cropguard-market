const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const initNegotiationSocket = require('./sockets/negotiationSocket');

// Initialize Express App & HTTP Server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io Server with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Attach io instance to Express app for controller access
app.set('io', io);

// Initialize WebSocket Negotiation Gateway
initNegotiationSocket(io);

// Connect to MongoDB Atlas
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Static files for local image uploads in dev
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/mandi-rates', mandiRoutes);
app.use('/api/negotiations', negotiationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

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
server.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
  console.log(`Socket.io Gateway active on /negotiation`);
});
