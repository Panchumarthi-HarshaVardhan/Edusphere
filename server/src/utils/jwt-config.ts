import { randomBytes } from 'crypto';

export const MIN_JWT_SECRET_LENGTH = 32;

export interface JwtSecrets {
  accessSecret: string;
  refreshSecret: string;
}

export function loadJwtSecrets(env: NodeJS.ProcessEnv = process.env): JwtSecrets {
  const isDevelopment = env.NODE_ENV === 'development';
  const resolveSecret = (name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string => {
    const value = env[name]?.trim();
    if (!value) {
      if (isDevelopment) {
        // Development-only ephemeral keys; tokens expire across server restarts.
        return randomBytes(MIN_JWT_SECRET_LENGTH).toString('hex');
      }
      throw new Error(
        `${name} is required when NODE_ENV is not development and must be at least ${MIN_JWT_SECRET_LENGTH} characters.`
      );
    }

    if (Buffer.byteLength(value, 'utf8') < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`${name} must be at least ${MIN_JWT_SECRET_LENGTH} characters.`);
    }
    return value;
  };

  return {
    accessSecret: resolveSecret('JWT_ACCESS_SECRET'),
    refreshSecret: resolveSecret('JWT_REFRESH_SECRET'),
  };
}
