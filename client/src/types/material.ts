export type MaterialType =
  | 'PDF'
  | 'PPT'
  | 'DOCX'
  | 'IMAGE'
  | 'VIDEO_LINK'
  | 'QUESTION_PAPER'
  | 'LAB_MANUAL'
  | 'SYLLABUS';

export interface Unit {
  id: string;
  unitNumber: number;
  title: string;
  description?: string | null;
}

export interface MaterialVersion {
  id: string;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  s3Key: string;
  convertedS3Key?: string | null;
  isConverted: boolean;
  changeNote?: string | null;
  createdAt: string;
}

export interface StudyMaterial {
  id: string;
  institutionId: string;
  title: string;
  description?: string | null;
  type: MaterialType;
  externalUrl?: string | null;
  visibleFrom: string;
  allowDownload: boolean;
  currentVersion: number;
  createdAt: string;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  unit?: Unit | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  latestVersion?: MaterialVersion | null;
  versions?: MaterialVersion[];
  isBookmarked?: boolean;
  viewsCount?: number;
  downloadsCount?: number;
}
