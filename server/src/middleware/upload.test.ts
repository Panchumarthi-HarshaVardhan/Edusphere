import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUploadFile } from './upload.js';

test('accepts only allowed file extension and matching MIME types', () => {
  assert.equal(validateUploadFile('images', { originalname: 'slide.png', mimetype: 'image/png' }), null);
  assert.match(validateUploadFile('images', { originalname: 'payload.exe', mimetype: 'image/png' }) || '', /Unsupported/);
  assert.match(validateUploadFile('spreadsheets', { originalname: 'list.xlsx', mimetype: 'text/csv' }) || '', /Unsupported/);
  assert.equal(validateUploadFile('spreadsheets', { originalname: 'list.csv', mimetype: 'text/csv' }), null);
});
