import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveSafeStoragePath } from './material-file-access.js';

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

export interface StorageUploadResult {
  s3Key: string;
  fileSizeBytes: number;
  mimeType: string;
}

export class StorageService {
  private static s3Client: S3Client | null = null;
  private static bucketName = process.env.AWS_S3_BUCKET || '';
  private static isS3Enabled =
    Boolean(process.env.AWS_S3_BUCKET) &&
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  private static getClient(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.AWS_S3_ENDPOINT || undefined,
        forcePathStyle: Boolean(process.env.AWS_S3_FORCE_PATH_STYLE === 'true'),
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
    }
    return this.s3Client;
  }

  /**
   * Save a file buffer to S3 or local fallback directory
   */
  static async uploadFile(
    institutionId: string,
    folder: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${institutionId}/${folder}/${timestamp}_${sanitizedFilename}`;

    if (this.isS3Enabled) {
      const client = this.getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    } else {
      // Local fallback
      const targetFilePath = path.join(LOCAL_STORAGE_DIR, key);
      const parentDir = path.dirname(targetFilePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, buffer);
    }

    return {
      s3Key: key,
      fileSizeBytes: buffer.length,
      mimeType,
    };
  }

  /**
   * Generates a signed view URL or signed token endpoint with expiration
   */
  static async getSignedViewUrl(
    s3Key: string,
    originalFilename: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    if (this.isS3Enabled) {
      const client = this.getClient();
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentDisposition: `inline; filename="${encodeURIComponent(originalFilename)}"`,
      });
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    }

    // Local signed URL endpoint
    return `/api/materials/stream/${encodeURIComponent(s3Key)}?inline=true`;
  }

  /**
   * Generates a signed download URL with attachment header
   */
  static async getSignedDownloadUrl(
    s3Key: string,
    originalFilename: string,
    expiresInSeconds = 1800
  ): Promise<string> {
    if (this.isS3Enabled) {
      const client = this.getClient();
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      });
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    }

    // Local signed URL endpoint
    return `/api/materials/stream/${encodeURIComponent(s3Key)}?download=true`;
  }

  /**
   * Retrieves raw file buffer (used for conversion or local stream)
   */
  static async getFileBuffer(s3Key: string): Promise<Buffer> {
    if (this.isS3Enabled) {
      const client = this.getClient();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        })
      );
      const byteArray = await response.Body?.transformToByteArray();
      return Buffer.from(byteArray || []);
    }

    const localPath = resolveSafeStoragePath(LOCAL_STORAGE_DIR, s3Key);
    if (!fs.existsSync(localPath)) {
      throw new Error('File not found in storage');
    }
    return fs.readFileSync(localPath);
  }

  static async deleteFile(s3Key: string): Promise<void> {
    if (this.isS3Enabled) {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: s3Key }));
      return;
    }
    const localPath = resolveSafeStoragePath(LOCAL_STORAGE_DIR, s3Key);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }

  static getLocalFilePath(s3Key: string): string {
    return resolveSafeStoragePath(LOCAL_STORAGE_DIR, s3Key);
  }
}
