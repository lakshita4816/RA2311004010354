# Notification System Design

## Stage 1: API Contract

### Endpoints
- GET /api/notification?page=1&limit=20
- GET /api/notification/user/:userId?unreadOnly=true
- GET /api/notification/user/:userId/priority
- POST /api/notification
- POST /api/notification/bulk
- PUT /api/notification/:notificationId/read
- DELETE /api/notification/:notificationId

### Notification JSON shape
```json
{
  "id": "uuid",
  "studentID": 1042,
  "type": "Placement",
  "message": "CSX Corporation hiring",
  "read": false,
  "priority": 9,
  "createdAt": "2026-04-22T17:51:18.000Z",
  "readAt": "2026-04-22T18:00:00.000Z"
}
```

### Type rules
- type accepts: Placement, Result, Event
- priority range: 1 to 10

## Stage 2: DB Choice and Schema

### Suggested DB
PostgreSQL.

Why:
- reliable ACID writes for notification creation and read updates
- fast filtered queries with composite indexes
- simple horizontal scaling path with read replicas and partitioning

### Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  student_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Placement', 'Result', 'Event')),
  message VARCHAR(500) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP NULL
);

CREATE INDEX idx_notifications_student_read_created
ON notifications(student_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_type_created
ON notifications(type, created_at DESC);
```

## Stage 3: Query Review and Fix

Given query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

Issues:
- uses SELECT * so unnecessary columns are fetched
- without a matching composite index, it can scan too much data
- no LIMIT means more rows and larger sort cost

Better query:
```sql
SELECT id, student_id, type, message, priority, created_at, is_read
FROM notifications
WHERE student_id = 1042
  AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```

Query for students who got Placement notification in last 7 days:
```sql
SELECT DISTINCT student_id
FROM notifications
WHERE type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

## Stage 4: Page-load Performance Plan

Problem: page load fetches notifications every time and DB is overloaded.

Solution:
- add Redis cache per student: notifications:student:{id}:unread
- cache TTL: 60 to 300 seconds
- invalidate cache on create/read/delete for that student
- use cursor pagination instead of deep offset for large pages

Tradeoffs:
- cache adds complexity and stale-data risk
- strong consistency is maintained by targeted invalidation

## Stage 5: Reliable Notify All

Naive loop is slow and not reliable.

Better design:
1. persist notification intent first (DB write)
2. enqueue delivery jobs (email and in-app) in message queue
3. worker retries failed email jobs with backoff
4. track per-student delivery status

Revised pseudocode:
```text
create notification_batch row
for each chunk of student_ids (size 1000):
  bulk insert notification rows
  enqueue email jobs for chunk
  enqueue app jobs for chunk
workers process jobs in parallel with retry and dead-letter queue
```

Why DB save and email should not be one single blocking step:
- saving notification is source of truth
- email is external I/O and can fail transiently
- queue-based delivery gives reliability and speed

## Stage 6: Priority Inbox Top 10

Goal: always show top n unread by weighted priority and recency.

Weight model:
- Placement: 3
- Result: 2
- Event: 1

Score idea:
- score = type_weight * priority * recency_factor
- recency_factor decays with age so recent notifications stay on top

Implementation approach:
- fetch unread notifications for the student
- compute score in app layer
- sort descending
- return first 10

For continuous incoming notifications:
- maintain a min-heap of size 10 per user in cache
- update heap when a new unread notification arrives
- rebuild heap on cache miss

## Logging Integration

Every API handler and service call uses logging middleware format:
```text
log(stack, level, package, message)
```

Examples used in this project:
- stack: backend
- levels: info, warn, error
- packages: route, service, repository, cache, middleware
