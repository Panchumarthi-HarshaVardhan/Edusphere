import { RoleType } from '@prisma/client';

export interface JwtTokenPayload {
  userId: string;
  institutionId: string;
  role: RoleType;
  email: string;
  mustResetPassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtTokenPayload;
      institutionId?: string;
    }
  }
}
