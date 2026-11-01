import multer from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';

const formats = {
  materials: {
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword', 'application/octet-stream'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
    '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
    '.txt': ['text/plain'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp'],
  },
  slides: {
    '.pdf': ['application/pdf'],
    '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
  },
  images: {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
  },
  community: {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword', 'application/octet-stream'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
    '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
    '.txt': ['text/plain'],
  },
  spreadsheets: {
    '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  },
} as const;

export type UploadKind = keyof typeof formats;

export function validateUploadFile(kind: UploadKind, file: { originalname: string; mimetype: string }): string | null {
  const extension = path.extname(file.originalname).toLowerCase() as keyof (typeof formats)[UploadKind];
  const allowedMimes = formats[kind][extension as never] as readonly string[] | undefined;
  if (!allowedMimes || !allowedMimes.includes(file.mimetype.toLowerCase())) {
    return `Unsupported file type. Allowed extensions: ${Object.keys(formats[kind]).join(', ')}.`;
  }
  return null;
}

export function uploadSingle(kind: UploadKind, maxFileSize: number): RequestHandler {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1, fields: 40, parts: 42 },
    fileFilter: (_req, file, callback) => {
      const error = validateUploadFile(kind, file);
      if (error) callback(Object.assign(new Error(error), { status: 415 }));
      else callback(null, true);
    },
  }).single('file');
}

export function uploadMany(kind: UploadKind, maxFileSize: number, maxFiles: number): RequestHandler {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: maxFiles, fields: 40, parts: maxFiles + 42 },
    fileFilter: (_req, file, callback) => {
      const error = validateUploadFile(kind, file);
      if (error) callback(Object.assign(new Error(error), { status: 415 }));
      else callback(null, true);
    },
  }).array('files', maxFiles);
}
