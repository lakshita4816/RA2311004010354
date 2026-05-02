# Backend Evaluation Project

This project implements backend services for the Campus Hiring Evaluation.

## Project Structure

- **logging_middleware/** - Reusable logging middleware for API calls
- **vehicle_maintence_scheduler/** - Vehicle maintenance scheduling service
- **notification_app_be/** - Notification system backend service
- **server.js** - Main Express server entry point

## Setup

1. Install dependencies: `npm install`
2. Create `.env` from `.env.example`
3. Add either:
	- `AUTH_TOKEN` directly, or
	- full credential fields in `.env` so token is fetched automatically
4. Start server: `npm start` (or `npm run dev` for development)

## Technologies

- Node.js
- Express.js
- Logging with structured format

## API Endpoints

Test server APIs are protected and require a Bearer token.

Protected endpoints used by this project:
- auth: `POST /evaluation-service/auth`
- logs: `POST /evaluation-service/logs`
- depots: `GET /evaluation-service/depots`
- vehicles: `GET /evaluation-service/vehicles`
- notifications: `GET /evaluation-service/notifications`

### Logging API
- Structured middleware logs are sent to test server logs API when auth is configured

### Vehicle Maintenance
- GET/POST endpoints for vehicle maintenance scheduling

### Notification System
- APIs for notification management

## Testing

Use Insomnia or Postman to test all endpoints. Include request body, response, and response time in screenshots.

Quick local checks:
- `curl http://localhost:5000/health`
- `curl "http://localhost:5000/api/notification?page=1&limit=5"`
- `curl http://localhost:5000/api/notification/user/1/priority`
- `curl http://localhost:5000/api/vehicle/schedule/optimized`
"# RA2311004010354" 
"# RA2311004010354" 
