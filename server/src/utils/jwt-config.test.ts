import assert from 'node:assert/strict';
import test from 'node:test';
import { loadJwtSecrets } from './jwt-config.js';

const longAccessSecret = 'A'.repeat(40);
const longRefreshSecret = 'B'.repeat(40);

test('requires both strong JWT secrets outside development', () => {
  for (const nodeEnv of ['production', 'test', undefined]) {
    assert.throws(
      () => loadJwtSecrets({ NODE_ENV: nodeEnv }),
      /JWT_ACCESS_SECRET is required/
    );
  }
});

test('rejects short JWT secrets with a clear setting-specific error', () => {
  assert.throws(
    () => loadJwtSecrets({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'too-short',
      JWT_REFRESH_SECRET: longRefreshSecret,
    }),
    /JWT_ACCESS_SECRET must be at least 32 characters/
  );
  assert.throws(
    () => loadJwtSecrets({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: longAccessSecret,
      JWT_REFRESH_SECRET: 'too-short',
    }),
    /JWT_REFRESH_SECRET must be at least 32 characters/
  );
});

test('accepts configured independent secrets of sufficient length', () => {
  assert.deepEqual(
    loadJwtSecrets({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: longAccessSecret,
      JWT_REFRESH_SECRET: longRefreshSecret,
    }),
    { accessSecret: longAccessSecret, refreshSecret: longRefreshSecret }
  );
});

test('uses ephemeral strong secrets only when development secrets are omitted', () => {
  const secrets = loadJwtSecrets({ NODE_ENV: 'development' });
  assert.ok(secrets.accessSecret.length >= 32);
  assert.ok(secrets.refreshSecret.length >= 32);
  assert.notEqual(secrets.accessSecret, secrets.refreshSecret);
});

test('does not permit short secrets even in development', () => {
  assert.throws(
    () => loadJwtSecrets({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: longRefreshSecret,
    }),
    /JWT_ACCESS_SECRET must be at least 32 characters/
  );
});
