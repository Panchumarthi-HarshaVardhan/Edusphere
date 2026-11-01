import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    'DATABASE_URL_TEST is required. Copy .env.test.example to .env.test and start the local MongoDB replica set before running npm test.'
  );
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(testUrl);
} catch {
  throw new Error('DATABASE_URL_TEST must be a valid MongoDB URL.');
}
if (!['mongodb:', 'mongodb+srv:'].includes(parsedUrl.protocol)) {
  throw new Error('DATABASE_URL_TEST must use mongodb:// or mongodb+srv://.');
}

const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
if (!databaseName.endsWith('_test')) {
  throw new Error('Refusing to run integration tests: DATABASE_URL_TEST database name must end in _test.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
execFileSync(
  process.execPath,
  [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: testUrl } }
);
