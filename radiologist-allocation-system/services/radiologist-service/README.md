# Radiologist Service

## Build & run (local)
1. copy `.env.example` to `.env` and fill values (JWT_SECRET etc)
2. npm install
3. npm run migrate    # creates tables and seeds a sample account
4. npm start

## Docker
- Build: `docker build -t radiologist-service:local .`
- Run (example): `docker run --env-file .env -p 8090:8090 radiologist-service:local`

## Endpoints (examples)
- POST /api/auth/login -> { email, password }
- POST /api/availability (Authorization: Bearer <token>)
- GET /api/availability (Authorization)
- POST /api/leaves
- GET /api/assignments
