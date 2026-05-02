const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Import logging middleware
const { requestLogger, errorLogger } = require('./logging_middleware/logger');
app.use(requestLogger);

// Import routes
const vehicleRoutes = require('./vehicle_maintence_scheduler/routes');
const notificationRoutes = require('./notification_app_be/routes');

// Routes
app.use('/api/vehicle', vehicleRoutes);
app.use('/api/notification', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running', timestamp: new Date() });
});

// Error handling middleware
app.use(errorLogger);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Start server
app.listen(PORT, () => {
  const startupMessage = `Server running on port ${PORT} at ${new Date().toISOString()}`;
  process.stdout.write(`${startupMessage}\n`);
});

module.exports = app;
