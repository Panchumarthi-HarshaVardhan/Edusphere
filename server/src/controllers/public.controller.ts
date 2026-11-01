import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import type { DemoRequestInput } from '../utils/demo-request.validator.js';

export class PublicController {
  static async createDemoRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, institution, role, email, message, website } = req.body as DemoRequestInput;

      // Treat a filled honeypot as accepted, but never persist it or reveal the check.
      if (website) {
        res.status(202).json({ message: 'Thanks for your interest. We will be in touch.' });
        return;
      }

      await prisma.demoRequest.create({
        data: {
          contactName: name,
          institutionName: institution,
          role,
          email: email.toLowerCase(),
          message,
        },
      });

      res.status(201).json({ message: 'Thanks for your interest. We will be in touch.' });
    } catch (error) {
      next(error);
    }
  }
}
