import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import { createAuditLog } from './audit.service.js';
import { Request } from 'express';

const SALT_ROUNDS = 12;

export class AuthService {
  static async login(
    institutionCode: string,
    email: string,
    passwordPlain: string,
    req?: Request
  ) {
    const institution = await prisma.institution.findUnique({
      where: { code: institutionCode.toUpperCase() },
    });

    if (!institution || !institution.isActive) {
      throw { status: 401, message: 'Invalid institution or inactive account' };
    }

    const user = await prisma.user.findUnique({
      where: {
        institutionId_email: {
          institutionId: institution.id,
          email: email.toLowerCase().trim(),
        },
      },
      include: {
        department: true,
      },
    });

    if (!user || !user.isActive) {
      throw { status: 401, message: 'Invalid credentials or inactive user' };
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user.id,
      institutionId: institution.id,
      role: user.role,
      email: user.email,
      mustResetPassword: user.mustResetPassword,
    });

    const rawRefreshToken = signRefreshToken({
      userId: user.id,
      institutionId: institution.id,
    });

    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        institutionId: institution.id,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await createAuditLog({
      institutionId: institution.id,
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      resource: 'user',
      resourceId: user.id,
      details: { role: user.role, email: user.email },
      req,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        institutionId: user.institutionId,
        institutionName: institution.name,
        institutionCode: institution.code,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      },
    };
  }

  static async refreshTokens(rawRefreshToken: string, req?: Request) {
    if (!rawRefreshToken) {
      throw { status: 401, message: 'Refresh token required' };
    }

    let decoded: { userId: string; institutionId: string };
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw { status: 401, message: 'Invalid or expired refresh token' };
    }

    const currentHash = hashToken(rawRefreshToken);
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: currentHash },
      include: { user: true, institution: true },
    });

    // Reuse detection: If token was already revoked, revoke all tokens for this user immediately
    if (!tokenRecord) {
      throw { status: 401, message: 'Invalid refresh token' };
    }

    if (tokenRecord.revokedAt) {
      // Security breach / token reuse detected
      await prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId },
        data: { revokedAt: new Date() },
      });
      await createAuditLog({
        institutionId: tokenRecord.institutionId,
        userId: tokenRecord.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'refreshToken',
        resourceId: tokenRecord.id,
        req,
      });
      throw { status: 401, message: 'Refresh token reuse detected. All sessions terminated.' };
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw { status: 401, message: 'Refresh token expired' };
    }

    const user = tokenRecord.user;
    if (!user || !user.isActive || !tokenRecord.institution.isActive) {
      throw { status: 403, message: 'Account or institution is inactive' };
    }

    // Generate new rotation pair
    const newAccessToken = signAccessToken({
      userId: user.id,
      institutionId: user.institutionId,
      role: user.role,
      email: user.email,
      mustResetPassword: user.mustResetPassword,
    });

    const newRawRefreshToken = signRefreshToken({
      userId: user.id,
      institutionId: user.institutionId,
    });
    const newHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Rotate: revoke the old one, link replacement
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: newHash,
        },
      }),
      prisma.refreshToken.create({
        data: {
          institutionId: user.institutionId,
          userId: user.id,
          tokenHash: newHash,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: user.id,
        institutionId: user.institutionId,
        institutionName: tokenRecord.institution.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
      },
    };
  }

  static async logout(rawRefreshToken?: string, userId?: string, req?: Request) {
    if (rawRefreshToken) {
      const hash = hashToken(rawRefreshToken);
      const token = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
      if (token) {
        await prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        await createAuditLog({
          institutionId: token.institutionId,
          userId: token.userId,
          action: 'AUTH_LOGOUT',
          resource: 'user',
          resourceId: token.userId,
          req,
        });
      }
    } else if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  static async changePassword(
    userId: string,
    institutionId: string,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    req?: Request
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, institutionId, isActive: true },
    });

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    const isMatch = await bcrypt.compare(currentPasswordPlain, user.passwordHash);
    if (!isMatch) {
      throw { status: 400, message: 'Incorrect current password' };
    }

    const newHash = await bcrypt.hash(newPasswordPlain, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustResetPassword: false,
      },
    });

    // Revoke all existing refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      institutionId,
      userId,
      action: 'PASSWORD_CHANGE',
      resource: 'user',
      resourceId: userId,
      req,
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  static async resetFirstPassword(
    userId: string,
    institutionId: string,
    newPasswordPlain: string,
    req?: Request
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, institutionId, isActive: true },
    });

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    if (!user.mustResetPassword) {
      throw { status: 400, message: 'Password reset on first login has already been completed' };
    }

    const newHash = await bcrypt.hash(newPasswordPlain, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustResetPassword: false,
      },
    });

    await createAuditLog({
      institutionId,
      userId,
      action: 'FIRST_PASSWORD_RESET_COMPLETED',
      resource: 'user',
      resourceId: userId,
      req,
    });

    return { message: 'First login password setup complete.' };
  }

  static async updateProfile(
    userId: string,
    institutionId: string,
    data: { firstName: string; lastName: string },
    req?: Request
  ) {
    const current = await prisma.user.findFirst({
      where: { id: userId, institutionId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!current) throw { status: 404, message: 'User not found' };

    const user = await prisma.user.update({
      where: { id: current.id },
      data: { firstName: data.firstName, lastName: data.lastName },
      include: {
        institution: { select: { name: true, code: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      institutionId,
      userId,
      action: 'USER_PROFILE_UPDATED',
      resource: 'user',
      resourceId: userId,
      details: {
        before: { firstName: current.firstName, lastName: current.lastName },
        after: { firstName: user.firstName, lastName: user.lastName },
      },
      req,
    });

    return {
      id: user.id,
      institutionId: user.institutionId,
      institutionName: user.institution.name,
      institutionCode: user.institution.code,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
      department: user.department,
    };
  }
}
