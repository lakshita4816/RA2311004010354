const { log } = require('../logging_middleware/logger');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getAccessToken } = require('../auth/tokenService');

const TEST_SERVER_NOTIFICATIONS_API = 'http://20.207.122.201/evaluation-service/notifications';

let notifications = [
  { 
    id: 'd1460a5a-0d86-4a34-9e69-3900a14576bc',
    studentID: 1, 
    type: 'Result', 
    message: 'Your mid-semester results are ready',
    read: false,
    priority: 8,
    createdAt: new Date('2026-04-22T17:51:30Z')
  },
  { 
    id: 'b283218f-ea5a-4b7c-93a9-1f2f240d64b0',
    studentID: 1, 
    type: 'Placement', 
    message: 'CSX Corporation hiring',
    read: false,
    priority: 9,
    createdAt: new Date('2026-04-22T17:51:18Z')
  },
  { 
    id: 'cf2885a6-45ac-4ba0-b548-6e9e9d4c52c8',
    studentID: 1, 
    type: 'Event', 
    message: 'Campus tech-fest registration open',
    read: true,
    priority: 5,
    createdAt: new Date('2026-04-22T17:50:06Z'),
    readAt: new Date('2026-04-22T17:55:00Z')
  }
];

// Simple cache to store frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(type, key) {
  return `${type}:${key}`;
}

function setCache(key, value) {
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}

function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiry) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function invalidateCache(key) {
  cache.delete(key);
}

async function fetchNotificationsFromTestServer() {
  const token = await getAccessToken();
  const response = await axios.get(TEST_SERVER_NOTIFICATIONS_API, {
    headers: { Authorization: token }
  });

  const raw = Array.isArray(response.data.notifications) ? response.data.notifications : [];
  return raw.map((item) => ({
    id: item.ID,
    studentID: 1,
    type: item.Type,
    message: item.Message,
    read: false,
    priority: item.Type === 'Placement' ? 10 : item.Type === 'Result' ? 8 : 6,
    createdAt: new Date(item.Timestamp)
  }));
}

// Get all notifications with pagination
async function getAllNotifications(page = 1, limit = 20) {
  try {
    const cacheKey = getCacheKey('allNotifications', `${page}:${limit}`);
    const cached = getCache(cacheKey);
    
    if (cached) {
      await log('backend', 'info', 'cache', `Cache hit for notifications page ${page}`);
      return cached;
    }

    await log('backend', 'info', 'repository', `Getting notifications (page ${page}, limit ${limit})`);
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedNotifications = notifications.slice(start, end);

    const result = {
      status: 'success',
      data: paginatedNotifications,
      pagination: {
        page,
        limit,
        total: notifications.length,
        totalPages: Math.ceil(notifications.length / limit)
      }
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    await log('backend', 'fatal', 'repository', `Database error: ${error.message}`);
    throw error;
  }
}

// Get all notifications for a specific student
async function getNotificationsByUserId(studentID, unreadOnly = false) {
  try {
    const cacheKey = getCacheKey('userNotifications', `${studentID}:${unreadOnly}`);
    const cached = getCache(cacheKey);
    
    if (cached) {
      await log('backend', 'info', 'cache', `Cache hit for student ${studentID}`);
      return cached;
    }

    await log('backend', 'info', 'repository', `Getting notifications for student ${studentID}`);
    
    let userNotifications = notifications.filter(n => n.studentID === parseInt(studentID));
    
    if (unreadOnly) {
      userNotifications = userNotifications.filter(n => !n.read);
    }

    const result = {
      status: 'success',
      studentID: parseInt(studentID),
      unreadCount: notifications.filter(n => n.studentID === parseInt(studentID) && !n.read).length,
      data: userNotifications
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    await log('backend', 'error', 'repository', `Error getting user notifications: ${error.message}`);
    throw error;
  }
}

// Create a new notification
async function createNotification(studentID, type, message, priority = 5) {
  try {
    if (!['Placement', 'Result', 'Event'].includes(type)) {
      throw new Error('Invalid type. Need: Placement, Result, or Event');
    }

    if (priority < 1 || priority > 10) {
      throw new Error('Priority must be 1-10');
    }

    const newNotification = {
      id: uuidv4(),
      studentID: parseInt(studentID),
      type,
      message,
      read: false,
      priority,
      createdAt: new Date()
    };

    notifications.push(newNotification);

    // Clear cache for this student
    invalidateCache(getCacheKey('userNotifications', `${studentID}:false`));
    invalidateCache(getCacheKey('userNotifications', `${studentID}:true`));

    await log('backend', 'info', 'service', `Created notification for student ${studentID} - ${type} priority ${priority}`);

    return {
      status: 'success',
      message: 'Notification created',
      data: newNotification
    };
  } catch (error) {
    await log('backend', 'error', 'service', `Could not create notification: ${error.message}`);
    throw error;
  }
}

// Create many notifications at once
async function bulkCreateNotifications(studentIds, type, message, priority = 5) {
  try {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new Error('Need a list of student IDs');
    }

    await log('backend', 'info', 'service', `Creating notifications for ${studentIds.length} students`);

    const createdNotifications = [];
    const chunkSize = 1000;

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);

      chunk.forEach(studentID => {
        const notification = {
          id: uuidv4(),
          studentID: parseInt(studentID),
          type,
          message,
          read: false,
          priority,
          createdAt: new Date()
        };

        notifications.push(notification);
        createdNotifications.push(notification);

        invalidateCache(getCacheKey('userNotifications', `${studentID}:false`));
        invalidateCache(getCacheKey('userNotifications', `${studentID}:true`));
      });

      await log('backend', 'info', 'service', `Processed chunk ${Math.floor(i / chunkSize) + 1}`);
    }

    cache.forEach((_, key) => {
      if (key.startsWith('allNotifications:')) {
        cache.delete(key);
      }
    });

    await log('backend', 'info', 'service', `Bulk done: ${createdNotifications.length} created`);

    return {
      status: 'success',
      message: 'Bulk notifications created',
      data: {
        created: createdNotifications.length,
        failed: 0,
        timestamp: new Date()
      }
    };
  } catch (error) {
    await log('backend', 'error', 'service', `Bulk notification failed: ${error.message}`);
    throw error;
  }
}

