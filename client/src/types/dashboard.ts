export interface TimetableSlotItem {
  id: string;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber?: string | null;
  status?: string;
  note?: string | null;
  date?: string;
  type?: string;
  subject: {
    id: string;
    code: string;
    name: string;
    credits: number;
  };
  faculty: {
    firstName: string;
    lastName: string;
  };
}

export interface DoubtItem {
  id: string;
  title: string;
  content: string;
  reply?: string | null;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  subject?: {
    id: string;
    code: string;
    name: string;
  };
  student?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface StudentDashboardData {
  enrollment: any;
  todayDayOfWeek: number;
  timetable: TimetableSlotItem[];
  weeklyTimetable?: TimetableSlotItem[];
  calendar?: Array<{ id: string; type: string; date: string; endDate?: string; title: string; status?: string; note?: string | null; periodNumber?: number; startTime?: string; endTime?: string }>;
  attendance: {
    totalConducted: number;
    presentCount: number;
    lateCount: number;
    attendedScore: number;
    overallPercentage: number;
    threshold: number;
    hasShortage: boolean;
  };
  latestMarks: Array<{
    id: string;
    assessmentName: string;
    subjectCode: string;
    subjectName: string;
    type: string;
    score: number | null;
    maxMarks: number;
    gradeLetter: string | null;
    isAbsent: boolean;
    date: string;
  }>;
  recentMaterials: Array<{
    id: string;
    title: string;
    subjectName: string;
    unitTitle?: string;
    type: string;
    allowDownload: boolean;
    createdAt: string;
  }>;
  announcements: AnnouncementItem[];
  unansweredDoubts: DoubtItem[];
}

export interface FacultyDashboardData {
  assignedSubjects: Array<{
    assignmentId: string;
    subjectId: string;
    sectionId: string;
    subjectName: string;
    subjectCode: string;
    credits: number;
    sectionName: string;
    semesterName: string;
    studentCount: number;
  }>;
  todayClasses: Array<{
    id: string; slotId: string; type: string; date: string; title: string; periodNumber: number;
    startTime: string; endTime: string; roomNumber?: string | null; status: string; note?: string | null;
    subject: { id: string; code: string; name: string; credits: number };
    section: { id: string; name: string };
    faculty: { id: string; firstName: string; lastName: string };
  }>;
  weeklyTimetable: Array<{ id: string; sectionId: string; subjectId: string; facultyId: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; roomNumber?: string | null; subject: { id: string; code: string; name: string; credits: number }; section: { id: string; name: string }; faculty: { id: string; firstName: string; lastName: string } }>;
  calendar: Array<{ id: string; type: string; date: string; endDate?: string; title: string; status?: string; note?: string | null; periodNumber?: number; startTime?: string; endTime?: string }>;
  pendingAttendance: Array<{
    id: string;
    subjectName: string;
    subjectCode: string;
    sectionName: string;
    date: string;
    period: number;
  }>;
  recentDoubts: DoubtItem[];
  performanceSummary: Array<{
    id: string;
    name: string;
    subjectCode: string;
    state: string;
    totalStudents: number;
    average: number;
    maxMarks: number;
    passRate: number;
  }>;
  announcements: AnnouncementItem[];
}
