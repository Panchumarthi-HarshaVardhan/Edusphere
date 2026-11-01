import { Request } from 'express';
import { prisma } from '../utils/prisma.js';
import { StorageService } from './storage.service.js';
import { DocumentConverterService } from './converter.service.js';
import { createAuditLog } from './audit.service.js';
import { RoleType } from '@prisma/client';

export class CanvasService {
  /**
   * Create a new digital classroom session with default blank page 1
   */
  static async createSession(
    institutionId: string,
    facultyId: string,
    data: {
      subjectId: string;
      sectionId: string;
      title: string;
      sessionDate?: string;
      allowDownload?: boolean;
    },
    req?: Request
  ) {
    const sessionDate = data.sessionDate ? new Date(data.sessionDate) : new Date();

    const session = await prisma.classroomSession.create({
      data: {
        institutionId,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        facultyId,
        title: data.title,
        sessionDate,
        allowDownload: data.allowDownload ?? true,
        pages: {
          create: {
            institutionId,
            pageNumber: 1,
            strokesJson: [],
          },
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        faculty: { select: { id: true, firstName: true, lastName: true } },
        pages: { orderBy: { pageNumber: 'asc' } },
      },
    });

    await createAuditLog({
      institutionId,
      userId: facultyId,
      action: 'CANVAS_SESSION_CREATED',
      resource: 'classroom_session',
      resourceId: session.id,
      details: { title: data.title, subjectId: data.subjectId },
      req,
    });

    return session;
  }

  /**
   * Autosave strokes and background for a specific canvas page (Rule 1 & compact JSON)
   */
  static async savePage(
    institutionId: string,
    sessionId: string,
    pageNumber: number,
    strokesJson: any,
    backgroundAssetUrl?: string
  ) {
    // Validate session belongs to institution
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
    });

    if (!session) {
      throw { status: 404, message: 'Classroom session not found' };
    }

    const page = await prisma.canvasPage.upsert({
      where: {
        classroomSessionId_pageNumber: {
          classroomSessionId: sessionId,
          pageNumber,
        },
      },
      update: {
        strokesJson: strokesJson ?? [],
        ...(backgroundAssetUrl !== undefined && { backgroundAssetUrl }),
        updatedAt: new Date(),
      },
      create: {
        institutionId,
        classroomSessionId: sessionId,
        pageNumber,
        strokesJson: strokesJson ?? [],
        backgroundAssetUrl: backgroundAssetUrl || null,
      },
    });

