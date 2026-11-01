import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { RoleType } from '@prisma/client';

/**
 * Middleware ensuring that a faculty member can only manage (upload/edit/delete)
 * resources for subjects they are explicitly assigned to.
 * Admins and Super Admins bypass this check.
 */
export const requireFacultySubjectAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    const institutionId = req.institutionId;

    if (!user || !institutionId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Admins have full institutional oversight
    if (user.role === RoleType.ADMIN || user.role === RoleType.SUPER_ADMIN) {
      next();
      return;
    }

    if (user.role !== RoleType.FACULTY && user.role !== RoleType.HOD && user.role !== RoleType.CLASS_INCHARGE) {
      res.status(403).json({ message: 'Access denied: Faculty privilege required' });
      return;
    }

    const subjectId = req.body.subjectId || req.query.subjectId || req.params.subjectId;
    if (!subjectId) {
      // If updating a material directly, look up its subject
      const materialId = req.params.materialId;
      if (materialId) {
        const material = await prisma.studyMaterial.findFirst({
          where: { id: materialId, institutionId },
          select: { subjectId: true, createdById: true },
        });

        if (!material) {
          res.status(404).json({ message: 'Study material not found' });
          return;
        }

        // Check assignment for this material's subject
        const assignment = await prisma.facultyAssignment.findFirst({
          where: {
            institutionId,
            facultyId: user.userId,
            subjectId: material.subjectId,
          },
        });

        if (!assignment && material.createdById !== user.userId) {
          res.status(403).json({
            message: 'Forbidden: You are not assigned to the subject of this material.',
          });
          return;
        }

        next();
        return;
      }

      res.status(400).json({ message: 'Subject ID is required for faculty resource verification' });
      return;
    }

    const assignment = await prisma.facultyAssignment.findFirst({
      where: {
        institutionId,
        facultyId: user.userId,
        subjectId: String(subjectId),
      },
    });

    if (!assignment) {
      res.status(403).json({
        message: 'Forbidden: You are not assigned to teach or manage this subject.',
      });
      return;
    }

    // A material is visible to specific section audiences; verify the faculty member's
    // subject-section assignment before they create that audience. Subject-only
    // checks could otherwise let them target an unassigned section or every section.
    if (req.method === 'POST' && req.path === '/') {
      let targetSectionIds = req.body?.targetSectionIds;
      try {
        if (typeof targetSectionIds === 'string') targetSectionIds = JSON.parse(targetSectionIds);
      } catch {
        res.status(400).json({ message: 'targetSectionIds must be a valid JSON array' });
        return;
      }
      const ids = Array.isArray(targetSectionIds) ? [...new Set(targetSectionIds.map(String))] : [];
      if (ids.length === 0) {
        res.status(400).json({ message: 'At least one assigned target section is required' });
        return;
      }
      const matchingAssignments = await prisma.facultyAssignment.count({
        where: { institutionId, facultyId: user.userId, subjectId: String(subjectId), sectionId: { in: ids } },
      });
      if (matchingAssignments !== ids.length) {
        res.status(403).json({ message: 'You may only publish materials to sections assigned to you for this subject.' });
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
