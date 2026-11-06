import React, { useState, useEffect } from 'react';
import { PortalLayout } from '../components/PortalLayout';
import {
  Calendar,
  CalendarCheck,
  Award,
  FileText,
  Sparkles,
  Search,
  Bookmark,
  BookmarkCheck,
  Eye,
  Download,
  Lock,
  ExternalLink,
  LayoutDashboard,
  Clock,
  HelpCircle,
  Megaphone,
  Pin,
  MessageSquare,
  UserRound,
  Settings2,
} from 'lucide-react';

import api from '../api/client';
import type { StudyMaterial } from '../types/material';
import { PdfViewer } from '../components/PdfViewer';
import { StudentCanvasViewer } from '../components/StudentCanvasViewer';
import { WhatIfCalculator } from '../components/WhatIfCalculator';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal';
import { MarkCorrectionModal } from '../components/MarkCorrectionModal';
import { AskDoubtModal } from '../components/AskDoubtModal';
import { CommunityFeed } from '../components/CommunityFeed';
import { DoubtsPortal } from '../components/DoubtsPortal';
import type { ClassroomSession } from '../types/canvas';
import type { StudentAttendanceAggregate, AttendanceStatus } from '../types/attendance';
import type { StudentMarksReport } from '../types/marks';
import type { StudentDashboardData } from '../types/dashboard';
import { useAuth } from '../context/AuthContext';
import { AppearanceSettingsPage, ProfilePage } from '../components/ProfileSettings';

