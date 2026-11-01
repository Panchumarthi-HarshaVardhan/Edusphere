export interface CanvasStroke {
  id: string;
  tool: 'pen' | 'eraser' | 'rectangle' | 'circle' | 'text' | 'image';
  color?: string;
  size?: number;
  points?: number[]; // [x1, y1, x2, y2, ...]
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  imageUrl?: string;
  imageAssetId?: string;
}

export interface CanvasPage {
  id: string;
  pageNumber: number;
  backgroundAssetUrl?: string | null;
  strokesJson: CanvasStroke[];
  updatedAt: string;
}

export interface ClassroomSession {
  id: string;
  institutionId: string;
  title: string;
  sessionDate: string;
  allowDownload: boolean;
  isArchived: boolean;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  section: {
    id: string;
    name: string;
  };
  faculty: {
    id: string;
    firstName: string;
    lastName: string;
  };
  pages?: CanvasPage[];
  _count?: {
    pages: number;
  };
}
