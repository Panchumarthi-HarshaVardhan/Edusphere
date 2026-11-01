import path from 'path';

export interface MaterialFileAccessDecision {
  sameInstitution: boolean;
  isPublished: boolean;
  userHasScope: boolean;
  allowDownload: boolean;
  isDownload: boolean;
}

/** Hide materials outside the caller's institution, publication window, or audience. */
export function assertMaterialFileAccess(decision: MaterialFileAccessDecision): void {
  if (!decision.sameInstitution || !decision.isPublished || !decision.userHasScope) {
    throw { status: 404, message: 'File not found' };
  }

  if (decision.isDownload && !decision.allowDownload) {
    throw { status: 403, message: 'Downloading this material is not allowed' };
  }
}

/** Resolve a storage key beneath the local upload directory and reject traversal. */
export function resolveSafeStoragePath(storageRoot: string, storageKey: string): string {
  if (
    !storageKey ||
    path.isAbsolute(storageKey) ||
    storageKey.includes('\0') ||
    storageKey.includes('\\') ||
    storageKey.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw { status: 404, message: 'File not found' };
  }

  const root = path.resolve(storageRoot);
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw { status: 404, message: 'File not found' };
  }
  return resolved;
}
