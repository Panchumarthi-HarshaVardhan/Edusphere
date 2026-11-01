# EduSphere

EduSphere is a multi-institution educational portal with Student, Faculty, and Admin portals. It provides study materials, classroom canvases, attendance and marks, scheduling, announcements, and institution administration. Backend data is scoped by institution.

## Stack and layout

- `client/`: React, TypeScript, Vite, Tailwind CSS, React Router, Axios, and Recharts.
- `server/`: Node.js, TypeScript, Express, Zod, JWT access/refresh authentication, and Nodemailer.
- `server/prisma/`: MongoDB Prisma schema and seed helper.
- `server/src/`: routes, controllers, middleware, and services.
- `.github/workflows/ci.yml`: install, lint, type checks, MongoDB schema setup, tests, and builds.

## Prerequisites

- Node.js 22 and npm.
- Local MongoDB 8 replica set, or Docker Desktop / Docker Engine with the Compose plugin.
- Git.

## Local setup with Docker Compose

1. Create local environment files from the safe templates:

   ```sh
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   Keep `.env` files out of version control. The server template is configured for local MongoDB, local Vite, and email log-only mode. Replace the JWT values with independent random strings of at least 32 characters before any non-development use.

2. Start MongoDB, synchronize the Prisma schema, and start the API and web client:

   ```sh
   docker compose up --build
   ```

   Compose runs a single-node MongoDB replica set and uses `prisma db push` to create collections and indexes. Open <http://localhost:8080>; the API health endpoint is <http://localhost:5000/health>. The first run creates an empty database. In another terminal, load the development seed data:

   ```sh
   docker compose exec server npm run seed
   ```

   The seed helper creates a demo institution and users. Its demo credentials are for local development only; change them before sharing a running instance.

3. Stop services with `docker compose down`. Add `-v` only if you intentionally want to remove local database and upload data.

## Run without Docker for the app

Start a local MongoDB replica set, set `DATABASE_URL` in `server/.env`, install dependencies, synchronize the schema, and seed:

For a host MongoDB install, start a single-node replica set (transactions require it), then initialize it once:

```sh
mkdir -p ./data/mongodb
mongod --dbpath ./data/mongodb --bind_ip 127.0.0.1 --port 27018 --replSet rs0
```

In another terminal, run `mongosh --host 127.0.0.1:27018 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27018"}]})'`. Keep the MongoDB process running while the app is in use.

```sh
cd server
npm ci
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

In another terminal, install and run the Vite client:

```sh
cd client
npm ci
npm run dev
```

The development client runs at <http://localhost:5173> and proxies `/api` to the server at port 5000. `client/.env.example` defaults `VITE_API_URL` to `/api`. When the client is hosted separately, set `VITE_API_URL` to the public API origin ending in `/api`.

## Environment variables

### Server (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | API listen port (default `5000`). |
| `NODE_ENV` | `development`, `test`, or `production`. Production requires email SMTP configuration and strong JWT secrets. |
| `DATABASE_URL` | MongoDB connection string; transactions require a replica set. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Independent secrets of at least 32 characters outside development. |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | JWT lifetime strings. |
| `CLIENT_URL`, `CORS_ORIGINS` | Allowed browser origins. `CORS_ORIGINS` accepts comma-separated origins. |
| `TRUST_PROXY` | Set `true` only when deployed behind a trusted reverse proxy; enables client IP handling for rate limits. |
| `EMAIL_MODE` | `log` writes queued mail to application logs; `smtp` sends via SMTP. Defaults to `log` locally and `smtp` in production. |
| `EMAIL_PROVIDER`, `EMAIL_FROM` | SMTP provider (`smtp`, `resend`, or `sendgrid`) and sender address. |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` | Generic SMTP configuration. |
| `EMAIL_API_KEY` | Resend or SendGrid SMTP credential. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE` | Optional S3-compatible file storage. Without credentials/bucket, local `server/uploads` storage is used. |
| `DATABASE_URL_TEST` | Separate database URL ending in `_test`, used by the integration test setup. Never point it at development or production data. |

Copy the committed `server/.env.example`; do not commit a populated `.env`.

### Client (`client/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL ending in `/api`; `/api` works with Vite proxy and Docker Nginx proxy. Vite environment values are bundled into public client code, so never put secrets here. |

## Commands

Run commands from the relevant application directory.

