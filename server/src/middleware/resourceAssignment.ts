import { Request, Response, NextFunction } from 'express';
import { RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

type ResourceContext = {
  subjectId: string;
  sectionId: string;
  departmentId: string;
};

type AssignmentPolicyInput = {
  role: RoleType;
  actorDepartmentId?: string | null;
  resource: ResourceContext | null;
  assignments: Array<{ subjectId: string; sectionId: string }>;
};

/** Apply the common faculty subject+section rule after tenant-scoped lookups. */
export function assertResourceAssignment(input: AssignmentPolicyInput): void {
  if (!input.resource) {
    throw { status: 404, message: 'Resource not found' };
  }

  if (input.role === RoleType.ADMIN || input.role === RoleType.SUPER_ADMIN) return;

  if (
    input.role === RoleType.HOD &&
    input.actorDepartmentId &&
    input.actorDepartmentId === input.resource.departmentId
  ) {
    return;
  }

  const hasExactAssignment = input.assignments.some(
    (assignment) =>
      assignment.subjectId === input.resource!.subjectId &&
      assignment.sectionId === input.resource!.sectionId
  );
  if (!hasExactAssignment) {
    throw { status: 403, message: 'You are not assigned to this subject and section' };
  }
}

type ResourceKind = 'attendance-session' | 'attendance-correction' | 'assessment' | 'classroom-session' | 'canvas-asset' | 'subject-section';

async function findResourceContext(
  kind: ResourceKind,
  req: Request,
  institutionId: string
): Promise<ResourceContext | null> {
  const relationSelect = {
    subject: {
      select: {
        semester: { select: { program: { select: { departmentId: true } } } },
      },
    },
  } as const;

  if (kind === 'attendance-session') {
    const row = await prisma.attendanceSession.findFirst({
      where: { id: req.params.sessionId, institutionId },
      select: { subjectId: true, sectionId: true, ...relationSelect },
    });
    if (!row) return null;
    return {
      subjectId: row.subjectId,
      sectionId: row.sectionId,
      departmentId: row.subject.semester.program.departmentId,
    };
  }

  if (kind === 'attendance-correction') {
    const row = await prisma.attendanceCorrectionRequest.findFirst({
      where: { id: req.params.requestId, institutionId },
      select: {
        record: {
          select: {
            session: { select: { subjectId: true, sectionId: true, ...relationSelect } },
          },
        },
      },
    });
    if (!row) return null;
    const session = row.record.session;
    return {
      subjectId: session.subjectId,
      sectionId: session.sectionId,
      departmentId: session.subject.semester.program.departmentId,
    };
  }

  if (kind === 'assessment') {
    const row = await prisma.assessment.findFirst({
      where: { id: req.params.assessmentId, institutionId },
      select: { subjectId: true, sectionId: true, ...relationSelect },
    });
    if (!row) return null;
    return {
      subjectId: row.subjectId,
      sectionId: row.sectionId,
      departmentId: row.subject.semester.program.departmentId,
    };
  }

  if (kind === 'classroom-session') {
    const row = await prisma.classroomSession.findFirst({
      where: { id: req.params.sessionId, institutionId },
      select: { subjectId: true, sectionId: true, subject: relationSelect.subject },
    });
    if (!row) return null;
    return {
      subjectId: row.subjectId,
      sectionId: row.sectionId,
      departmentId: row.subject.semester.program.departmentId,
    };
  }

  if (kind === 'canvas-asset') {
    const asset = await prisma.canvasAsset.findFirst({
      where: { id: req.params.assetId, institutionId },
      select: {
        session: {
          select: {
            subjectId: true,
            sectionId: true,
            completedAt: true,
            subject: relationSelect.subject,
          },
        },
      },
    });
    if (!asset || (req.user?.role === RoleType.STUDENT && !asset.session.completedAt)) return null;
    return {
      subjectId: asset.session.subjectId,
      sectionId: asset.session.sectionId,
      departmentId: asset.session.subject.semester.program.departmentId,
    };
  }

  const subjectId = String(req.body.subjectId || req.query.subjectId || '');
  const sectionId = String(req.body.sectionId || req.query.sectionId || '');
  if (!subjectId || !sectionId) return null;

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, institutionId },
    select: {
      id: true,
      semesterId: true,
      semester: { select: { program: { select: { departmentId: true } } } },
    },
  });
  if (!subject) return null;
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId, semesterId: subject.semesterId },
    select: { id: true },
  });
  if (!section) return null;

  return {
    subjectId: subject.id,
    sectionId: section.id,
    departmentId: subject.semester.program.departmentId,
  };
}

/** Reusable exact assignment guard for attendance and marks resources. */
export function requireResourceAssignment(kind: ResourceKind) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const institutionId = req.institutionId;
      if (!user || !institutionId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const resource = await findResourceContext(kind, req, institutionId);
      if ((kind === 'classroom-session' || kind === 'canvas-asset') && user.role === RoleType.STUDENT && resource) {
        const enrolled = await prisma.studentEnrollment.findFirst({
          where: { institutionId, studentId: user.userId, sectionId: resource.sectionId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!enrolled) {
          res.status(403).json({ message: 'You are not enrolled in this section' });
          return;
        }
        next();
        return;
      }
      let actorDepartmentId: string | null | undefined;
      let assignments: Array<{ subjectId: string; sectionId: string }> = [];

      if (user.role === RoleType.HOD) {
        const actor = await prisma.user.findFirst({
          where: { id: user.userId, institutionId, role: RoleType.HOD },
          select: { departmentId: true },
        });
        actorDepartmentId = actor?.departmentId;
      }

      if (resource && user.role !== RoleType.ADMIN && user.role !== RoleType.SUPER_ADMIN) {
        const assignment = await prisma.facultyAssignment.findFirst({
          where: {
            institutionId,
            facultyId: user.userId,
            subjectId: resource.subjectId,
            sectionId: resource.sectionId,
          },
          select: { subjectId: true, sectionId: true },
        });
        assignments = assignment ? [assignment] : [];
      }

      assertResourceAssignment({
        role: user.role,
        actorDepartmentId,
        resource,
        assignments,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
