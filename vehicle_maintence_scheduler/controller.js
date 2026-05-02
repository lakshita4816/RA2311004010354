const axios = require('axios');
const { log } = require('../logging_middleware/logger');
const { getAccessToken } = require('../auth/tokenService');

const TEST_SERVER_BASE = 'http://20.207.122.201/evaluation-service';
const DEPOT_API = `${TEST_SERVER_BASE}/depots`;
const VEHICLE_API = `${TEST_SERVER_BASE}/vehicles`;

// Fetch depot info from the test server
async function fetchDepots() {
  try {
    await log('backend', 'info', 'service', 'Fetching depot data from test server');
    const token = await getAccessToken();
    
    const response = await axios.get(DEPOT_API, {
      headers: { Authorization: token }
    });

    await log('backend', 'info', 'service', `Got ${response.data.depots.length} depots from API`);
    return response.data.depots;
  } catch (error) {
    await log('backend', 'error', 'service', `Failed to get depots: ${error.message}`);
    throw new Error('Could not fetch depot data from test server');
  }
}

// Get all vehicles and their maintenance tasks
async function fetchVehicles() {
  try {
    await log('backend', 'info', 'service', 'Pulling vehicle data with maintenance tasks');
    const token = await getAccessToken();
    
    const response = await axios.get(VEHICLE_API, {
      headers: { Authorization: token }
    });

    await log('backend', 'info', 'service', `Retrieved ${response.data.vehicles.length} vehicles from API`);
    return response.data.vehicles;
  } catch (error) {
    await log('backend', 'error', 'service', `Error fetching vehicles: ${error.message}`);
    throw new Error('Could not retrieve vehicle data');
  }
}

// This is the core optimization logic
// We need to pick which maintenance tasks to do given limited time/money
// Think of it like a knapsack - we have X hours available and want maximum impact
// Uses dynamic programming to find the best combination
async function optimizeMaintenanceSchedule(depotId, availableHours, tasks) {
  try {
    await log('backend', 'info', 'service', `Optimizing maintenance for depot ${depotId} with ${availableHours} hours`);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      await log('backend', 'warn', 'service', `No tasks found for depot ${depotId}`);
      return { selectedTasks: [], totalImpact: 0, totalDuration: 0 };
    }

    const allTasks = tasks.map((task) => ({
      taskId: task.TaskID,
      duration: Number(task.Duration),
      impact: Number(task.Impact)
    }));

    await log('backend', 'info', 'service', `Working with ${allTasks.length} tasks from protected API`);

    // Dynamic programming solution to maximize impact within time budget
    // dp[i][w] = max impact using first i tasks with w hours available
    const n = allTasks.length;
    const capacity = Math.floor(availableHours);
    
    const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

    // Fill the DP table - try each task and each possible time allocation
    for (let i = 1; i <= n; i++) {
      const task = allTasks[i - 1];
      for (let w = 0; w <= capacity; w++) {
        // Option 1: Don't do this task
        dp[i][w] = dp[i - 1][w];

        // Option 2: Do this task if we have time
        if (task.duration <= w) {
          dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - task.duration] + task.impact);
        }
      }
    }

    // Backtrack to see which tasks were actually selected
    const selectedTasks = [];
    let remainingTime = capacity;
    
    for (let i = n; i > 0 && remainingTime > 0; i--) {
      if (dp[i][remainingTime] !== dp[i - 1][remainingTime]) {
        const task = allTasks[i - 1];
        selectedTasks.push(task);
        remainingTime -= task.duration;
      }
    }

    const totalImpact = selectedTasks.reduce((sum, task) => sum + task.impact, 0);
    const totalDuration = selectedTasks.reduce((sum, task) => sum + task.duration, 0);

    await log('backend', 'info', 'service', `Done optimizing: ${selectedTasks.length} tasks, Impact: ${totalImpact}, Time: ${totalDuration}h`);

    return { selectedTasks, totalImpact, totalDuration };
  } catch (error) {
    await log('backend', 'error', 'service', `Optimization failed: ${error.message}`);
    throw error;
  }
}

// Get the full optimized schedule for every depot
async function getOptimizedSchedule() {
  try {
    await log('backend', 'info', 'service', 'Generating schedules for all depots');

    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    const schedules = [];

    for (const depot of depots) {
      const optimized = await optimizeMaintenanceSchedule(
        depot.ID,
        depot.MechanicHours,
        vehicles
      );

      schedules.push({
        depotId: depot.ID,
        availableMechanicHours: depot.MechanicHours,
        optimization: optimized
      });
    }

    await log('backend', 'info', 'service', `Schedule generation complete for ${schedules.length} depots`);
    return schedules;
  } catch (error) {
    await log('backend', 'error', 'service', `Failed to generate schedule: ${error.message}`);
    throw error;
  }
}

// Simple wrapper to get all vehicles
async function getAllVehicles() {
  try {
    await log('backend', 'info', 'repository', 'Getting all vehicles');
    return await fetchVehicles();
  } catch (error) {
    await log('backend', 'error', 'repository', `Could not get vehicles: ${error.message}`);
    throw error;
  }
}

// Get a single vehicle by ID
async function getVehicleById(vehicleId) {
  try {
    const vehicles = await fetchVehicles();
    const vehicle = vehicles.find(v => v.TaskID === vehicleId);
    
    if (!vehicle) {
      await log('backend', 'warn', 'repository', `Vehicle ${vehicleId} not found`);
      throw new Error('Vehicle not found');
    }

    await log('backend', 'info', 'repository', `Found task: ${vehicle.TaskID}`);
    return vehicle;
  } catch (error) {
    await log('backend', 'error', 'repository', `Error getting vehicle: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getAllVehicles,
  getVehicleById,
  getOptimizedSchedule,
  fetchDepots,
  fetchVehicles,
  optimizeMaintenanceSchedule
};
