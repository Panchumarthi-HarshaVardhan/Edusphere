import type { FacultyDashboardData } from '../types/dashboard';

export type FacultyAssignment = FacultyDashboardData['assignedSubjects'][number];

interface Props {
  assignments: FacultyAssignment[];
  subjectId: string;
  sectionId: string;
  onSubjectChange: (subjectId: string) => void;
  onSectionChange: (sectionId: string) => void;
  disabled?: boolean;
}

const selectClass = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';

export function FacultyAssignmentSelectors({ assignments, subjectId, sectionId, onSubjectChange, onSectionChange, disabled = false }: Props) {
  const subjects = Array.from(new Map(assignments.map((assignment) => [assignment.subjectId, assignment])).values());
  const sections = assignments.filter((assignment) => assignment.subjectId === subjectId);

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
      Subject
      <select required disabled={disabled || !assignments.length} value={subjectId} onChange={(event) => onSubjectChange(event.target.value)} className={selectClass}>
        <option value="">Choose an assigned subject</option>
        {subjects.map((assignment) => <option key={assignment.subjectId} value={assignment.subjectId}>{assignment.subjectCode} - {assignment.subjectName}</option>)}
      </select>
    </label>
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
      Section
      <select required disabled={disabled || !sections.length} value={sectionId} onChange={(event) => onSectionChange(event.target.value)} className={selectClass}>
        <option value="">Choose an assigned section</option>
        {sections.map((assignment) => <option key={assignment.assignmentId} value={assignment.sectionId}>{assignment.sectionName} · {assignment.semesterName}</option>)}
      </select>
    </label>
  </div>;
}
