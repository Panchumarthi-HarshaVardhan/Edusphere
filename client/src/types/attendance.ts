export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';
export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  remarks?: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AttendanceSession {
  id: string;
  subjectId: string;
  sectionId: string;
  sessionDate: string;
  periodNumber: number;
  topicCovered?: string | null;
  isCompleted: boolean;
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  section?: {
    id: string;
    name: string;
  };
  records?: AttendanceRecord[];
  _count?: {
    records: number;
  };
}

export interface StudentAttendanceSubjectMetric {
  subject: {
    id: string;
    name: string;
    code: string;
    credits: number;
  };
  totalConducted: number;
  attended: number;
  attendanceCredits: number;
  late: number;
  missed: number;
  percentage: number;
  isShortage: boolean;
  threshold: number;
  neededToReachThreshold: number;
  canAffordToMiss: number;
  records: Array<{
    date: string;
    period: number;
    status: AttendanceStatus;
    recordId: string;
  }>;
}

export interface StudentAttendanceAggregate {
  overallPercentage: number;
  totalConducted: number;
  totalAttended: number;
  attendanceCredits: number;
  threshold: number;
  hasShortage: boolean;
  subjectMetrics: StudentAttendanceSubjectMetric[];
}
