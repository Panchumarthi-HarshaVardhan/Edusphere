# EduSphere Repository Guide

## Purpose

EduSphere is a multi-institution educational portal that combines learning resources, classroom lessons, attendance and marks management, and campus communication. It has Student, Faculty, and Admin portals. Institution data must remain isolated between tenants.

## Technology stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Konva, and PDF.js.
- Backend: Node.js, TypeScript, Express, Zod, JWT access tokens, and rotating refresh tokens.
- Database: MongoDB with Prisma ORM (`relationMode = "prisma"`).
- Local database: MongoDB 8 single-node replica set through Docker Compose or a local replica set.
- File storage: S3-compatible storage when configured, with a local development fallback.

## Repository layout

```text
client/
  public/             Static assets
  src/
    api/               API client and refresh handling
    assets/            Images and other frontend assets
    components/        Shared UI, portal features, and dialogs
    context/           Authentication context
    pages/             Login and Student, Faculty, Admin portals
    types/             Shared TypeScript data types
  package.json         Frontend scripts and dependencies
  vite.config.ts       Vite and local API proxy configuration
server/
  prisma/
    schema.prisma      MongoDB data model and collection indexes
    seed.ts            Development seed data
  src/
    controllers/       HTTP request/response handlers
    middleware/        Authentication, authorization, tenant scope, validation
    routes/            Express route registration
    services/          Business logic and persistence operations
    types/             Express request extensions
    utils/             Prisma client, JWT helpers, and validators
  package.json         Backend scripts and dependencies
  .env.example         Local environment variable template
  .env.test.example    Separate integration-test database template
  test/               Vitest + Supertest integration suite and seed helpers
docker-compose.yml     Local API, client, and MongoDB replica set
```

## Setup and run

Run commands from the repository root unless a directory is shown.

1. Install dependencies for both applications:

   ```sh
   cd client && npm ci
   cd ../server && npm ci
   ```

2. Start MongoDB and configure the backend environment:

   ```sh
   cd ..
   docker compose up -d mongo
   test -f server/.env || cp server/.env.example server/.env
   ```

   Set `DATABASE_URL` to the local MongoDB replica-set connection. Replace the example JWT secrets with unique, randomly generated values. Keep `.env` files private and out of version control.

   Integration tests use a separate MongoDB database with a `_test` suffix. Create its environment file:

   ```sh
   cp server/.env.test.example server/.env.test
   ```

   `npm test` checks that `DATABASE_URL_TEST` points to a MongoDB database whose name ends in `_test` before synchronizing the Prisma schema. It never uses the development database.

3. Generate Prisma Client, synchronize MongoDB collections and indexes, and load development data:

   ```sh
   cd server
   npm run prisma:generate
   npm run prisma:push
   npm run seed
   ```

   MongoDB does not use Prisma Migrate; synchronize schema changes with `npm run prisma:push` after reviewing them.

4. Run the backend and frontend in separate terminals:

   ```sh
   cd server && npm run dev
   ```

   ```sh
   cd client && npm run dev
   ```

   Vite serves the client on port 5173 and proxies `/api` requests to the backend on port 5000 by default.

## Checks and tests

- Frontend type check: `cd client && npx tsc -b --pretty false`.
- Frontend lint: `cd client && npm run lint`.
- Frontend build (includes TypeScript project checking): `cd client && npm run build`.
- Backend type check/build: `cd server && npm run build`.
- Backend lint: `cd server && npm run lint` (install client dependencies too; this monorepo reuses its Oxlint binary).
- Backend integration tests: `cd server && npm test` (Vitest + Supertest; requires the separate test database above).
- Backend unit tests: `cd server && npm run test:unit` (Node's built-in test runner with `tsx`).
- Frontend tests: no test runner is currently configured.

Every bug fix and every new endpoint must include an appropriate test. Tests for tenant boundaries, authorization, audit behavior, and student read-only access are especially important. Do not claim a check passed unless it was run and passed.

## Non-negotiable engineering rules

1. **Tenant isolation:** Every table has an `institution_id` column, and every database query is scoped by the authenticated institution. Never trust a tenant ID supplied by the client.
2. **Authorization:** Apply authentication and RBAC middleware to every protected route. Public authentication routes are limited to their intended operations. Add resource-level checks as well: faculty may only manage subjects and sections to which they are assigned.
3. **Attendance:** Store attendance as individual per-session, per-student records. Compute attendance percentages from those records; do not persist derived percentages as the source of truth.
4. **Published marks:** Change published marks only through an authorized edit that records the actor, reason, changes, and timestamp in `audit_logs`.
5. **Student permissions:** Students have read-only access to study materials and canvas lessons. Enforce viewing and download permissions on the server, not only in the UI.
6. **Input validation:** Validate request bodies, query parameters, and route parameters with Zod before business logic uses them.
7. **Secrets:** Never commit passwords, tokens, private keys, production credentials, or populated environment files. Use environment variables and safe example values only.
8. **Tests:** Every bug fix or new endpoint comes with a test covering expected behavior and relevant authorization or tenant boundaries.

## Change guidance

- Keep route handlers thin; put domain rules in services and request parsing in middleware/validators.
- Preserve the existing TypeScript module conventions and use Prisma for database access.
- For changes touching tenant data, verify institution scoping on reads, writes, joins, and nested relations.
- Avoid changing generated output in `client/dist`, `server/dist`, or `node_modules` as source changes.
