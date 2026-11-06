import React, { useMemo, useState, useEffect } from 'react';
import { PortalLayout } from '../components/PortalLayout';
import {
  BookMarked,
  CalendarCheck,
  FileSpreadsheet,
  Presentation,
  FolderGit2,
  Plus,
  Eye,
  Download,
  RefreshCw,
  Search,
  FileText,
  LayoutDashboard,
  HelpCircle,
  Megaphone,
  CheckCircle2,
  Users,
  BarChart3,
  Pin,
  MessageSquare,
  UserRound,
  Settings2,
} from 'lucide-react';

import api from '../api/client';
import type { StudyMaterial } from '../types/material';
import { MaterialUploadModal } from '../components/MaterialUploadModal';
import { ReplaceVersionModal } from '../components/ReplaceVersionModal';
import { PdfViewer } from '../components/PdfViewer';
import { CanvasWorkspace } from '../components/CanvasWorkspace';
import { CreateSessionModal } from '../components/CreateSessionModal';
import { AttendanceMarkingModal } from '../components/AttendanceMarkingModal';
import { CreateAssessmentModal } from '../components/CreateAssessmentModal';
import { MarksEntryGridModal } from '../components/MarksEntryGridModal';
import { ReplyDoubtModal } from '../components/ReplyDoubtModal';
import { PostAnnouncementModal } from '../components/PostAnnouncementModal';
import { CommunityFeed } from '../components/CommunityFeed';
import { DoubtsPortal } from '../components/DoubtsPortal';
import { useAuth } from '../context/AuthContext';
import type { ClassroomSession } from '../types/canvas';
import type { AttendanceSession } from '../types/attendance';
import type { Assessment } from '../types/marks';
import type { FacultyDashboardData, DoubtItem } from '../types/dashboard';
import { FacultyAssignmentSelectors } from '../components/FacultyAssignmentSelectors';
import { AppearanceSettingsPage, ProfilePage } from '../components/ProfileSettings';

