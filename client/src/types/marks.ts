export type AssessmentType =
  | 'INTERNAL_1'
  | 'INTERNAL_2'
  | 'ASSIGNMENT'
  | 'LAB'
  | 'PRACTICAL'
  | 'VIVA'
  | 'EXTERNAL';

export type PublicationState = 'DRAFT' | 'PUBLISHED';

export interface StudentMarkEntry {
  id: string;
  studentId: string;
  score: number | null;
  gradeLetter: string | null;
  isAbsent: boolean;
  remarks?: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Assessment {
  id: string;
  subjectId: string;
  sectionId: string;
  name: string;
  type: AssessmentType;
  maxMarks: number;
  weightage: number;
  state: PublicationState;
  publishedAt?: string | null;
  createdAt: string;
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  section?: {
    id: string;
    name: string;
  };
  marks?: StudentMarkEntry[];
  _count?: {
    marks: number;
  };
}

export interface ClassStats {
  totalStudents: number;
  totalAppeared: number;
  absentCount: number;
  average: number;
  highest: number;
  lowest: number;
  passPercentage: number;
}

export interface StudentMarksReport {
  sgpa: number;
  totalCredits: number;
  subjectsSummary: Array<{
    subject: {
      id: string;
      name: string;
      code: string;
      credits: number;
    };
    subjectPercentage: number;
    finalGrade: string;
    gradePoint: number;
    totalEarned: number;
    totalPossible: number;
    assessments: Array<{
      assessmentId: string;
      name: string;
      type: AssessmentType;
      score: number | null;
      maxMarks: number;
      gradeLetter: string | null;
      isAbsent: boolean;
      markId: string;
    }>;
  }>;
}
