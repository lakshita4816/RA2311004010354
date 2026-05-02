const express = require('express');
const router = express.Router();
const { log } = require('../logging_middleware/logger');
const notificationController = require('./controller');

/**
 * Notification System Routes - All Stages (1-6)
 */

/**
 * STAGE 1: GET /api/notification
 * Retrieve all notifications (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    await log('backend', 'info', 'route', `Fetching all notifications - page ${page}, limit ${limit}`);
    const result = await notificationController.getAllNotifications(page, limit);
    
    res.status(200).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching notifications: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * STAGE 1: GET /api/notification/user/:userId
 * Retrieve notifications for a specific student
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadOnly = req.query.unreadOnly === 'true';

    await log('backend', 'info', 'route', `Fetching notifications for student ${userId}, unreadOnly=${unreadOnly}`);
    const result = await notificationController.getNotificationsByUserId(userId, unreadOnly);
    
    res.status(200).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching user notifications: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * STAGE 6: GET /api/notification/user/:userId/priority
 * Retrieve priority inbox (top 10 notifications)
 */
router.get('/user/:userId/priority', async (req, res) => {
  try {
    const { userId } = req.params;

    await log('backend', 'info', 'route', `Fetching priority inbox for student ${userId}`);
    const result = await notificationController.getPriorityInbox(userId);

    res.status(200).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error fetching priority inbox: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * STAGE 1: POST /api/notification
 * Create a single notification
 */
router.post('/', async (req, res) => {
  try {
    const { studentID, type, message, priority } = req.body;

    // Validation
    if (!studentID || !type || !message) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required fields: studentID, type, message'
      });
    }

    await log('backend', 'info', 'route', `Creating notification for student ${studentID}, type: ${type}`);
    const result = await notificationController.createNotification(
      studentID,
      type,
      message,
      priority || 5
    );

    res.status(201).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error creating notification: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * STAGE 5: POST /api/notification/bulk
 * Create notifications for multiple students
 */
router.post('/bulk', async (req, res) => {
  try {
    const { studentIDs, type, message, priority } = req.body;

    // Validation
    if (!Array.isArray(studentIDs) || studentIDs.length === 0 || !type || !message) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing or invalid fields: studentIDs (array), type, message'
      });
    }

    await log('backend', 'info', 'route', `Starting bulk notification for ${studentIDs.length} students`);
    const result = await notificationController.bulkCreateNotifications(
      studentIDs,
      type,
      message,
      priority || 5
    );

    res.status(201).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error in bulk notification: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * STAGE 4: PUT /api/notification/:notificationId/read
 * Mark notification as read
 */
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await log('backend', 'info', 'route', `Marking notification ${notificationId} as read`);
    const result = await notificationController.markAsRead(notificationId);

    res.status(200).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error marking notification as read: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * DELETE /api/notification/:notificationId
 * Delete a notification
 */
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await log('backend', 'info', 'route', `Deleting notification: ${notificationId}`);
    const result = await notificationController.deleteNotification(notificationId);

    res.status(200).json(result);
  } catch (error) {
    await log('backend', 'error', 'route', `Error deleting notification: ${error.message}`);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

module.exports = router;