    return page;
  }

  /**
   * Add a new blank page to the session
   */
  static async addPage(institutionId: string, sessionId: string) {
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
      include: { pages: { orderBy: { pageNumber: 'desc' }, take: 1 } },
    });

    if (!session) {
      throw { status: 404, message: 'Classroom session not found' };
    }

    const nextNumber = (session.pages[0]?.pageNumber || 0) + 1;

    return prisma.canvasPage.create({
      data: {
        institutionId,
        classroomSessionId: sessionId,
        pageNumber: nextNumber,
        strokesJson: [],
      },
    });
  }

  /**
   * Delete a page and reorder remaining pages
   */
  static async deletePage(institutionId: string, sessionId: string, pageNumber: number) {
    const pages = await prisma.canvasPage.findMany({
      where: { classroomSessionId: sessionId, institutionId },
      orderBy: { pageNumber: 'asc' },
    });

    if (pages.length <= 1) {
      throw { status: 400, message: 'Cannot delete the only page in the session' };
    }

    const targetPage = pages.find((p) => p.pageNumber === pageNumber);
    if (!targetPage) {
      throw { status: 404, message: 'Page not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.canvasPage.delete({ where: { id: targetPage.id } });

      // Renumber subsequent pages
      const subsequentPages = pages.filter((p) => p.pageNumber > pageNumber);
      for (const p of subsequentPages) {
        await tx.canvasPage.update({
          where: { id: p.id },
          data: { pageNumber: p.pageNumber - 1 },
        });
      }
    });

    return { message: `Page ${pageNumber} deleted successfully` };
  }

  /**
   * Import PDF/PPT slides into canvas pages as background assets
   */
  static async importDocumentSlides(
    institutionId: string,
    sessionId: string,
    file: Express.Multer.File
  ) {
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });

    if (!session) {
      throw { status: 404, message: 'Classroom session not found' };
    }

    // 1. Upload original document
    const uploadResult = await StorageService.uploadFile(
      institutionId,
      'canvas_documents',
      file.originalname,
      file.buffer,
      file.mimetype
    );

    // 2. If PPT/DOCX, convert to PDF first
    let pdfKey = uploadResult.s3Key;
    const isOffice =
      file.mimetype.includes('powerpoint') ||
      file.mimetype.includes('presentation') ||
      file.mimetype.includes('officedocument');

    if (isOffice) {
      const convertedKey = await DocumentConverterService.convertOfficeToPdf(
        institutionId,
        uploadResult.s3Key,
        file.originalname
      );
      if (convertedKey) {
        pdfKey = convertedKey;
      }
    }

    const signedPdfUrl = await StorageService.getSignedViewUrl(pdfKey, file.originalname, 3600);

    return {
      message: 'Document uploaded for canvas slide extraction',
      pdfUrl: signedPdfUrl,
      pdfKey,
    };
  }

  /**
   * Upload an image asset to be inserted onto a canvas page
   */
  static async uploadCanvasAsset(
    institutionId: string,
    sessionId: string,
    file: Express.Multer.File
  ) {
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
      select: { id: true },
    });
    if (!session) throw { status: 404, message: 'Classroom session not found' };
    const uploadResult = await StorageService.uploadFile(
      institutionId,
      'canvas_assets',
      file.originalname,
      file.buffer,
      file.mimetype
    );

    const asset = await prisma.canvasAsset.create({
      data: {
        institutionId,
        classroomSessionId: sessionId,
        s3Key: uploadResult.s3Key,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
      },
    });
    return {
      id: asset.id,
    };
  }

  static async completeSession(institutionId: string, sessionId: string, facultyId: string, req?: Request) {
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
      select: { id: true, completedAt: true, title: true },
    });
    if (!session) throw { status: 404, message: 'Classroom session not found' };
    if (session.completedAt) return session;

    const completed = await prisma.classroomSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
      select: { id: true, completedAt: true, title: true },
    });
    await createAuditLog({
      institutionId,
      userId: facultyId,
      action: 'CANVAS_SESSION_COMPLETED',
      resource: 'classroom_session',
      resourceId: sessionId,
      details: { title: session.title },
      req,
    });
    return completed;
  }

  static async getCanvasAsset(institutionId: string, assetId: string) {
    const asset = await prisma.canvasAsset.findFirst({
      where: { id: assetId, institutionId },
      select: { id: true, classroomSessionId: true, s3Key: true, originalFilename: true, mimeType: true },
    });
    if (!asset) throw { status: 404, message: 'Canvas asset not found' };
    return asset;
  }

  /**
   * List classroom sessions for a subject/section (archived lessons)
   */
  static async listSessions(
    institutionId: string,
    userId: string,
    role: RoleType,
    query: { subjectId?: string; sectionId?: string; search?: string }
  ) {
    const where: any = {
      institutionId,
    };

    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.sectionId) where.sectionId = query.sectionId;

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    // Students see sessions for all active enrollments; faculty see assigned sections.
    if (role === RoleType.STUDENT) {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { institutionId, studentId: userId, status: 'ACTIVE' },
        select: { sectionId: true },
      });
      where.sectionId = { in: enrollments.map((row) => row.sectionId) };
      where.completedAt = { not: null };
    } else if (role === RoleType.FACULTY || role === RoleType.CLASS_INCHARGE || role === RoleType.HOD) {
      const [assignments, actor] = await Promise.all([
        prisma.facultyAssignment.findMany({
          where: { institutionId, facultyId: userId },
          select: { subjectId: true, sectionId: true },
        }),
        role === RoleType.HOD
          ? prisma.user.findFirst({ where: { id: userId, institutionId }, select: { departmentId: true } })
          : Promise.resolve(null),
      ]);
      const accessOr: any[] = assignments.map((assignment) => ({
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
      }));
      if (actor?.departmentId) {
        accessOr.push({ subject: { semester: { program: { departmentId: actor.departmentId } } } });
      }
      where.AND = [...(where.AND || []), { OR: accessOr.length ? accessOr : [{ id: '__no_access__' }] }];
    }

    return prisma.classroomSession.findMany({
      where,
      orderBy: { sessionDate: 'desc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        faculty: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { pages: true } },
      },
    });
  }

  /**
   * Get single session with all canvas pages and strokes
   */
  static async getSessionById(
    institutionId: string,
    sessionId: string,
    userId: string,
    role: RoleType
  ) {
    const session = await prisma.classroomSession.findFirst({
      where: { id: sessionId, institutionId },
      include: {
        subject: true,
        section: true,
        faculty: { select: { id: true, firstName: true, lastName: true, email: true } },
        pages: {
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!session) {
      throw { status: 404, message: 'Classroom session not found' };
    }

    // Rule 2 & 5: Check student access
    if (role === RoleType.STUDENT) {
      if (!session.completedAt) {
        throw { status: 404, message: 'Classroom session not found' };
      }
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: { institutionId, studentId: userId, sectionId: session.sectionId, status: 'ACTIVE' },
      });
      if (!enrollment) {
        throw { status: 403, message: 'Access denied: You are not enrolled in this section' };
      }
    }

    return session;
  }
}
