import { Request, Response, NextFunction } from 'express';
import { MaterialService } from '../services/material.service.js';
import { StorageService } from '../services/storage.service.js';
import { MaterialType, RoleType } from '@prisma/client';
import fs from 'fs';

export class MaterialController {
  static async listSubjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjects = await MaterialService.listSubjectsForUser(req.institutionId!, req.user!.userId, req.user!.role);
      res.status(200).json({ subjects });
    } catch (error) { next(error); }
  }

  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const file = req.file;

      const {
        subjectId,
        unitId,
        title,
        description,
        type,
        externalUrl,
        visibleFrom,
        allowDownload,
        targetSectionIds,
      } = req.body;

      const parsedTargetSectionIds = targetSectionIds
        ? typeof targetSectionIds === 'string'
          ? JSON.parse(targetSectionIds)
          : targetSectionIds
        : [];

      const material = await MaterialService.createMaterial(
        institutionId,
        userId,
        {
          subjectId,
          unitId: unitId || undefined,
          title,
          description,
          type: type as MaterialType,
          externalUrl,
          visibleFrom,
          allowDownload: allowDownload === 'true' || allowDownload === true,
          targetSectionIds: parsedTargetSectionIds,
        },
        file,
        req
      );

      res.status(201).json({
        message: 'Study material uploaded successfully',
        material,
      });
    } catch (error) {
      next(error);
    }
  }

  static async replaceVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const materialId = req.params.materialId;
      const file = req.file;
      const changeNote = req.body.changeNote || 'File replaced';

      if (!file) {
        res.status(400).json({ message: 'A replacement file is required' });
        return;
      }

      const updated = await MaterialService.replaceMaterialFile(
        institutionId,
        materialId,
        userId,
        changeNote,
        file,
        req
      );

      res.status(200).json({
        message: 'Material updated with new version successfully',
        material: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;

      const { subjectId, unitId, search, type, semesterId, bookmarkedOnly } = req.query;

      const materials = await MaterialService.listMaterials(institutionId, userId, role, {
        subjectId: subjectId as string,
        unitId: unitId as string,
        search: search as string,
        type: type as MaterialType,
        semesterId: semesterId as string,
        bookmarkedOnly: bookmarkedOnly === 'true',
      });

      res.status(200).json({ materials });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const materialId = req.params.materialId;

      const material = await MaterialService.getMaterialById(
        institutionId,
        materialId,
        userId,
        role
      );

      res.status(200).json({ material });
    } catch (error) {
      next(error);
    }
  }

  static async getViewUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const materialId = req.params.materialId;
      const versionNumber = req.query.version ? parseInt(req.query.version as string, 10) : undefined;

      const result = await MaterialService.getViewUrl(
        institutionId,
        materialId,
        userId,
        role,
        versionNumber
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const materialId = req.params.materialId;
      const versionNumber = req.query.version ? parseInt(req.query.version as string, 10) : undefined;

      const result = await MaterialService.getDownloadUrl(
        institutionId,
        materialId,
        userId,
        role,
        versionNumber,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async toggleBookmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const materialId = req.params.materialId;

      const result = await MaterialService.toggleBookmark(institutionId, materialId, userId, req.user!.role);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async listUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const subjectId = req.params.subjectId;

      const units = await MaterialService.getUnitsBySubject(
        institutionId,
        subjectId,
        req.user!.userId,
        req.user!.role
      );
      res.status(200).json({ units });
    } catch (error) {
      next(error);
    }
  }

  static async createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const subjectId = req.params.subjectId;
      const { unitNumber, title, description } = req.body;

      const unit = await MaterialService.createUnit(
        institutionId,
        subjectId,
        parseInt(unitNumber, 10),
        title,
        description
      );

      res.status(201).json({ unit });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Local storage stream handler for fallback development (simulating S3)
   */
  static async streamFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const s3Key = req.params.s3Key;
      const isDownload = req.query.download === 'true';
      const file = await MaterialService.authorizeLocalFileStream(
        req.institutionId!,
        {
          userId: req.user!.userId,
          role: req.user!.role,
        },
        s3Key,
        isDownload
      );
      const filePath = StorageService.getLocalFilePath(s3Key);

      let fileStat: fs.Stats;
      try {
        fileStat = await fs.promises.stat(filePath);
      } catch {
        res.status(404).json({ message: 'File not found' });
        return;
      }
      if (!fileStat.isFile()) {
        res.status(404).json({ message: 'File not found' });
        return;
      }

      const disposition = isDownload ? 'attachment' : 'inline';
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`
      );
      fs.createReadStream(filePath).on('error', (error) => {
        if (!res.headersSent) res.status(404).json({ message: 'File not found' });
        else next(error);
      }).pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
