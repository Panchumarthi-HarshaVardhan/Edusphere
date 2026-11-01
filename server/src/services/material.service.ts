import { Request } from 'express';
import { prisma } from '../utils/prisma.js';
import { StorageService } from './storage.service.js';
import { DocumentConverterService } from './converter.service.js';
import { MaterialType, RoleType, NotificationCategory } from '@prisma/client';
import { createAuditLog } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { assertMaterialFileAccess } from './material-file-access.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export class MaterialService {
  static async listSubjectsForUser(institutionId: string, userId: string, role: RoleType) {
    if (role === RoleType.ADMIN || role === RoleType.SUPER_ADMIN) {
      return prisma.subject.findMany({ where: { institutionId }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } });
    }
    if (role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE) {
      const assignments = await prisma.facultyAssignment.findMany({
        where: { institutionId, facultyId: userId },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: [{ subject: { name: 'asc' } }, { section: { name: 'asc' } }],
      });
      return Array.from(new Map(assignments.map((assignment) => [assignment.subject.id, assignment.subject])).values());
    }
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { institutionId, studentId: userId, status: 'ACTIVE' },
      select: { sectionId: true },
    });
    const sectionIds = enrollments.map((enrollment) => enrollment.sectionId);
    if (!sectionIds.length) return [];
    return prisma.subject.findMany({
      where: { institutionId, semester: { sections: { some: { institutionId, id: { in: sectionIds } } } } },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  private static async userCanAccessMaterial(
    institutionId: string,
    user: { userId: string; role: RoleType },
    material: {
      subjectId: string;
      subject: { semesterId: string; semester: { program: { departmentId: string } } };
      targetSections: Array<{ sectionId: string }>;
    }
  ): Promise<boolean> {
    if (user.role === RoleType.ADMIN || user.role === RoleType.SUPER_ADMIN) return true;

    const eligibleSections = material.targetSections.length
      ? material.targetSections.map((target) => target.sectionId)
      : (
          await prisma.section.findMany({
            where: {
              institutionId,
              semesterId: material.subject.semesterId,
            },
            select: { id: true },
          })
        ).map((section) => section.id);

    if (user.role === RoleType.STUDENT) {
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
          institutionId,
          studentId: user.userId,
          sectionId: { in: eligibleSections },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      return Boolean(enrollment);
    }

    if (
      user.role !== RoleType.FACULTY &&
      user.role !== RoleType.HOD &&
      user.role !== RoleType.CLASS_INCHARGE
    ) {
      return false;
    }

    if (user.role === RoleType.HOD) {
      const hod = await prisma.user.findFirst({
        where: { id: user.userId, institutionId, role: RoleType.HOD },
        select: { departmentId: true },
      });
      if (hod?.departmentId === material.subject.semester.program.departmentId) return true;
    }

    const assignment = await prisma.facultyAssignment.findFirst({
      where: {
        institutionId,
        facultyId: user.userId,
        subjectId: material.subjectId,
        sectionId: { in: eligibleSections },
      },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  /** Authorize and resolve a local material file only through its tenant-scoped DB record. */
  static async authorizeLocalFileStream(
    institutionId: string,
    user: { userId: string; role: RoleType },
    storageKey: string,
    isDownload: boolean
  ) {
    const version = await prisma.materialVersion.findFirst({
      where: {
        institutionId,
        OR: [{ s3Key: storageKey }, { convertedS3Key: storageKey }],
        studyMaterial: { is: { institutionId } },
      },
      include: {
        studyMaterial: {
          include: {
            targetSections: { select: { sectionId: true } },
            subject: {
              include: {
                semester: {
                  include: { program: { include: { department: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!version) {
      assertMaterialFileAccess({
        sameInstitution: false,
        isPublished: false,
        userHasScope: false,
        allowDownload: false,
        isDownload,
      });
      throw { status: 404, message: 'File not found' };
    }

    const material = version.studyMaterial;
    const userHasScope = await this.userCanAccessMaterial(institutionId, user, material);

    assertMaterialFileAccess({
      sameInstitution: material.institutionId === institutionId,
      isPublished: material.visibleFrom <= new Date(),
      userHasScope,
      allowDownload: material.allowDownload,
      isDownload,
    });

    const isConvertedFile = version.convertedS3Key === storageKey;
    return {
      s3Key: storageKey,
      filename: isConvertedFile ? `${version.originalFilename}.pdf` : version.originalFilename,
      mimeType: isConvertedFile ? 'application/pdf' : version.mimeType,
      materialId: material.id,
    };
  }

  /**
   * Faculty/Admin creates a study material entry (with initial version or external link)
   */
  static async createMaterial(
    institutionId: string,
    userId: string,
    data: {
      subjectId: string;
      unitId?: string;
      title: string;
      description?: string;
      type: MaterialType;
      externalUrl?: string;
      visibleFrom?: string;
      allowDownload?: boolean;
      targetSectionIds?: string[];
    },
    file?: Express.Multer.File,
    req?: Request
  ) {
    // Validate file if material type requires a file
    if (data.type !== MaterialType.VIDEO_LINK && !file) {
      throw { status: 400, message: 'A document or image file is required for this material type' };
    }

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        throw { status: 400, message: 'File exceeds maximum allowed size of 50MB' };
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw {
          status: 400,
          message: `Invalid file type (${file.mimetype}). Supported formats: PDF, PPT, PPTX, DOC, DOCX, JPEG, PNG, WEBP.`,
        };
      }
    }

    const visibleFrom = data.visibleFrom ? new Date(data.visibleFrom) : new Date();

    // 1. Create base study material record
    const material = await prisma.studyMaterial.create({
      data: {
        institutionId,
        subjectId: data.subjectId,
        unitId: data.unitId || null,
        createdById: userId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        externalUrl: data.externalUrl || null,
        visibleFrom,
        allowDownload: data.allowDownload ?? true,
        currentVersion: 1,
        targetSections: data.targetSectionIds && data.targetSectionIds.length > 0
          ? {
              create: data.targetSectionIds.map((secId) => ({
                sectionId: secId,
              })),
            }
          : undefined,
      },
      include: {
        targetSections: true,
      },
    });

    // 2. Upload and record version 1 if file uploaded
    if (file) {
      const uploadResult = await StorageService.uploadFile(
        institutionId,
        'materials',
        file.originalname,
        file.buffer,
        file.mimetype
      );

      // Trigger server-side conversion to PDF for PPT / DOCX
      let convertedS3Key: string | null = null;
      const isOfficeDoc =
        file.mimetype.includes('powerpoint') ||
        file.mimetype.includes('presentation') ||
        file.mimetype.includes('word') ||
        file.mimetype.includes('officedocument');

      if (isOfficeDoc) {
        convertedS3Key = await DocumentConverterService.convertOfficeToPdf(
          institutionId,
          uploadResult.s3Key,
          file.originalname
        );
      }

      await prisma.materialVersion.create({
        data: {
          institutionId,
          studyMaterialId: material.id,
          versionNumber: 1,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: uploadResult.fileSizeBytes,
          s3Key: uploadResult.s3Key,
          convertedS3Key: convertedS3Key,
          isConverted: Boolean(convertedS3Key),
          changeNote: 'Initial upload',
        },
      });
    }

    await createAuditLog({
      institutionId,
      userId,
      action: 'MATERIAL_CREATED',
      resource: 'study_material',
      resourceId: material.id,
      details: { title: data.title, type: data.type, subjectId: data.subjectId },
      req,
    });

    // Trigger Notification for enrolled students (Requirement: "new material")
    try {
      let targetSectionIds: string[] = [];
      if (data.targetSectionIds && data.targetSectionIds.length > 0) {
        targetSectionIds = data.targetSectionIds;
      } else {
        const allSections = await prisma.section.findMany({
          where: { institutionId },
          select: { id: true },
        });
        targetSectionIds = allSections.map((s) => s.id);
      }

      const enrolledStudents = await prisma.studentEnrollment.findMany({
        where: {
          institutionId,
          sectionId: { in: targetSectionIds },
          status: 'ACTIVE',
        },
        select: { studentId: true },
      });

      const studentIds = Array.from(new Set(enrolledStudents.map((e) => e.studentId)));
      if (studentIds.length > 0) {
        const subject = await prisma.subject.findUnique({
          where: { id: data.subjectId },
          select: { name: true, code: true },
        });

        await NotificationService.createNotification(
          institutionId,
          studentIds,
          NotificationCategory.ACADEMIC,
          `New Material: ${data.title}`,
          `New ${data.type.replace('_', ' ')} uploaded in ${subject?.code || 'Subject'}: "${data.title}"`,
          '/student'
        );
      }
    } catch {
      console.error('[New Material Notification Error] Notification delivery failed.');
    }

    return this.getMaterialById(institutionId, material.id, userId, RoleType.FACULTY);
  }

  /**
   * Replace material file: Creates an immutable new material_version while preserving history
   */
  static async replaceMaterialFile(
    institutionId: string,
    materialId: string,
    userId: string,
    changeNote: string,
    file: Express.Multer.File,
    req?: Request
  ) {
    if (!file) {
      throw { status: 400, message: 'New file is required for replacement' };
    }
    if (file.size > MAX_FILE_SIZE) {
      throw { status: 400, message: 'File exceeds maximum allowed size of 50MB' };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw { status: 400, message: `Invalid file type (${file.mimetype})` };
    }

    const material = await prisma.studyMaterial.findFirst({
      where: { id: materialId, institutionId },
    });

    if (!material) {
      throw { status: 404, message: 'Study material not found' };
    }

    const newVersionNumber = material.currentVersion + 1;

    // Upload new file version
    const uploadResult = await StorageService.uploadFile(
      institutionId,
      'materials',
      file.originalname,
      file.buffer,
      file.mimetype
    );

    let convertedS3Key: string | null = null;
    const isOfficeDoc =
      file.mimetype.includes('powerpoint') ||
      file.mimetype.includes('presentation') ||
      file.mimetype.includes('word') ||
      file.mimetype.includes('officedocument');

    if (isOfficeDoc) {
      convertedS3Key = await DocumentConverterService.convertOfficeToPdf(
        institutionId,
        uploadResult.s3Key,
        file.originalname
      );
    }

    await prisma.$transaction([
      prisma.materialVersion.create({
        data: {
          institutionId,
          studyMaterialId: material.id,
          versionNumber: newVersionNumber,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: uploadResult.fileSizeBytes,
          s3Key: uploadResult.s3Key,
          convertedS3Key,
          isConverted: Boolean(convertedS3Key),
          changeNote: changeNote || `Updated to version ${newVersionNumber}`,
        },
      }),
      prisma.studyMaterial.update({
        where: { id: material.id },
        data: {
          currentVersion: newVersionNumber,
        },
      }),
    ]);

    await createAuditLog({
      institutionId,
      userId,
      action: 'MATERIAL_VERSION_REPLACED',
      resource: 'study_material',
      resourceId: material.id,
      details: { newVersionNumber, originalFilename: file.originalname, changeNote },
      req,
    });

    return this.getMaterialById(institutionId, material.id, userId, RoleType.FACULTY);
  }

  /**
   * Retrieve list of materials scoped by institution and student section permissions
   */
  static async listMaterials(
    institutionId: string,
    userId: string,
    role: RoleType,
    query: {
      subjectId?: string;
      unitId?: string;
      search?: string;
      type?: MaterialType;
      semesterId?: string;
      bookmarkedOnly?: boolean;
    }
  ) {
    const where: any = {
      institutionId,
    };

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.unitId) {
      where.unitId = query.unitId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.semesterId) {
      where.subject = {
        semesterId: query.semesterId,
      };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Role-specific constraints (Rule 5 & Student Section Scoping)
    if (role === RoleType.STUDENT) {
      // 1. Scheduled publish: only visible if visibleFrom <= now
      where.visibleFrom = { lte: new Date() };

      // 2. Student can only see materials targeted to their enrolled sections OR open to all
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { institutionId, studentId: userId, status: 'ACTIVE' },
        select: { sectionId: true },
      });
      const sectionIds = enrollments.map((enrollment) => enrollment.sectionId);
      where.AND = [
        { subject: { semester: { sections: { some: { institutionId, id: { in: sectionIds } } } } } },
        { OR: [{ targetSections: { none: {} } }, { targetSections: { some: { sectionId: { in: sectionIds } } } }] },
      ];
    }

    if (role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE) {
      const assignments = await prisma.facultyAssignment.findMany({
        where: { institutionId, facultyId: userId },
        select: { subjectId: true, sectionId: true },
      });
      const assignedSubjectSections = assignments.map((assignment) => ({
        subjectId: assignment.subjectId,
        OR: [
          { targetSections: { none: {} } },
          { targetSections: { some: { sectionId: assignment.sectionId } } },
        ],
      }));
      where.AND = [...(where.AND || []), { OR: assignedSubjectSections }];
    }

    if (query.bookmarkedOnly) {
      where.bookmarks = {
        some: { userId },
      };
    }

    const materials = await prisma.studyMaterial.findMany({
      where,
      orderBy: [{ unit: { unitNumber: 'asc' } }, { createdAt: 'desc' }],
      include: {
        subject: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, unitNumber: true, title: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1, // latest version
        },
        bookmarks: {
          where: { userId },
          select: { id: true },
        },
        _count: {
          select: {
            views: true,
            downloads: true,
          },
        },
      },
    });

    return materials.map((m) => ({
      id: m.id,
      institutionId: m.institutionId,
      title: m.title,
      description: m.description,
      type: m.type,
      externalUrl: m.externalUrl,
      visibleFrom: m.visibleFrom,
      allowDownload: m.allowDownload,
      currentVersion: m.currentVersion,
      createdAt: m.createdAt,
      subject: m.subject,
      unit: m.unit,
      createdBy: m.createdBy,
      latestVersion: m.versions[0] || null,
      isBookmarked: m.bookmarks.length > 0,
      viewsCount: m._count.views,
      downloadsCount: m._count.downloads,
    }));
  }

  /**
   * Get single material details with version history
   */
  static async getMaterialById(
    institutionId: string,
    materialId: string,
    userId: string,
    role: RoleType
  ) {
    const material = await prisma.studyMaterial.findFirst({
      where: { id: materialId, institutionId },
      include: {
        subject: {
          include: {
            semester: { include: { program: { select: { departmentId: true } } } },
          },
        },
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        targetSections: {
          include: { section: true },
        },
        bookmarks: {
          where: { userId },
        },
        _count: {
          select: { views: true, downloads: true },
        },
      },
    });

    if (
      !material ||
      material.visibleFrom > new Date() ||
      !(await this.userCanAccessMaterial(institutionId, { userId, role }, material))
    ) {
      throw { status: 404, message: 'Study material not found' };
    }

    return {
      ...material,
      isBookmarked: material.bookmarks.length > 0,
      viewsCount: material._count.views,
      downloadsCount: material._count.downloads,
    };
  }

  /**
   * Record a view and return a signed temporary stream URL (Rule 5: PDF or Converted PDF)
   */
  static async getViewUrl(
    institutionId: string,
    materialId: string,
    userId: string,
    role: RoleType,
    versionNumber?: number
  ) {
    const material = await this.getMaterialById(institutionId, materialId, userId, role);

    const version = versionNumber
      ? material.versions.find((v) => v.versionNumber === versionNumber)
      : material.versions[0];

    if (!version) {
      throw { status: 404, message: 'Requested file version not found' };
    }

    // Record view asynchronously
    prisma.materialView
      .create({
        data: {
          institutionId,
          studyMaterialId: material.id,
          userId,
        },
      })
      .catch(() => console.error('Failed to log material view.'));

    // For PPT / DOCX, prefer the server-converted PDF preview if available
    const keyToPreview = version.convertedS3Key || version.s3Key;
    const filenameToPreview = version.convertedS3Key
      ? `${version.originalFilename}.pdf`
      : version.originalFilename;

    const signedUrl = await StorageService.getSignedViewUrl(keyToPreview, filenameToPreview, 3600);

    return {
      viewUrl: signedUrl,
      originalFilename: version.originalFilename,
      mimeType: version.convertedS3Key ? 'application/pdf' : version.mimeType,
      isConverted: Boolean(version.convertedS3Key),
      versionNumber: version.versionNumber,
      allowDownload: material.allowDownload,
    };
  }

  /**
   * Enforces server-side download permissions (Rule: cannot download if allowDownload is false)
   */
  static async getDownloadUrl(
    institutionId: string,
    materialId: string,
    userId: string,
    role: RoleType,
    versionNumber?: number,
    req?: Request
  ) {
    const material = await this.getMaterialById(institutionId, materialId, userId, role);

    // Strict Rule: Download button only works if allowDownload is true, enforced on server
    if (!material.allowDownload) {
      throw {
        status: 403,
        message: 'Download Forbidden: The instructor has restricted downloading for this material.',
      };
    }

    const version = versionNumber
      ? material.versions.find((v) => v.versionNumber === versionNumber)
      : material.versions[0];

    if (!version) {
      throw { status: 404, message: 'Requested file version not found' };
    }

    // Track download record
    await prisma.materialDownload.create({
      data: {
        institutionId,
        studyMaterialId: material.id,
        userId,
      },
    });

    await createAuditLog({
      institutionId,
      userId,
      action: 'MATERIAL_DOWNLOADED',
      resource: 'study_material',
      resourceId: material.id,
      details: { versionNumber: version.versionNumber, filename: version.originalFilename },
      req,
    });

    const signedUrl = await StorageService.getSignedDownloadUrl(
      version.s3Key,
      version.originalFilename,
      1800
    );

    return {
      downloadUrl: signedUrl,
      filename: version.originalFilename,
    };
  }

  /**
   * Bookmark / Unbookmark toggle
   */
  static async toggleBookmark(institutionId: string, materialId: string, userId: string, role: RoleType) {
    await this.getMaterialById(institutionId, materialId, userId, role);
    const existing = await prisma.materialBookmark.findUnique({
      where: {
        studyMaterialId_userId: {
          studyMaterialId: materialId,
          userId,
        },
      },
    });

    if (existing) {
      await prisma.materialBookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    } else {
      await prisma.materialBookmark.create({
        data: {
          institutionId,
          studyMaterialId: materialId,
          userId,
        },
      });
      return { bookmarked: true };
    }
  }

  /**
   * Faculty / Admin: Fetch Units for a subject
   */
  static async getUnitsBySubject(institutionId: string, subjectId: string, userId: string, role: RoleType) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, institutionId },
      select: { id: true, semesterId: true, semester: { select: { program: { select: { departmentId: true } } } } },
    });
    if (!subject) throw { status: 404, message: 'Subject not found' };
    let allowed = role === RoleType.ADMIN || role === RoleType.SUPER_ADMIN;
    if (role === RoleType.STUDENT) {
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: { institutionId, studentId: userId, status: 'ACTIVE', section: { semesterId: subject.semesterId } },
        select: { id: true },
      });
      allowed = Boolean(enrollment);
    } else if (role === RoleType.HOD) {
      const actor = await prisma.user.findFirst({ where: { id: userId, institutionId }, select: { departmentId: true } });
      allowed = actor?.departmentId === subject.semester.program.departmentId;
    } else if (role === RoleType.FACULTY || role === RoleType.CLASS_INCHARGE) {
      const assignment = await prisma.facultyAssignment.findFirst({ where: { institutionId, facultyId: userId, subjectId }, select: { id: true } });
      allowed = Boolean(assignment);
    }
    if (!allowed) throw { status: 404, message: 'Subject not found' };
    return prisma.unit.findMany({
      where: { institutionId, subjectId },
      orderBy: { unitNumber: 'asc' },
    });
  }

  /**
   * Faculty / Admin: Create Unit for a subject
   */
  static async createUnit(
    institutionId: string,
    subjectId: string,
    unitNumber: number,
    title: string,
    description?: string
  ) {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, institutionId }, select: { id: true } });
    if (!subject) throw { status: 404, message: 'Subject not found' };
    return prisma.unit.create({
      data: {
        institutionId,
        subjectId,
        unitNumber,
        title,
        description,
      },
    });
  }
}