export const FacultyPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'materials' | 'canvas' | 'attendance' | 'marks' | 'community' | 'doubts' | 'profile' | 'settings'
  >('dashboard');
  const [dashboardData, setDashboardData] = useState<FacultyDashboardData | null>(null);
  const [activeReplyDoubt, setActiveReplyDoubt] = useState<DoubtItem | null>(null);
  const [isPostAnnouncementOpen, setIsPostAnnouncementOpen] = useState(false);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<AttendanceSession[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAttendanceSession, setActiveAttendanceSession] = useState<AttendanceSession | null>(
    null
  );
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [isCreateAssessmentOpen, setIsCreateAssessmentOpen] = useState(false);
  const [assignments, setAssignments] = useState<FacultyDashboardData['assignedSubjects']>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [attendanceSubjectId, setAttendanceSubjectId] = useState('');
  const [attendanceSectionId, setAttendanceSectionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const subjects = useMemo(() => Array.from(new Map(assignments.map((assignment) => [assignment.subjectId, {
    id: assignment.subjectId, name: assignment.subjectName, code: assignment.subjectCode,
  }])).values()), [assignments]);
  const canManageAssignments = !assignmentsLoading && !assignmentsError && assignments.length > 0;

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [replacingMaterial, setReplacingMaterial] = useState<StudyMaterial | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<{ id: string; title: string } | null>(
    null
  );
  const [activeCanvasSession, setActiveCanvasSession] = useState<any | null>(null);
  const [scheduleActionError, setScheduleActionError] = useState<string | null>(null);

  const pageHeader: Record<typeof activeTab, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
    dashboard: {
      title: 'Faculty Command Center',
      description: 'Your teaching schedule, pending roll-calls, and student doubt alerts.',
      icon: LayoutDashboard,
    },
    materials: {
      title: 'Study Materials Hub',
      description: 'Upload course notes, syllabi, and question papers with auto-versioning and student engagement tracking.',
      icon: FolderGit2,
    },
    canvas: {
      title: 'Digital Classroom Sessions',
      description: 'Teach with an interactive whiteboard canvas and save board notes directly as student lessons.',
      icon: Presentation,
    },
    attendance: {
      title: 'Session Attendance',
      description: 'Conduct attendance roll-calls for each session and track student attendance percentages.',
      icon: CalendarCheck,
    },
    marks: {
      title: 'Gradebook & Assessment Entry',
      description: 'Record marks, publish assessment results, and manage student grades.',
      icon: FileSpreadsheet,
    },
    community: {
      title: 'Campus Community',
      description: 'Post verified announcements, create polls, and discuss academic topics with students.',
      icon: MessageSquare,
    },
    doubts: {
      title: 'Doubts & Solutions',
      description: 'Address student doubts, provide verified answers, and support peer learning.',
      icon: HelpCircle,
    },
    profile: {
      title: 'My Profile',
      description: 'View and update your faculty profile details.',
      icon: UserRound,
    },
    settings: {
      title: 'Appearance Settings',
      description: 'Choose your preferred appearance for EduSphere.',
      icon: Settings2,
    },
  };

  const sidebarItems = [
    {
      icon: LayoutDashboard,
      label: 'Faculty Dashboard',
      active: activeTab === 'dashboard',
      onClick: () => setActiveTab('dashboard'),
    },
    {
      icon: FolderGit2,
      label: 'Study Materials (S3)',
      active: activeTab === 'materials',
      onClick: () => setActiveTab('materials'),
    },
    {
      icon: Presentation,
      label: 'Konva Canvas Lessons',
      badge: 'Interactive',
      active: activeTab === 'canvas',
      onClick: () => setActiveTab('canvas'),
    },
    {
      icon: CalendarCheck,
      label: 'Session Attendance',
      badge: 'Per-Session',
      active: activeTab === 'attendance',
      onClick: () => setActiveTab('attendance'),
    },
    {
      icon: FileSpreadsheet,
      label: 'Gradebook & Marks',
      badge: 'Audit-logged',
      active: activeTab === 'marks',
      onClick: () => setActiveTab('marks'),
    },
    {
      icon: MessageSquare,
      label: 'Campus Community',
      badge: 'Verified',
      active: activeTab === 'community',
      onClick: () => setActiveTab('community'),
    },
    {
      icon: HelpCircle,
      label: 'Doubts & Solutions',
      badge: 'Q&A',
      active: activeTab === 'doubts',
      onClick: () => setActiveTab('doubts'),
    },
  ];

  const fetchDashboard = async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const res = await api.get('/dashboard/faculty');
      setDashboardData(res.data);
      setAssignments(res.data.assignedSubjects || []);
    } catch (err) {
      console.error('Failed to fetch faculty dashboard:');
      setAssignments([]);
      setAssignmentsError('Could not load your faculty assignments. Retry to refresh your assigned subjects and sections.');
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (selectedSubject) params.subjectId = selectedSubject;

      const res = await api.get('/materials', { params });
      setMaterials(res.data.materials || []);
    } catch (err) {
      console.error('Failed to fetch materials:');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/canvas/sessions');
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:');
    }
  };

  const fetchPendingAttendance = async () => {
    try {
      const res = await api.get('/attendance/pending-sessions');
      setPendingAttendance(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch pending attendance:');
    }
  };

  const fetchAssessments = async () => {
    try {
      const res = await api.get('/marks/assessments');
      setAssessments(res.data.assessments || []);
    } catch (err) {
      console.error('Failed to fetch assessments:');
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchSessions();
    fetchPendingAttendance();
    fetchAssessments();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [search, selectedSubject]);

  useEffect(() => {
    const validPair = assignments.find((assignment) => assignment.subjectId === attendanceSubjectId && assignment.sectionId === attendanceSectionId);
    if (!validPair) {
      setAttendanceSubjectId(assignments[0]?.subjectId || '');
      setAttendanceSectionId(assignments[0]?.sectionId || '');
    }
  }, [assignments, attendanceSubjectId, attendanceSectionId]);

  const openCanvasSession = async (sessionId: string) => {
    try {
      const res = await api.get(`/canvas/sessions/${sessionId}`);
      setActiveCanvasSession(res.data.session);
    } catch (err) {
      console.error('Failed to load session details:');
    }
  };

  const handleDirectDownload = async (m: StudyMaterial) => {
    try {
      const res = await api.get(`/materials/${m.id}/download-url`);
      const { downloadUrl, filename } = res.data;
      const fileRes = await api.get(downloadUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(fileRes.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || `${m.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Download forbidden or expired.');
    }
  };

  return (
    <PortalLayout
      portalName="Faculty Workstation"
      sidebarItems={sidebarItems}
      onProfileClick={() => setActiveTab('profile')}
      onSettingsClick={() => setActiveTab('settings')}
    >
      <div className="space-y-6 max-w-7xl">
        {/* Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2.5">
              {React.createElement(pageHeader[activeTab].icon, { className: 'w-6 h-6 text-indigo-400' })}
              <span>{pageHeader[activeTab].title}</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              {pageHeader[activeTab].description}
            </p>
          </div>

          {activeTab === 'materials' && (
            <button
              onClick={() => setIsUploadOpen(true)}
              disabled={!canManageAssignments}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Upload New Material</span>
            </button>
          )}

          {activeTab === 'canvas' && (
            <button
              onClick={() => setIsCreateSessionOpen(true)}
              disabled={!canManageAssignments}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>New Canvas Session</span>
            </button>
          )}
        </div>

        {assignmentsLoading && <div role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">Loading your assigned subjects and sections…</div>}
        {assignmentsError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200"><span>{assignmentsError}</span><button onClick={fetchDashboard} className="rounded-lg bg-red-900 px-3 py-1.5 text-xs font-semibold">Retry</button></div>}
        {!assignmentsLoading && !assignmentsError && assignments.length === 0 && <div role="status" className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">No subject and section assignments are linked to your faculty account yet. Ask an administrator to assign your classes before creating materials, sessions, attendance, or assessments.</div>}

        {/* Tab 1: Faculty Command Dashboard */}
        {activeTab === 'profile' ? <ProfilePage /> : activeTab === 'settings' ? <AppearanceSettingsPage /> : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-indigo-400 mb-4">
                <CalendarCheck className="w-5 h-5" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today's Classes</h2>
              </div>
              {scheduleActionError && <p role="alert" className="text-xs text-red-300 mb-3">{scheduleActionError}</p>}
              {!dashboardData?.todayClasses?.length ? (
                <p className="text-xs text-slate-500 text-center py-5">No classes scheduled for today.</p>
              ) : <div className="space-y-3">
                {dashboardData.todayClasses.map((item) => <div key={item.id} className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${item.status === 'CANCELLED' ? 'border-red-900 bg-red-950/20' : 'border-slate-800 bg-slate-950'}`}>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.subject.code} · {item.subject.name}</p>
                    <p className="text-xs text-slate-400">{item.startTime}–{item.endTime} · {item.section.name} · Room {item.roomNumber || 'TBA'}{item.status === 'CANCELLED' ? ' · Cancelled' : ''}</p>
                    {item.note && <p className="text-xs text-amber-300 mt-1">{item.note}</p>}
                  </div>
                  {item.status !== 'CANCELLED' && <div className="flex gap-2">
                    <button onClick={async () => { setScheduleActionError(null); try { const result = await api.post('/attendance/sessions', { subjectId: item.subject.id, sectionId: item.section.id, sessionDate: new Date(`${item.date}T00:00:00`).toISOString(), periodNumber: item.periodNumber }); setActiveAttendanceSession(result.data.session); setActiveTab('attendance'); } catch { setScheduleActionError('Could not start attendance for this class.'); } }} className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold">Start attendance</button>
                    <button onClick={async () => { setScheduleActionError(null); try { const result = await api.post('/canvas/sessions', { subjectId: item.subject.id, sectionId: item.section.id, title: `${item.subject.code} · ${new Date(`${item.date}T00:00:00`).toLocaleDateString()}`, sessionDate: new Date(`${item.date}T00:00:00`).toISOString() }); setActiveCanvasSession(result.data.session); setActiveTab('canvas'); } catch { setScheduleActionError('Could not start a canvas lesson for this class.'); } }} className="px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold">Start canvas lesson</button>
                  </div>}
                </div>)}
              </div>}
              {!!dashboardData?.calendar?.length && <div className="mt-5 pt-4 border-t border-slate-800">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">This week</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{dashboardData.calendar.slice(0, 9).map((item) => <div key={item.id} className="rounded-lg bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-white">{item.title}</p><p className="text-[10px] text-slate-400">{new Date(`${item.date}T00:00:00`).toLocaleDateString()} · {item.status === 'CANCELLED' ? 'Cancelled class' : item.type.replaceAll('_', ' ')}</p></div>)}</div>
              </div>}
              {!!dashboardData?.weeklyTimetable?.length && <div className="mt-5 pt-4 border-t border-slate-800">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Weekly schedule</h3>
                <div className="flex flex-wrap gap-2">{dashboardData.weeklyTimetable.map((item) => <span key={item.id} className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[11px] text-slate-300">{['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][item.dayOfWeek]} · P{item.periodNumber} · {item.subject.code} · {item.section.name} · {item.startTime}</span>)}</div>
              </div>}
            </section>
            {/* Top Row: Assigned Subjects & Pending Attendance Alert Widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Assigned Subjects Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5 text-indigo-400">
                    <BookMarked className="w-5 h-5" />
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        My Assigned Subjects & Sections
                      </h2>
                      <p className="text-xs text-slate-400">
                        Course assignments managed via RBAC resource-level guards.
                      </p>
                    </div>
                  </div>
                </div>

                {!dashboardData?.assignedSubjects || dashboardData.assignedSubjects.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No teaching assignments assigned for current term.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {dashboardData.assignedSubjects.map((sub) => (
                      <div
                        key={sub.assignmentId}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-950/70 border border-indigo-800/80 px-2 py-0.5 rounded-md">
                            {sub.subjectCode}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {sub.credits} Credits
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-sm text-white">{sub.subjectName}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {sub.sectionName} • {sub.semesterName}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{sub.studentCount} Students Enrolled</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Attendance Action Widget */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-amber-400 mb-2">
                    <CalendarCheck className="w-5 h-5" />
                    <h3 className="text-xs uppercase tracking-wider font-bold">Pending Attendance</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Class sessions waiting for roll-call attendance submission.
                  </p>

                  {!dashboardData?.pendingAttendance || dashboardData.pendingAttendance.length === 0 ? (
                    <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-emerald-300">All sessions up to date</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Zero pending attendance records</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dashboardData.pendingAttendance.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {item.subjectCode} - Period {item.period}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {item.sectionName} • {new Date(item.date).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveAttendanceSession(item as any);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-semibold transition cursor-pointer"
                          >
                            Mark Now
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('attendance')}
                  className="mt-4 w-full py-2 bg-slate-950 hover:bg-slate-800 text-indigo-400 border border-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                >
                  View Attendance History & Export →
                </button>
              </div>
            </div>

            {/* Middle Row: Class Performance Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5 text-indigo-400">
                  <BarChart3 className="w-5 h-5" />
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Class Academic Performance Summary
                    </h2>
                    <p className="text-xs text-slate-400">
                      Average score, highest mark, and pass percentage across configured assessments.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('marks')}
                  className="text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  Open Gradebook & Grid Entry →
                </button>
              </div>

              {!dashboardData?.performanceSummary || dashboardData.performanceSummary.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No graded assessments recorded yet. Click Gradebook & Marks to configure an assessment.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {dashboardData.performanceSummary.map((perf) => (
                    <div
                      key={perf.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                          {perf.subjectCode}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            perf.state === 'PUBLISHED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {perf.state}
                        </span>
                      </div>

                      <h3 className="font-bold text-xs text-white">{perf.name}</h3>

                      <div className="flex items-baseline justify-between pt-1 text-xs">
                        <span className="text-slate-400">Class Average:</span>
                        <span className="font-mono font-bold text-white">
                          {perf.average} / {perf.maxMarks}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Pass Rate:</span>
                          <span
                            className={`font-mono font-bold ${
                              perf.passRate >= 75 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {perf.passRate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${perf.passRate}%` }}
                            className={`h-full ${
                              perf.passRate >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: Recent Doubts & Campus Announcements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recent Student Doubts Needing Resolution */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-indigo-400">
                    <HelpCircle className="w-5 h-5" />
                    <h3 className="text-xs uppercase tracking-wider font-bold text-white">
                      Student Doubts Awaiting Response
                    </h3>
                  </div>
                </div>

                {!dashboardData?.recentDoubts || dashboardData.recentDoubts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Zero pending doubts from enrolled students. You are all caught up!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.recentDoubts.map((doubt) => (
                      <div
                        key={doubt.id}
                        className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-indigo-400 font-mono uppercase">
                            {doubt.subject?.code} Question
                          </span>
                          <span className="text-[10px] text-slate-400">
                            By {doubt.student?.firstName} {doubt.student?.lastName}
                          </span>
                        </div>
                        <h4 className="font-bold text-white">{doubt.title}</h4>
                        <p className="text-slate-300 text-[11px] line-clamp-2">{doubt.content}</p>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => setActiveReplyDoubt(doubt)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                          >
                            <span>Reply & Resolve</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Announcements Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-cyan-400">
                    <Megaphone className="w-5 h-5" />
                    <h3 className="text-xs uppercase tracking-wider font-bold text-white">
                      Campus Broadcasts & Circulars
                    </h3>
                  </div>

                  <button
                    onClick={() => setIsPostAnnouncementOpen(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    + Post Announcement
                  </button>
                </div>

                {!dashboardData?.announcements || dashboardData.announcements.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No announcements posted yet. Click "+ Post Announcement" to broadcast to classes.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dashboardData.announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 font-bold text-white">
                            {ann.isPinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                            <span>{ann.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'marks' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Configured Assessments & Gradebooks
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage internals, assignments, and practicals. Enter scores in grid or bulk upload.
                </p>
              </div>

              <button
                onClick={() => setIsCreateAssessmentOpen(true)}
                disabled={!canManageAssignments}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-md shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Assessment</span>
              </button>
            </div>

            {assessments.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No Assessments Configured</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Configure internal tests, assignments, or lab practicals for your assigned subject cohorts.
                </p>
                <button
                  onClick={() => setIsCreateAssessmentOpen(true)}
                  disabled={!canManageAssignments}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Configure First Assessment
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {assessments.map((ass) => (
                  <div
                    key={ass.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded-md">
                          {ass.subject?.code} • {ass.section?.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            ass.state === 'PUBLISHED'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : 'bg-amber-950/80 text-amber-400 border-amber-800'
                          }`}
                        >
                          {ass.state}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-1 line-clamp-1">
                        {ass.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Max Marks: <strong className="font-mono text-white">{ass.maxMarks}</strong> • Weightage: {ass.weightage}x
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={async () => {
                          const res = await api.get(`/marks/assessments/${ass.id}`);
                          setActiveAssessment(res.data.assessment);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Open Marks Grid</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'attendance' ? (
          <div className="space-y-6">
            {/* Pending Attendance Dashboard Widget */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2.5">
                  <CalendarCheck className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-white text-sm">
                    Pending Attendance Sessions (Dashboard Alert)
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {pendingAttendance.length} session(s) awaiting completion
                </span>
              </div>

              {pendingAttendance.length === 0 ? (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center text-xs text-slate-400">
                  All scheduled attendance sessions are up to date.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingAttendance.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 bg-slate-950 rounded-xl border border-amber-900/40 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {sess.subject?.code} - Period {sess.periodNumber}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(sess.sessionDate).toLocaleDateString()} • {sess.section?.name}
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveAttendanceSession(sess)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                      >
                        Mark Roster
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Session Launch Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-white text-sm">Take Attendance for Today</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Initialize a new period session and record student presence with one-click toggles.
                </p>
              </div>
              <FacultyAssignmentSelectors
                assignments={assignments}
                subjectId={attendanceSubjectId}
                sectionId={attendanceSectionId}
                disabled={!canManageAssignments}
                onSubjectChange={(id) => { setAttendanceSubjectId(id); setAttendanceSectionId(assignments.find((assignment) => assignment.subjectId === id)?.sectionId || ''); }}
                onSectionChange={setAttendanceSectionId}
              />
              <button
                disabled={!canManageAssignments || !attendanceSubjectId || !attendanceSectionId}
                onClick={async () => {
                  try {
                    const res = await api.post('/attendance/sessions', {
                      subjectId: attendanceSubjectId,
                      sectionId: attendanceSectionId,
                      sessionDate: new Date().toISOString(),
                      periodNumber: 1,
                    });
                    setActiveAttendanceSession(res.data.session);
                  } catch (err) {
                    console.error('Failed to create attendance session:');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                + New Period Attendance
              </button>
            </div>
          </div>
        ) : activeTab === 'canvas' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Classroom Whiteboard Lessons
              </h2>
              <button
                onClick={() => setIsCreateSessionOpen(true)}
                disabled={!canManageAssignments}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-md shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Classroom Session</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Presentation className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No Classroom Sessions Archived</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Launch a new live canvas board with pressure stylus support and PDF slide importing.
                </p>
                <button
                  onClick={() => setIsCreateSessionOpen(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  + Launch Whiteboard Session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded-md">
                          {sess.subject?.code} • {sess.section?.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(sess.sessionDate).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-1 line-clamp-1">
                        {sess.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {sess._count?.pages || 1} board page(s) • Autosaved
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => openCanvasSession(sess.id)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <Presentation className="w-3.5 h-3.5" />
                        <span>Open Canvas Workspace</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'community' ? (
          <CommunityFeed
            userRole={user?.role || 'FACULTY'}
            currentUserId={user?.id}
          />
        ) : activeTab === 'doubts' ? (
          <DoubtsPortal
            userRole={user?.role || 'FACULTY'}
          />
        ) : (
          /* Materials Tab Content */
          <>
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or topic keywords..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Assigned Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Materials Table / Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading course materials...</span>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No Study Materials Published</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by uploading PPTs, PDFs, lab manuals, or question papers for your assigned classes.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              disabled={!canManageAssignments}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Create First Material
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {materials.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-wider">
                      {m.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                      v{m.currentVersion}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-white line-clamp-1">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {m.description || 'No additional notes provided.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">{m.subject?.code}</span>
                    {m.unit && <span className="truncate">Unit {m.unit.unitNumber}</span>}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                  {/* Views & Downloads Tracker (Faculty View Requirement) */}
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="flex items-center space-x-1" title="Total Views">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>{m.viewsCount || 0}</span>
                    </span>
                    <span className="flex items-center space-x-1" title="Total Downloads">
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>{m.downloadsCount || 0}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Inline PDF Viewer trigger */}
                    <button
                      onClick={() => setViewingMaterial({ id: m.id, title: m.title })}
                      title="Preview Document (PDF.js)"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Download file */}
                    <button
                      onClick={() => handleDirectDownload(m)}
                      title="Download file"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Replace Version trigger */}
                    <button
                      onClick={() => setReplacingMaterial(m)}
                      title="Replace file (Creates new version)"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Upload Modal */}
      <MaterialUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={fetchMaterials}
        assignments={assignments}
      />

      {/* Replace Version Modal */}
      {replacingMaterial && (
        <ReplaceVersionModal
          isOpen={Boolean(replacingMaterial)}
          materialId={replacingMaterial.id}
          materialTitle={replacingMaterial.title}
          currentVersion={replacingMaterial.currentVersion}
          onClose={() => setReplacingMaterial(null)}
          onSuccess={fetchMaterials}
        />
      )}

      {/* PDF.js Inline Viewer */}
      {viewingMaterial && (
        <PdfViewer
          materialId={viewingMaterial.id}
          title={viewingMaterial.title}
          onClose={() => setViewingMaterial(null)}
        />
      )}

      {/* Create Classroom Session Modal */}
      <CreateSessionModal
        isOpen={isCreateSessionOpen}
        onClose={() => setIsCreateSessionOpen(false)}
        onSuccess={(created) => {
          fetchSessions();
          openCanvasSession(created.id);
        }}
        assignments={assignments}
      />

      {/* Konva.js Faculty Digital Classroom Workspace */}
      {activeCanvasSession && (
        <CanvasWorkspace
          sessionId={activeCanvasSession.id}
          sessionTitle={activeCanvasSession.title}
          initialPages={activeCanvasSession.pages || []}
          allowDownload={activeCanvasSession.allowDownload}
          onClose={() => {
            setActiveCanvasSession(null);
            fetchSessions();
          }}
        />
      )}

      {/* Attendance Marking Modal */}
      {activeAttendanceSession && (
        <AttendanceMarkingModal
          session={activeAttendanceSession}
          isOpen={Boolean(activeAttendanceSession)}
          onClose={() => setActiveAttendanceSession(null)}
          onSuccess={() => {
            fetchPendingAttendance();
          }}
        />
      )}

      {/* Create Assessment Modal */}
      <CreateAssessmentModal
        isOpen={isCreateAssessmentOpen}
        onClose={() => setIsCreateAssessmentOpen(false)}
        onSuccess={fetchAssessments}
        assignments={assignments}
      />

      {/* Marks Entry Grid Modal */}
      {activeAssessment && (
        <MarksEntryGridModal
          assessment={activeAssessment}
          isOpen={Boolean(activeAssessment)}
          onClose={() => setActiveAssessment(null)}
          onSuccess={fetchAssessments}
        />
      )}

      {/* Reply Doubt Modal */}
      {activeReplyDoubt && (
        <ReplyDoubtModal
          doubt={activeReplyDoubt}
          isOpen={Boolean(activeReplyDoubt)}
          onClose={() => setActiveReplyDoubt(null)}
          onSuccess={() => {
            fetchDashboard();
          }}
        />
      )}

      {/* Broadcast Announcement Modal */}
      <PostAnnouncementModal
        isOpen={isPostAnnouncementOpen}
        onClose={() => setIsPostAnnouncementOpen(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
      />
    </PortalLayout>
  );
};