export const StudentPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'materials' | 'canvas' | 'attendance' | 'marks' | 'community' | 'doubts' | 'profile' | 'settings'
  >('dashboard');
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [isAskDoubtOpen, setIsAskDoubtOpen] = useState(false);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceAggregate | null>(null);
  const [marksReport, setMarksReport] = useState<StudentMarksReport | null>(null);
  const [selectedCorrectionRecord, setSelectedCorrectionRecord] = useState<{
    id: string;
    date: string;
    period: number;
    subjectName: string;
    currentStatus: AttendanceStatus;
  } | null>(null);
  const [selectedMarkCorrection, setSelectedMarkCorrection] = useState<{
    markId: string;
    assessmentName: string;
    currentScore: number | null;
    maxMarks: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<StudyMaterial[]>([]);

  const pageHeader: Record<typeof activeTab, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
    dashboard: { title: "Today's Academic Dashboard", description: 'Your timetable, academic progress, and campus updates in one view.', icon: LayoutDashboard },
    materials: { title: 'Course Study Materials', description: 'Browse lecture slides, previous year question papers, and lab guides with in-browser preview.', icon: FileText },
    canvas: { title: 'Whiteboard Lessons', description: 'Review classroom lessons and handwritten notes shared by your faculty.', icon: Sparkles },
    attendance: { title: 'Attendance & Shortage Tracker', description: 'Review session records, subject percentages, and your attendance outlook.', icon: Calendar },
    marks: { title: 'Academic Performance & Grades', description: 'Review your published assessment scores and semester grade summary.', icon: Award },
    community: { title: 'Campus Community', description: 'Read and join conversations shared with your campus community.', icon: MessageSquare },
    doubts: { title: 'Academic Doubts', description: 'Ask subject questions, follow replies, and learn with your classmates.', icon: HelpCircle },
    profile: { title: 'My Profile', description: 'View and update your profile details.', icon: UserRound },
    settings: { title: 'Appearance Settings', description: 'Choose your preferred appearance for EduSphere.', icon: Settings2 },
  };

  // Modals state
  const [viewingMaterial, setViewingMaterial] = useState<{ id: string; title: string } | null>(
    null
  );
  const [viewingCanvasSession, setViewingCanvasSession] = useState<any | null>(null);

  const sidebarItems = [
    {
      icon: LayoutDashboard,
      label: 'My Dashboard',
      active: activeTab === 'dashboard',
      onClick: () => setActiveTab('dashboard'),
    },
    {
      icon: FileText,
      label: 'Learning Materials',
      active: activeTab === 'materials',
      onClick: () => setActiveTab('materials'),
    },
    {
      icon: Sparkles,
      label: 'Canvas Lessons',
      badge: 'Board',
      active: activeTab === 'canvas',
      onClick: () => setActiveTab('canvas'),
    },
    {
      icon: Calendar,
      label: 'Attendance Tracker',
      badge: 'Aggregated',
      active: activeTab === 'attendance',
      onClick: () => setActiveTab('attendance'),
    },
    {
      icon: Award,
      label: 'Academic Performance',
      badge: 'SGPA',
      active: activeTab === 'marks',
      onClick: () => setActiveTab('marks'),
    },
    {
      icon: MessageSquare,
      label: 'Campus Community',
      badge: 'Feed',
      active: activeTab === 'community',
      onClick: () => setActiveTab('community'),
    },
    {
      icon: HelpCircle,
      label: 'Academic Doubts',
      badge: 'Q&A',
      active: activeTab === 'doubts',
      onClick: () => setActiveTab('doubts'),
    },
  ];

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard/student');
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:');
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (selectedType) params.type = selectedType;
      if (bookmarkedOnly) params.bookmarkedOnly = true;

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

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance/student-aggregate');
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to fetch student attendance:');
    }
  };

  const fetchMarksReport = async () => {
    try {
      const res = await api.get('/marks/student-report');
      setMarksReport(res.data);
    } catch (err) {
      console.error('Failed to fetch marks report:');
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchMaterials();
    fetchSessions();
    fetchAttendance();
    fetchMarksReport();
  }, [search, selectedType, bookmarkedOnly]);

  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const refreshSessions = () => {
      api.get('/canvas/sessions')
        .then((res) => setSessions(res.data.sessions || []))
        .catch(() => undefined);
    };
    refreshSessions();
    const intervalId = window.setInterval(refreshSessions, 30_000);
    window.addEventListener('focus', refreshSessions);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSessions);
    };
  }, [activeTab]);

  const openStudentCanvas = async (sessionId: string) => {
    try {
      const res = await api.get(`/canvas/sessions/${sessionId}`);
      setViewingCanvasSession(res.data.session);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Access denied or session unavailable');
    }
  };

  const toggleBookmark = async (id: string) => {
    try {
      await api.post(`/materials/${id}/bookmark`);
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isBookmarked: !m.isBookmarked } : m))
      );
    } catch (err) {
      console.error('Bookmark toggle failed:');
    }
  };

  const handleOpenViewer = (material: StudyMaterial) => {
    // Add to local recently viewed list
    setRecentlyViewed((prev) => [
      material,
      ...prev.filter((item) => item.id !== material.id),
    ].slice(0, 4));

    setViewingMaterial({ id: material.id, title: material.title });
  };

  const handleDirectDownload = async (m: StudyMaterial) => {
    if (!m.allowDownload) {
      alert('Downloading has been disabled by your instructor for this material.');
      return;
    }

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
      portalName="Student Learning Hub"
      sidebarItems={sidebarItems}
      onProfileClick={() => setActiveTab('profile')}
      onSettingsClick={() => setActiveTab('settings')}
      activeTitle={pageHeader[activeTab].title}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Context Header Banner */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              {React.createElement(pageHeader[activeTab].icon, { className: 'w-5 h-5' })}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {pageHeader[activeTab].title}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {pageHeader[activeTab].description}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {activeTab === 'materials' && (
              <button
                type="button"
                onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  bookmarkedOnly
                    ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                <span>{bookmarkedOnly ? 'Bookmarked Only' : 'All Materials'}</span>
              </button>
            )}

            {activeTab === 'attendance' && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                attendance?.hasShortage
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <span className={`size-1.5 rounded-full ${attendance?.hasShortage ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                {attendance?.hasShortage ? 'Shortage Alert (< 75%)' : 'Attendance Good Standing'}
              </span>
            )}

            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => setIsAskDoubtOpen(true)}
                className="saas-btn-primary"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Ask a Doubt</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Routing */}
        {activeTab === 'profile' ? (
          <ProfilePage />
        ) : activeTab === 'settings' ? (
          <AppearanceSettingsPage />
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            {/* Top 4 Key Metric Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Overall Attendance */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Overall Attendance
                  </span>
                  <div className="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold font-mono tracking-tight ${
                      dashboardData?.attendance?.hasShortage ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {dashboardData?.attendance?.overallPercentage ?? 100}%
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    (Min: {dashboardData?.attendance?.threshold ?? 75}%)
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {dashboardData?.attendance?.presentCount || 0} of {dashboardData?.attendance?.totalConducted || 0} classes
                  </span>
                  <span
                    className={`font-semibold ${
                      dashboardData?.attendance?.hasShortage ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {dashboardData?.attendance?.hasShortage ? 'Shortage' : 'Eligible'}
                  </span>
                </div>
              </div>

              {/* Stat 2: Academic SGPA */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Academic SGPA
                  </span>
                  <div className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                    {marksReport?.sgpa ?? '10.00'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">/ 10.0 scale</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {marksReport?.totalCredits || 18} Registered Credits
                  </span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    Grade A+
                  </span>
                </div>
              </div>

              {/* Stat 3: Study Materials */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Course Materials
                  </span>
                  <div className="grid size-7 place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                    {materials.length}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Available</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">PDFs, Notes & Slides</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('materials')}
                    className="font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    Browse →
                  </button>
                </div>
              </div>

              {/* Stat 4: Today's Schedule count */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Today's Classes
                  </span>
                  <div className="grid size-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                    {dashboardData?.timetable?.length || 0}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Sessions</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="font-semibold text-slate-700">Scheduled</span>
                </div>
              </div>
            </div>

            {/* Today's Timetable Section */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Clock className="w-4 h-4" />
                  <h2 className="text-sm font-bold text-slate-900">Today's Class Timetable</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>

              {!dashboardData?.timetable || dashboardData.timetable.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  No classes scheduled for today. Take this time to review lecture notes and assignments!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {dashboardData.timetable.map((slot) => (
                    <div
                      key={slot.id}
                      className={`border rounded-lg p-4 flex flex-col justify-between space-y-3 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition shadow-2xs ${
                        'status' in slot && slot.status === 'CANCELLED'
                          ? 'border-rose-200 opacity-70 bg-rose-50/30'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-semibold">
                          Period {slot.periodNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{slot.subject.code}</h3>
                        <p className="text-xs text-slate-600 truncate mt-0.5">{slot.subject.name}</p>
                        {'status' in slot && slot.status === 'CANCELLED' && (
                          <p className="text-xs text-rose-600 font-medium mt-1">
                            Cancelled{slot.note ? ` · ${slot.note}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Room: <strong className="text-slate-700">{slot.roomNumber || 'Main Lab'}</strong></span>
                        <span className="text-slate-700 font-medium">
                          {slot.faculty.firstName} {slot.faculty.lastName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Timetable & Academic Calendar */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2 text-indigo-700">
                  <CalendarCheck className="w-4 h-4" />
                  <h2 className="text-sm font-bold text-slate-900">Weekly Timetable & Academic Calendar</h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Current Semester</span>
              </div>

              {!dashboardData?.calendar?.length ? (
                <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  No classes or calendar events scheduled for this week.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dashboardData.calendar.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-md transition">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          {item.endDate && item.endDate !== item.date ? ` – ${new Date(`${item.endDate}T00:00:00`).toLocaleDateString()}` : ''}
                          {item.type === 'CLASS' && 'periodNumber' in item ? ` · Period ${item.periodNumber}` : ''}
                          {item.type === 'CLASS' && 'startTime' in item ? ` · ${item.startTime}–${item.endTime}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        item.type === 'CLASS'
                          ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                        {item.status === 'CANCELLED' ? 'CANCELLED' : item.type.replaceAll('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance Overview & Latest Published Marks Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Attendance Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      Attendance Overview
                    </span>
                    {dashboardData?.attendance?.hasShortage ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                        Shortage Warning
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        In Good Standing
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span
                      className={`text-3xl font-extrabold font-mono tracking-tight ${
                        dashboardData?.attendance?.hasShortage ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {dashboardData?.attendance?.overallPercentage ?? 100}%
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      (Institutional Min: {dashboardData?.attendance?.threshold ?? 75}%)
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                    <div
                      style={{ width: `${Math.min(100, dashboardData?.attendance?.overallPercentage || 100)}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        dashboardData?.attendance?.hasShortage ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                    />
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5">
                    {dashboardData?.attendance?.presentCount || 0} present • {dashboardData?.attendance?.lateCount || 0} late out of {dashboardData?.attendance?.totalConducted || 0} classes conducted.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer text-center"
                >
                  View Attendance Breakdown & What-If Simulator →
                </button>
              </div>

              {/* Latest Published Marks */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      Latest Published Scores
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono">
                      Official Only
                    </span>
                  </div>

                  {(!dashboardData?.latestMarks || dashboardData.latestMarks.length === 0) ? (
                    <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                      No published scores available yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dashboardData.latestMarks.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{m.assessmentName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{m.subjectCode}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {m.isAbsent ? 'Absent' : `${m.score}/${m.maxMarks}`}
                            </span>
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                              {m.gradeLetter || '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('marks')}
                  className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer text-center"
                >
                  View Full Academic Report & SGPA →
                </button>
              </div>
            </div>

            {/* Recent Materials & Campus Announcements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent Materials */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Recently Uploaded Materials
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('materials')}
                    className="text-xs text-indigo-700 hover:underline cursor-pointer font-medium"
                  >
                    View All
                  </button>
                </div>

                {(!dashboardData?.recentMaterials || dashboardData.recentMaterials.length === 0) ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    No study materials posted yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dashboardData.recentMaterials.map((mat) => (
                      <div
                        key={mat.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">{mat.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {mat.subjectName} • {mat.type.replace('_', ' ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenViewer(mat as any)}
                          className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campus Announcements */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-indigo-700 mb-3">
                  <Megaphone className="w-4 h-4" />
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Campus Circulars & Announcements
                  </h3>
                </div>

                {(!dashboardData?.announcements || dashboardData.announcements.length === 0) ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    No campus circulars at this time.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {dashboardData.announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            {ann.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{ann.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          By: {ann.author.firstName} {ann.author.lastName} ({ann.author.role})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unanswered Academic Doubts */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700">
                  <HelpCircle className="w-4 h-4" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">My Academic Doubts & Q&A</h2>
                    <p className="text-xs text-slate-500">
                      Track instructor responses to your questions or post a new doubt.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAskDoubtOpen(true)}
                  className="saas-btn-primary"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>+ Ask a Doubt</span>
                </button>
              </div>

              {(!dashboardData?.unansweredDoubts || dashboardData.unansweredDoubts.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  You have no pending unanswered doubts. Click "+ Ask a Doubt" if you need instructor help!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dashboardData.unansweredDoubts.map((doubt) => (
                    <div
                      key={doubt.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                          {doubt.subject?.code} - {doubt.subject?.name}
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono">
                          Awaiting Instructor Reply
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900">{doubt.title}</h4>
                      <p className="text-slate-600 text-[11px] whitespace-pre-wrap">{doubt.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'marks' ? (
          <div className="space-y-6">
            {/* SGPA & Cumulative Performance Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Semester GPA (SGPA)
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold font-mono tracking-tight text-indigo-700">
                    {marksReport?.sgpa ?? '0.00'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ 10.0 scale</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">
                  Calculated across {marksReport?.totalCredits || 0} enrolled credits
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Published Gradebook Overview (Rule 5 Guarded)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Only finalized and officially published assessments are reflected here. Any subsequent score corrections by faculty write an immutable log to <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono text-[11px]">audit_logs</code>.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  <span>Subjects Evaluated: <strong className="text-slate-900">{marksReport?.subjectsSummary.length || 0}</strong></span>
                  <span>Institutional Scale: <strong className="text-emerald-700">10-Point CGPA</strong></span>
                </div>
              </div>
            </div>

            {/* Subject-Wise Assessment Tables */}
            <div className="space-y-4">
              {(marksReport?.subjectsSummary || []).length === 0 ? (
                <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center shadow-xs">
                  <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-slate-900">No Published Marks Available</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Your instructors are currently grading in draft mode. Published scores will appear here automatically.
                  </p>
                </div>
              ) : (
                marksReport?.subjectsSummary.map((sub) => (
                  <div
                    key={sub.subject.id}
                    className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">
                          {sub.subject.code} - {sub.subject.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Credits: {sub.subject.credits} • Aggregated Score: {sub.totalEarned} / {sub.totalPossible} ({sub.subjectPercentage}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-mono">Grade:</span>
                        <span className="text-xl font-extrabold font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                          {sub.finalGrade}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-mono uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Assessment</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Score</th>
                            <th className="py-2.5 px-3">Grade</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sub.assessments.map((a) => (
                            <tr key={a.markId} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3 font-medium text-slate-900">{a.name}</td>
                              <td className="py-2.5 px-3">
                                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono">
                                  {a.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {a.isAbsent ? (
                                  <span className="text-rose-600">Absent</span>
                                ) : (
                                  `${a.score} / ${a.maxMarks}`
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                                {a.gradeLetter || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedMarkCorrection({
                                      markId: a.markId,
                                      assessmentName: a.name,
                                      currentScore: a.score,
                                      maxMarks: a.maxMarks,
                                    })
                                  }
                                  className="text-[11px] text-indigo-700 hover:text-indigo-900 font-medium underline cursor-pointer"
                                >
                                  Discrepancy / Review
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'attendance' ? (
          <div className="space-y-6">
            {/* Overall Summary Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Attendance Overview
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span
                    className={`text-3xl font-extrabold font-mono tracking-tight ${
                      attendance?.hasShortage ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {attendance?.overallPercentage ?? 100}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    (Min: {attendance?.threshold ?? 75}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {attendance?.totalAttended} classes marked present or late out of {attendance?.totalConducted} · late marks count as half credit
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Institutional Shortage Status
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {attendance?.hasShortage
                      ? '⚠️ Warning: Your overall attendance is currently below the required institutional minimum threshold.'
                      : '✅ In Good Standing: Your attendance exceeds the minimum mandatory threshold.'}
                  </p>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    style={{ width: `${Math.min(100, attendance?.overallPercentage || 100)}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      attendance?.hasShortage ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Subject-Wise Attendance & What-If Simulators */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Subject-Wise Breakdown & Correction Request
              </h2>

              {(attendance?.subjectMetrics || []).map((subMetric) => (
                <div
                  key={subMetric.subject.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        {subMetric.subject.code} - {subMetric.subject.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {subMetric.attended} attended • {subMetric.late} late • {subMetric.missed} missed
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-lg font-bold font-mono ${
                          subMetric.isShortage ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {subMetric.percentage}%
                      </span>
                      {subMetric.isShortage && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono font-semibold">
                          Shortage
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Embedded What-If Calculator Component */}
                  <WhatIfCalculator
                    subjectName={subMetric.subject.name}
                    currentAttendanceCredits={subMetric.attendanceCredits}
                    currentConducted={subMetric.totalConducted}
                    defaultThreshold={subMetric.threshold}
                  />

                  {/* Session Logs & Correction Request Flow */}
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Recent Class Sessions ({subMetric.records.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {subMetric.records.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                        >
                          <span className="text-slate-700">
                            {new Date(r.date).toLocaleDateString()} (Period {r.period})
                          </span>

                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                r.status === 'PRESENT'
                                  ? 'text-emerald-700'
                                  : r.status === 'LATE'
                                  ? 'text-amber-700'
                                  : 'text-rose-600'
                              }`}
                            >
                              {r.status}
                            </span>

                            {r.status !== 'PRESENT' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCorrectionRecord({
                                    id: r.recordId,
                                    date: r.date,
                                    period: r.period,
                                    subjectName: subMetric.subject.name,
                                    currentStatus: r.status,
                                  })
                                }
                                className="text-[11px] text-indigo-700 hover:text-indigo-900 font-medium underline cursor-pointer"
                              >
                                Request Correction
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'canvas' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Faculty Classroom Boards & Annotated Slides
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {sessions.length} Archived Session{sessions.length === 1 ? '' : 's'}
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center shadow-xs">
                <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">No Archived Lessons Available</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When instructors conduct whiteboard lessons for your section, they will be archived here for revision.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 transition rounded-xl p-5 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {sess.subject?.code} • {sess.section?.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(sess.sessionDate).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">
                        {sess.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Taught by {sess.faculty?.firstName} {sess.faculty?.lastName} • {sess._count?.pages || 1} slide(s)
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openStudentCanvas(sess.id)}
                        className="saas-btn-primary"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Board Lesson</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'community' ? (
          <CommunityFeed userRole="STUDENT" currentUserId={user?.id} />
        ) : activeTab === 'doubts' ? (
          <DoubtsPortal userRole="STUDENT" />
        ) : (
          /* Materials View Content */
          <div className="space-y-6">
            {/* Recently Viewed Carousel */}
            {recentlyViewed.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
                  Recently Viewed
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recentlyViewed.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenViewer(item)}
                      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-lg p-3 w-56 shrink-0 cursor-pointer transition shadow-xs"
                    >
                      <p className="text-xs font-semibold text-slate-900 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.subject?.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search, Filter & Bookmark Bar */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by topic, unit, or keywords..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none transition cursor-pointer"
                >
                  <option value="">All Document Types</option>
                  <option value="PDF">PDFs</option>
                  <option value="PPT">Presentations (PPT/PPTX)</option>
                  <option value="DOCX">Word Docs (DOCX)</option>
                  <option value="QUESTION_PAPER">Question Papers</option>
                  <option value="LAB_MANUAL">Lab Manuals</option>
                  <option value="SYLLABUS">Syllabus</option>
                  <option value="VIDEO_LINK">Videos</option>
                </select>

                <button
                  type="button"
                  onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer shrink-0 ${
                    bookmarkedOnly
                      ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                  <span>Bookmarks</span>
                </button>
              </div>
            </div>

            {/* Materials Grid */}
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-xs">Loading course notes...</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center shadow-xs">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">No Learning Materials Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Your instructors haven't published materials matching your criteria yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 transition rounded-xl p-5 flex flex-col justify-between shadow-xs hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                          {m.type.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleBookmark(m.id)}
                          className="p-1 text-slate-400 hover:text-amber-500 transition cursor-pointer"
                          title={m.isBookmarked ? 'Remove bookmark' : 'Bookmark material'}
                        >
                          {m.isBookmarked ? (
                            <BookmarkCheck className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <h3 className="font-semibold text-sm text-slate-900 line-clamp-1">{m.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {m.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{m.subject?.name}</span>
                        {m.unit && <span className="truncate font-mono font-medium">Unit {m.unit.unitNumber}</span>}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 truncate">
                        By {m.createdBy?.firstName} {m.createdBy?.lastName}
                      </span>

                      <div className="flex items-center gap-2">
                        {m.externalUrl ? (
                          <a
                            href={m.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="saas-btn-secondary py-1 text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Watch</span>
                          </a>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenViewer(m)}
                              className="saas-btn-primary py-1 px-2.5 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>

                            {m.allowDownload ? (
                              <button
                                type="button"
                                onClick={() => handleDirectDownload(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span
                                title="Downloads disabled by instructor"
                                className="p-1.5 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF.js Read-Only Viewer Modal */}
      {viewingMaterial && (
        <PdfViewer
          materialId={viewingMaterial.id}
          title={viewingMaterial.title}
          onClose={() => setViewingMaterial(null)}
        />
      )}

      {/* Student Read-Only Canvas Viewer */}
      {viewingCanvasSession && (
        <StudentCanvasViewer
          sessionTitle={viewingCanvasSession.title}
          allowDownload={viewingCanvasSession.allowDownload}
          pages={viewingCanvasSession.pages || []}
          onClose={() => setViewingCanvasSession(null)}
        />
      )}

      {/* Attendance Correction Modal */}
      {selectedCorrectionRecord && (
        <AttendanceCorrectionModal
          recordId={selectedCorrectionRecord.id}
          sessionDate={selectedCorrectionRecord.date}
          period={selectedCorrectionRecord.period}
          subjectName={selectedCorrectionRecord.subjectName}
          currentStatus={selectedCorrectionRecord.currentStatus}
          isOpen={Boolean(selectedCorrectionRecord)}
          onClose={() => setSelectedCorrectionRecord(null)}
          onSuccess={() => {
            fetchAttendance();
          }}
        />
      )}

      {/* Marks Correction / Discrepancy Modal */}
      {selectedMarkCorrection && (
        <MarkCorrectionModal
          markId={selectedMarkCorrection.markId}
          assessmentName={selectedMarkCorrection.assessmentName}
          currentScore={selectedMarkCorrection.currentScore}
          maxMarks={selectedMarkCorrection.maxMarks}
          isOpen={Boolean(selectedMarkCorrection)}
          onClose={() => setSelectedMarkCorrection(null)}
          onSuccess={() => {
            fetchMarksReport();
          }}
        />
      )}

      {/* Ask Doubt Modal */}
      <AskDoubtModal
        isOpen={isAskDoubtOpen}
        onClose={() => setIsAskDoubtOpen(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
      />
    </PortalLayout>
  );
};
