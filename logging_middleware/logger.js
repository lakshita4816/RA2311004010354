const axios = require('axios');
const { getAccessToken } = require('../auth/tokenService');

const LOG_API_URL = 'http://20.207.122.201/evaluation-service/logs';

// Main logging function - handles all structured logging across the app
// Takes stack type, severity level, which module it came from, and the actual message
async function log(stack, level, packageName, message) {
  try {
    const logEntry = {
      stack,
      level,
      package: packageName,
      message
    };

    process.stdout.write(`[${level.toUpperCase()}] [${packageName}] ${message}\n`);

    // Push logs to protected test API when auth is configured.
    try {
      const token = await getAccessToken();
      await axios.post(LOG_API_URL, logEntry, {
        headers: { Authorization: token }
      });
    } catch (apiError) {
      // Keep app flow safe even when external log API is unavailable.
      process.stderr.write(`Log API skipped: ${apiError.message}\n`);
    }

    return { status: 'logged' };
  } catch (err) {
    process.stderr.write(`Log error: ${err.message}\n`);
  }
}

// Middleware to track requests - times how long each endpoint takes
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  const originalJson = res.json;

  res.json = function(data) {
    const duration = Date.now() - startTime;
    const message = `${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`;
    
    log('backend', 'info', 'middleware', message);
    
    return originalJson.call(this, data);
  };

  next();
};

// Catch and log any errors that happen
const errorLogger = (err, req, res, next) => {
  const message = `${err.message} at ${req.path}`;
  
  log('backend', 'error', 'handler', message);

  res.status(err.status || 500).json({
    error: err.message,
    path: req.path,
    timestamp: new Date()
  });
};

module.exports = {
  log,
  requestLogger,
  errorLogger
};
