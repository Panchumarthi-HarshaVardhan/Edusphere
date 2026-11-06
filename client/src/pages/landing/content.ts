import {
  Bell, BookOpen, CheckCircle2, ClipboardCheck, FileText, GraduationCap,
  LockKeyhole, MessageCircle, PencilLine, ShieldCheck, Users,
} from 'lucide-react';

export const portalContent = [
  {
    id: 'students', title: 'Students', eyebrow: 'Learn with clarity', icon: GraduationCap,
    description: 'Keep learning resources, class lessons, academic progress, and campus conversations together.',
    bullets: ['Read study materials and saved lessons', 'Track subject attendance and marks', 'Get alerts, ask anonymous doubts, and join scoped community feeds'],
    accent: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'faculty', title: 'Faculty', eyebrow: 'Teach without the busywork', icon: PencilLine,
    description: 'Prepare and deliver lessons, then keep attendance and assessment records in one place.',
    bullets: ['Share notes, presentations, and past papers', 'Teach on a handwriting canvas saved as lessons', 'Record attendance and enter marks online'],
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'admins', title: 'Admins', eyebrow: 'Keep operations connected', icon: ShieldCheck,
    description: 'Set up your academic structure and manage the people, assignments, and oversight around it.',
    bullets: ['Configure departments, classes, sections, and subjects', 'Manage users and bulk imports', 'Review reports, analytics, and audit logs'],
    accent: 'from-emerald-500 to-teal-500',
  },
];

export const featureContent = [
  { id: 'materials', icon: BookOpen, title: 'Unified learning repository', description: 'Organize presentations, notes, and previous year papers by subject.' },
  { id: 'canvas', icon: PencilLine, title: 'Digital classroom canvas', description: 'Teach with a handwriting canvas and save pages as classroom lessons.' },
  { id: 'attendance', icon: ClipboardCheck, title: 'Attendance and marks', description: 'Record attendance by session and make academic progress easier to follow.' },
  { id: 'community', icon: Users, title: 'Campus community', description: 'Keep conversations scoped to the institution, department, year, and section.' },
  { id: 'doubts', icon: MessageCircle, title: 'Anonymous doubts', description: 'Let students ask subject-specific questions without revealing their identity to peers.' },
  { id: 'announcements', icon: Bell, title: 'Alerts and verified announcements', description: 'Help students and faculty keep up with relevant academic notifications and verified campus updates.' },
];

export const workflowSteps = [
  ['01', 'Set up your institution', 'An institution admin configures the school or university hierarchy.'],
  ['02', 'Add your people', 'Create accounts individually or import students and faculty in bulk.'],
  ['03', 'Teach and record', 'Faculty share materials, teach lessons, and record attendance and marks.'],
  ['04', 'Learn and track', 'Students see their learning resources, timetable, attendance, marks, and updates.'],
];

export const securityPoints = [
  { icon: LockKeyhole, title: 'Institution data stays separate', description: 'Tenant scoping keeps each institution’s workspace isolated.' },
  { icon: ShieldCheck, title: 'Access follows roles', description: 'Role-based permissions protect administrative and academic workflows.' },
  { icon: FileText, title: 'Academic changes are accountable', description: 'Published mark edits require authorization and create an audit record.' },
  { icon: CheckCircle2, title: 'Students have read-only access', description: 'Students can view shared materials and lessons; material downloads follow institution settings.' },
];

export const roadmapItems = [
  ['AI study assistant', 'Coming soon'], ['Online exams', 'Coming soon'],
  ['Live classes', 'Coming soon'], ['Mobile app', 'Coming soon'],
];

export const faqItems = [
  ['Who creates accounts?', 'Institution administrators create accounts and can import students and faculty. EduSphere does not offer public sign-up.'],
  ['Can students download materials?', 'Downloads are controlled by material permissions. Students can only download a material when its download setting allows it.'],
  ['Is our data separate from other institutions?', 'Yes. The platform scopes institution data so one institution’s users cannot access another institution’s records.'],
  ['Does it work for schools and universities?', 'EduSphere supports school and university academic hierarchies, including classes and sections or departments, programs, years, semesters, and sections.'],
  ['Can faculty use a tablet with a stylus?', 'The digital canvas is designed for handwriting input. The experience depends on the browser and device’s stylus support.'],
];

export const trustItems = ['Schools', 'Colleges', 'Universities', 'Training institutes'];
export const comparisonItems = [
  { title: 'WhatsApp groups', detail: 'Updates disappear in busy chat threads.' },
  { title: 'Spreadsheets', detail: 'Attendance and marks need manual reconciliation.' },
  { title: 'Shared drives', detail: 'Materials become hard to find and keep organized.' },
];
