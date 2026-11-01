import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { AdminSetupService } from '../services/admin-setup.service.js';

export class AdminSetupController {
  static async createInstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.createInstitutionWithAdmin(req.body, req.user!.userId, req);
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  }

  static async listEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.list(req.params.entity as any, req.institutionId!, {
        search: req.query.search ? String(req.query.search) : undefined,
        limit: Number(req.query.limit || 25), offset: Number(req.query.offset || 0),
      });
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async createEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.create(req.params.entity as any, req.institutionId!, req.user!.userId, req.body, req);
      return res.status(201).json({ item: result });
    } catch (error) { return next(error); }
  }

  static async updateEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.update(req.params.entity as any, req.institutionId!, req.user!.userId, req.params.id, req.body, req);
      return res.status(200).json({ item: result });
    } catch (error) { return next(error); }
  }

  static async deleteEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.remove(req.params.entity as any, req.institutionId!, req.user!.userId, req.params.id, req);
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.createUser(req.institutionId!, req.user!.userId, req.body, req);
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  }

  static async resetUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.resetUserPassword(req.institutionId!, req.user!.userId, req.params.id, req);
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async setUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.setUserStatus(req.institutionId!, req.user!.userId, req.params.id, req.body.isActive, req);
      return res.status(200).json({ user: result });
    } catch (error) { return next(error); }
  }

  static async assignFaculty(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.assignFaculty(req.institutionId!, req.user!.userId, req.body, req);
      return res.status(201).json({ assignment: result });
    } catch (error) { return next(error); }
  }

  static async listAssignments(req: Request, res: Response, next: NextFunction) {
    try { return res.status(200).json({ assignments: await AdminSetupService.listAssignments(req.institutionId!) }); }
    catch (error) { return next(error); }
  }

  static async enrollStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.enrollStudent(req.institutionId!, req.user!.userId, req.body, req);
      return res.status(200).json({ enrollment: result });
    } catch (error) { return next(error); }
  }

  static async promoteSection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminSetupService.promoteSection(req.institutionId!, req.user!.userId, req.params.sectionId, req.body.targetSectionId, req);
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async importUsers(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) return res.status(400).json({ message: 'Upload an .xlsx or .csv file' });
      const rows = await readRows(req.file.originalname, req.file.buffer);
      const result = await AdminSetupService.importRows(req.institutionId!, req.user!.userId, req.params.role as 'students' | 'faculty', rows, req);
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static downloadTemplate(req: Request, res: Response) {
    const role = req.params.role;
    if (!['students', 'faculty'].includes(role)) return res.status(400).json({ message: 'role must be students or faculty' });
    const headers = role === 'students'
      ? 'email,firstName,lastName,sectionId,rollNumber,departmentId'
      : 'email,firstName,lastName,departmentId';
    res.type('text/csv').attachment(`edusphere-${role}-template.csv`).send(`${headers}\n`);
  }
}

async function readRows(filename: string, buffer: Buffer): Promise<Array<{ rowNumber: number; data: Record<string, string> }>> {
  if (filename.toLowerCase().endsWith('.csv')) return parseCsv(buffer.toString('utf8'));
  if (!filename.toLowerCase().endsWith('.xlsx')) throw Object.assign(new Error('Only .xlsx and .csv files are supported'), { status: 400 });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headers = (sheet.getRow(1).values as Array<unknown>).slice(1).map((value) => String(value ?? '').trim());
  const rows: Array<{ rowNumber: number; data: Record<string, string> }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as Array<unknown>).slice(1);
    const data: Record<string, string> = {};
    headers.forEach((header, index) => { if (header) data[header] = String(values[index] ?? '').trim(); });
    if (Object.values(data).some(Boolean)) rows.push({ rowNumber, data });
  });
  return rows;
}

function parseCsv(input: string): Array<{ rowNumber: number; data: Record<string, string> }> {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const values: string[] = []; let value = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
      else value += char;
    }
    values.push(value.trim()); return values;
  };
  const headers = split(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = split(line); const data: Record<string, string> = {};
    headers.forEach((header, i) => { data[header] = values[i] || ''; });
    return { rowNumber: index + 2, data };
  });
}
