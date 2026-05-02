const express = require('express');
const router = express.Router();
const { log } = require('../logging_middleware/logger');
const vehicleController = require('./controller');

/**
 * Vehicle Maintenance Scheduler Routes
 */

// GET all vehicles from test server
router.get('/', async (req, res) => {
  try {
    await log('backend', 'info', 'route', 'Fetching all vehicles from test server');
    const vehicles = await vehicleController.getAllVehicles();
    res.status(200).json({ vehicles });
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching vehicles: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET optimized maintenance schedule for all depots
router.get('/schedule/optimized', async (req, res) => {
  try {
    await log('backend', 'info', 'route', 'Requesting optimized maintenance schedule');
    const schedule = await vehicleController.getOptimizedSchedule();
    
    res.status(200).json({
      status: 'success',
      message: 'Optimized maintenance schedule generated',
      data: schedule
    });
  } catch (error) {
    await log('backend', 'error', 'route', `Error generating optimized schedule: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET depots with mechanic hours
router.get('/depots/list', async (req, res) => {
  try {
    await log('backend', 'info', 'route', 'Fetching depots with mechanic hours');
    const depots = await vehicleController.fetchDepots();
    
    res.status(200).json({
      status: 'success',
      depots: depots
    });
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching depots: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET vehicle by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await log('backend', 'info', 'route', `Fetching vehicle with ID: ${id}`);
    const vehicle = await vehicleController.getVehicleById(id);
    res.status(200).json({ vehicle });
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching vehicle: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