// Mark a notification as read
async function markAsRead(notificationId) {
  try {
    const notification = notifications.find(n => n.id === notificationId);

    if (!notification) {
      await log('backend', 'warn', 'repository', `Notification not found: ${notificationId}`);
      throw new Error('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();

    invalidateCache(getCacheKey('userNotifications', `${notification.studentID}:false`));
    invalidateCache(getCacheKey('userNotifications', `${notification.studentID}:true`));
    invalidateCache(getCacheKey('priorityInbox', notification.studentID));

    await log('backend', 'info', 'service', `Marked as read: ${notificationId}`);

    return {
      status: 'success',
      message: 'Marked as read',
      data: notification
    };
  } catch (error) {
    await log('backend', 'error', 'service', `Could not mark as read: ${error.message}`);
    throw error;
  }
}

// Calculate how important a notification is
function calculatePriorityScore(notification) {
  const typeWeights = { 'Placement': 3, 'Result': 2, 'Event': 1 };

  const daysSince = (Date.now() - notification.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0.5, 1 / (1 + daysSince / 7));

  const score = typeWeights[notification.type] * recencyFactor * (notification.priority / 10);

  return Math.round(score * 100) / 100;
}

// Get top 10 most important notifications
async function getPriorityInbox(studentID) {
  try {
    const cacheKey = getCacheKey('priorityInbox', studentID);
    const cached = getCache(cacheKey);
    
    if (cached) {
      await log('backend', 'info', 'cache', `Cache hit for priority inbox ${studentID}`);
      return cached;
    }

    await log('backend', 'info', 'service', `Calculating priority inbox for student ${studentID}`);

    let sourceNotifications = notifications;

    // Stage 6 asks to use protected Notification API for task data.
    // If auth is configured, prefer live notifications; otherwise keep local fallback.
    try {
      sourceNotifications = await fetchNotificationsFromTestServer();
      await log('backend', 'info', 'service', 'Using live notifications from protected test API');
    } catch (apiError) {
      await log('backend', 'warn', 'service', `Live notifications unavailable, fallback to local data: ${apiError.message}`);
    }

    const userNotifications = sourceNotifications.filter(n =>
      n.studentID === parseInt(studentID) && !n.read
    );

    const scored = userNotifications.map(n => ({
      ...n,
      calculatedPriority: calculatePriorityScore(n),
      weight: { 'Placement': 3, 'Result': 2, 'Event': 1 }[n.type]
    }));

    const topPriority = scored
      .sort((a, b) => b.calculatedPriority - a.calculatedPriority)
      .slice(0, 10);

    const result = {
      status: 'success',
      studentID: parseInt(studentID),
      count: topPriority.length,
      data: topPriority
    };

    setCache(cacheKey, result);
    await log('backend', 'info', 'service', `Top 10 inbox with ${topPriority.length} items`);

    return result;
  } catch (error) {
    await log('backend', 'error', 'service', `Priority inbox error: ${error.message}`);
    throw error;
  }
}

// Delete a notification
async function deleteNotification(notificationId) {
  try {
    const index = notifications.findIndex(n => n.id === notificationId);

    if (index === -1) {
      await log('backend', 'warn', 'repository', `Notification not found: ${notificationId}`);
      throw new Error('Notification not found');
    }

    const deleted = notifications[index];
    notifications.splice(index, 1);

    invalidateCache(getCacheKey('userNotifications', `${deleted.studentID}:false`));
    invalidateCache(getCacheKey('userNotifications', `${deleted.studentID}:true`));
    invalidateCache(getCacheKey('priorityInbox', deleted.studentID));

    await log('backend', 'info', 'service', `Deleted: ${notificationId}`);

    return {
      status: 'success',
      message: 'Deleted'
    };
  } catch (error) {
    await log('backend', 'error', 'service', `Could not delete: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getAllNotifications,
  getNotificationsByUserId,
  createNotification,
  bulkCreateNotifications,
  markAsRead,
  getPriorityInbox,
  deleteNotification
};
