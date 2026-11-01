import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JwtTokenPayload } from '../types/express.js';
import { loadJwtSecrets } from './jwt-config.js';

const { accessSecret: ACCESS_SECRET, refreshSecret: REFRESH_SECRET } = loadJwtSecrets();
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export const signAccessToken = (payload: JwtTokenPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY as any });
};

export const verifyAccessToken = (token: string): JwtTokenPayload => {
  return jwt.verify(token, ACCESS_SECRET) as JwtTokenPayload;
};

export const signRefreshToken = (payload: { userId: string; institutionId: string }): string => {
  // Keep rotations unique even when issued within the same second for the same account.
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY as any });
};

export const verifyRefreshToken = (token: string): { userId: string; institutionId: string } => {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string; institutionId: string };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
