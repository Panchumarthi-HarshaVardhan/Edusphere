import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error('DATABASE_URL_TEST is required for integration tests.');
}

let databaseName = '';
try {
  databaseName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ''));
} catch {
  throw new Error('DATABASE_URL_TEST must be a valid MongoDB URL.');
}
if (!['mongodb:', 'mongodb+srv:'].includes(new URL(testUrl).protocol)) {
  throw new Error('DATABASE_URL_TEST must use mongodb:// or mongodb+srv://.');
}
if (!databaseName.endsWith('_test')) {
  throw new Error('Refusing to run integration tests: DATABASE_URL_TEST database name must end in _test.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
process.env.JWT_ACCESS_SECRET ||= randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET ||= randomBytes(32).toString('hex');

// Integration tests exercise the local storage fallback only; never contact external storage.
delete process.env.AWS_S3_BUCKET;
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
