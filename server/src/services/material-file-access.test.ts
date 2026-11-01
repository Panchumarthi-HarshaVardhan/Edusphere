import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMaterialFileAccess, resolveSafeStoragePath } from './material-file-access.js';

const allowedView = {
  sameInstitution: true,
  isPublished: true,
  userHasScope: true,
  allowDownload: true,
  isDownload: false,
};

test('allows a published file to a user in its institution and audience', () => {
  assert.doesNotThrow(() => assertMaterialFileAccess(allowedView));
});

test('hides cross-institution, unpublished, and out-of-audience files as not found', () => {
  for (const denied of [
    { ...allowedView, sameInstitution: false },
    { ...allowedView, isPublished: false },
    { ...allowedView, userHasScope: false },
  ]) {
    assert.throws(
      () => assertMaterialFileAccess(denied),
      (error: { status?: number }) => error.status === 404
    );
  }
});

test('rejects downloads when the material does not allow downloading', () => {
  assert.throws(
    () => assertMaterialFileAccess({ ...allowedView, allowDownload: false, isDownload: true }),
    (error: { status?: number }) => error.status === 403
  );
  assert.doesNotThrow(() =>
    assertMaterialFileAccess({ ...allowedView, allowDownload: false, isDownload: false })
  );
});

test('keeps storage keys inside the upload root and rejects traversal forms', () => {
  assert.equal(resolveSafeStoragePath('/srv/uploads', 'institution/materials/file.pdf'),
    '/srv/uploads/institution/materials/file.pdf');

  for (const key of ['../secret', 'institution/../../secret', '/etc/passwd', 'a\\..\\secret', '']) {
    assert.throws(
      () => resolveSafeStoragePath('/srv/uploads', key),
      (error: { status?: number }) => error.status === 404
    );
  }
});
