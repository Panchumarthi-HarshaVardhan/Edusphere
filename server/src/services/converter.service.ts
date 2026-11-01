import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { StorageService } from './storage.service.js';

const execAsync = promisify(exec);

export class DocumentConverterService {
  /**
   * Attempts to find LibreOffice/soffice executable across OS paths
   */
  private static getSofficeCommand(): string | null {
    const candidates = [
      'soffice',
      'libreoffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      '/usr/bin/libreoffice',
      '/usr/bin/soffice',
    ];

    for (const cmd of candidates) {
      if (fs.existsSync(cmd)) {
        return `"${cmd}"`;
      }
    }
    return null;
  }

  /**
   * Converts Office documents (PPT, PPTX, DOC, DOCX) to PDF.
   * If LibreOffice is not installed, gracefully returns null so fallback / native handling occurs.
   */
  static async convertOfficeToPdf(
    institutionId: string,
    originalS3Key: string,
    originalFilename: string
  ): Promise<string | null> {
    const sofficeCmd = this.getSofficeCommand();
    if (!sofficeCmd) {
      console.warn('[DocumentConverter] LibreOffice binary not found; skipping server-side PDF conversion.');
      return null;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusphere-convert-'));
    try {
      const fileBuffer = await StorageService.getFileBuffer(originalS3Key);
      const ext = path.extname(originalFilename);
      const tempInputFile = path.join(tempDir, `input${ext}`);
      fs.writeFileSync(tempInputFile, fileBuffer);

      // Execute LibreOffice headless conversion to PDF
      const cmd = `${sofficeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${tempInputFile}"`;
      await execAsync(cmd, { timeout: 30000 });

      const tempOutputFile = path.join(tempDir, 'input.pdf');
      if (!fs.existsSync(tempOutputFile)) {
        console.error('[DocumentConverter] Converted PDF file was not generated');
        return null;
      }

      const convertedPdfBuffer = fs.readFileSync(tempOutputFile);
      const convertedFilename = `${path.parse(originalFilename).name}_converted.pdf`;

      const uploadResult = await StorageService.uploadFile(
        institutionId,
        'materials_converted',
        convertedFilename,
        convertedPdfBuffer,
        'application/pdf'
      );

      return uploadResult.s3Key;
    } catch (error) {
      console.error('[DocumentConverter] Conversion error.');
      return null;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
