import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    institutionCode: z.string().min(1, 'Institution code is required'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

export const resetFirstPasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, 'First name is required').max(80),
    lastName: z.string().trim().min(1, 'Last name is required').max(80),
  }).strict(),
});
