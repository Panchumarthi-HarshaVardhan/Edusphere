import { Request, Response, NextFunction } from 'express';
import { CanvasService } from '../services/canvas.service.js';
import { StorageService } from '../services/storage.service.js';

export class CanvasController {
  static async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const { subjectId, sectionId, title, sessionDate, allowDownload } = req.body;

      const session = await CanvasService.createSession(
        institutionId,
        facultyId,
        {
          subjectId,
          sectionId,
          title,
          sessionDate,
          allowDownload: allowDownload === 'true' || allowDownload === true,
        },
        req
      );

      res.status(201).json({ message: 'Classroom session created', session });
    } catch (error) {
      next(error);
    }
  }

  static async savePage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const sessionId = req.params.sessionId;
      const pageNumber = parseInt(req.params.pageNumber, 10);
      const { strokesJson, backgroundAssetUrl } = req.body;

      const page = await CanvasService.savePage(
        institutionId,
        sessionId,
        pageNumber,
        strokesJson,
        backgroundAssetUrl
      );

      res.status(200).json({ message: 'Page autosaved', page });
    } catch (error) {
      next(error);
    }
  }

  static async addPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const sessionId = req.params.sessionId;

      const page = await CanvasService.addPage(institutionId, sessionId);
      res.status(201).json({ message: 'Page added', page });
    } catch (error) {
      next(error);
    }
  }

  static async deletePage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const sessionId = req.params.sessionId;
      const pageNumber = parseInt(req.params.pageNumber, 10);

      const result = await CanvasService.deletePage(institutionId, sessionId, pageNumber);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async importSlides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const sessionId = req.params.sessionId;
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: 'Document file required' });
        return;
      }

      const result = await CanvasService.importDocumentSlides(institutionId, sessionId, file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async uploadAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: 'Image file required' });
        return;
      }

      const result = await CanvasService.uploadCanvasAsset(institutionId, req.params.sessionId, file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async completeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CanvasService.completeSession(
        req.institutionId!,
        req.params.sessionId,
        req.user!.userId,
        req
      );
      res.status(200).json({ message: 'Class completed and canvas shared with students', session: result });
    } catch (error) {
      next(error);
    }
  }

  static async streamAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await CanvasService.getCanvasAsset(req.institutionId!, req.params.assetId);
      await CanvasService.getSessionById(
        req.institutionId!,
        asset.classroomSessionId,
        req.user!.userId,
        req.user!.role
      );
      const buffer = await StorageService.getFileBuffer(asset.s3Key);
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(asset.originalFilename)}`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { subjectId, sectionId, search } = req.query;

      const sessions = await CanvasService.listSessions(institutionId, userId, role, {
        subjectId: subjectId as string,
        sectionId: sectionId as string,
        search: search as string,
      });

      res.status(200).json({ sessions });
    } catch (error) {
      next(error);
    }
  }

  static async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const sessionId = req.params.sessionId;

      const session = await CanvasService.getSessionById(institutionId, sessionId, userId, role);
      res.status(200).json({ session });
    } catch (error) {
      next(error);
    }
  }
}
