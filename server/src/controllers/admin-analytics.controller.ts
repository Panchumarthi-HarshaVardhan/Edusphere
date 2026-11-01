import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { AdminAnalyticsService } from '../services/admin-analytics.service.js';

function filters(req: Request) {
  return {
    academicYearId: req.query.academicYearId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
    semesterId: req.query.semesterId as string | undefined,
    sectionId: req.query.sectionId as string | undefined,
  };
}
function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export class AdminAnalyticsController {
  static async dashboard(req: Request, res: Response) {
    try { return res.status(200).json(await AdminAnalyticsService.getDashboard(req.institutionId!, filters(req))); }
    catch (error: any) { return res.status(400).json({ message: error.message || 'Could not load analytics' }); }
  }

  static async exportAttendanceShortages(req: Request, res: Response) {
    try {
      const rows = await AdminAnalyticsService.getAttendanceShortages(req.institutionId!, filters(req));
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const columns = ['firstName', 'lastName', 'email', 'section', 'totalSessions', 'attended', 'percentage'] as const;
      if (format === 'csv') {
        const body = [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-shortages.csv"');
        return res.status(200).send(body);
      }
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance Shortages');
      sheet.columns = columns.map((key) => ({ header: key, key, width: key === 'email' ? 32 : 20 }));
      rows.forEach((row) => sheet.addRow(Object.fromEntries(columns.map((key) => [key, row[key]]))));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-shortages.xlsx"');
      return res.status(200).send(Buffer.from(await workbook.xlsx.writeBuffer()));
    } catch (error: any) { return res.status(400).json({ message: error.message || 'Could not export attendance shortages' }); }
  }
}