| Task | Command |
| --- | --- |
| Install backend dependencies | `cd server && npm ci` |
| Install frontend dependencies | `cd client && npm ci` |
| Generate Prisma Client | `cd server && npm run prisma:generate` |
| Create/synchronize MongoDB collections and indexes | `cd server && npm run prisma:push` |
| Seed local data | `cd server && npm run seed` |
| Run API in watch mode | `cd server && npm run dev` |
| Run client in dev mode | `cd client && npm run dev` |
| Lint | `cd server && npm run lint`; `cd client && npm run lint` |
| Type check | `cd server && npm run typecheck`; `cd client && npm run typecheck` |
| Backend unit tests | `cd server && npm run test:unit` |
| Backend integration tests | Configure a separate `DATABASE_URL_TEST`, then `cd server && npm test` |
| Build | `cd server && npm run build`; `cd client && npm run build` |

The integration test command requires a disposable MongoDB database whose name ends in `_test`. Copy `server/.env.test.example` to `server/.env.test`, make sure the local MongoDB replica set is running, and run `npm test`.

Install both `server` and `client` dependencies before linting: the backend lint command reuses the repository’s Oxlint installation from `client/node_modules`.

## Deployment: MongoDB Atlas, API host, and Vercel client

This guide keeps the Express API on Render and serves the Vite static client from Vercel. Configure secrets in each platform’s environment settings, not in Git.

### 1. MongoDB Atlas and API

1. Create a MongoDB Atlas cluster, configure network access for the API host, and create a least-privilege database user. Store its MongoDB connection string as `DATABASE_URL`.
2. Create a Render Web Service from this repository, with root directory `server`, runtime Node, and:
   - Build command: `npm ci && npm run prisma:generate && npm run build`
   - Pre-deploy command: `npm run prisma:push`
   - Start command: `npm start`
   - Health check path: `/health`
3. Add `DATABASE_URL`, `NODE_ENV=production`, independent `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (each at least 32 characters), `CORS_ORIGINS` with the exact Vercel site origin, and SMTP settings (`EMAIL_MODE=smtp`, `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider credentials). Set `TRUST_PROXY=true` for Render’s reverse proxy. Configure the optional S3 variables for durable material storage; the local filesystem fallback is not durable across ephemeral deploy instances.
4. Back up the database before schema changes. MongoDB uses Prisma `db push` rather than Prisma Migrate; review schema changes and run the pre-deploy command only after verifying its effect against staging data.

Render documents its build, pre-deploy, and start command lifecycle in [Deploying on Render](https://render.com/docs/deploys), and Docker-based services support the same pre-deploy migration step in [Docker on Render](https://render.com/docs/docker).

### 2. Client on Vercel

1. Import the repository into Vercel and set the project root directory to `client`.
2. Use `npm run build` as the build command and `dist` as the output directory. Set `VITE_API_URL=https://<your-render-api-host>/api` in the Vercel environment for each required deployment environment.
3. Add the exact Vercel origin to the API’s `CORS_ORIGINS`, redeploy the API, then deploy the client.
4. The Vite client uses browser-history routes. Configure the Vercel project for Vite SPA fallback/deep links if Vercel does not infer it automatically. Refer to [Vercel’s Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and [environment variable guide](https://vercel.com/docs/environment-variables).

## Database and migration notes

MongoDB uses Prisma's `db push` to create collections and indexes; Prisma Migrate does not support MongoDB. Use a replica set because the application uses multi-document transactions. The seed command is intended only for local/demo setup.

## Privacy, consent, and retention

- A signed-in user can download their tenant-scoped JSON export from `GET /api/privacy/me/export`. The export excludes password hashes and includes profile, education, teaching, materials activity, authored community content, preferences, consent records, and audit activity. The export request is audit logged.
- `DELETE /api/privacy/me` anonymizes the caller’s account. It revokes refresh sessions, removes notifications, activity telemetry, guardian contact details, and their community content, then replaces the account identifiers. Student enrollment, attendance, marks, and correction history remain linked to the anonymized account for academic record integrity. Access tokens are rejected after account deactivation.
- Admins can mark users as minors with `PATCH /api/admin/users/:id/minor-status`, record consent with `POST /api/admin/users/:id/guardian-consent`, and revoke active consent with `DELETE /api/admin/users/:id/guardian-consent`. Community APIs and community panels in dashboards are restricted for a minor without active consent. Admins should record consent only after validating it according to their institution’s process; the system stores the recording method, policy version, guardian contact, timestamp, and recorder.
- Institution admins configure retention with `GET`/`PUT /api/admin/data-retention`. The optional `inactiveAccountRetentionDays` and `auditLogRetentionDays` values accept 30–3650 days; `null` disables that sweep action. The retention defaults are disabled so institutions choose and document their own policy. Academic records are preserved when an account is anonymized.
- Schedule `cd server && npm run privacy:retention` as a monthly or policy-approved maintenance job. It anonymizes deactivated non-admin accounts past the configured age and permanently deletes audit logs past their configured age. `deactivatedAt` is set when an admin deactivates an account. Review and approve retention periods with the institution’s records/privacy owner before enabling the scheduled job; audit deletion is irreversible.
