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

  const pageHeader: Record<typeof activeTab, { title: string; description: string }> = {
    dashboard: { title: "Today's Dashboard", description: 'Your timetable, academic progress, and campus updates in one view.' },
    materials: { title: 'Course Study Materials', description: 'Browse lecture slides, previous year question papers, and lab guides. Preview documents online with PDF.js.' },
    canvas: { title: 'Whiteboard Lessons', description: 'Review classroom lessons shared by your faculty.' },
    attendance: { title: 'Attendance & Shortage Tracker', description: 'Review session records, subject percentages, and your attendance outlook.' },
    marks: { title: 'Academic Performance & Grades', description: 'Review your published assessment scores and semester grade summary.' },
    community: { title: 'Campus Community', description: 'Read and join conversations shared with your campus community.' },
    doubts: { title: 'Academic Doubts', description: 'Ask subject questions, follow replies, and learn with your classmates.' },
    profile: { title: 'My Profile', description: 'View and update your profile details.' },
    settings: { title: 'Appearance Settings', description: 'Choose your preferred appearance for EduSphere.' },
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
      link.download = filename;
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
    >
      <div className="space-y-6 max-w-7xl">
        {/* Context header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            <span>{pageHeader[activeTab].title}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">{pageHeader[activeTab].description}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'dashboard'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Today's Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 shrink-0 ${
              activeTab === 'materials'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Course Study Materials
          </button>
          <button
            onClick={() => setActiveTab('canvas')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'canvas'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Whiteboard Lessons</span>
            <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800 px-1.5 py-0.5 rounded-full font-mono">
              {sessions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'attendance'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Attendance & Shortage Tracker</span>
            {attendance?.hasShortage && (
              <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.5 rounded-full font-mono animate-pulse">
                Shortage Alert
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('marks')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'marks'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Academic Performance & Grades</span>
            {marksReport && marksReport.sgpa > 0 && (
              <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800 px-1.5 py-0.5 rounded-full font-mono">
                SGPA: {marksReport.sgpa}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'community'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Campus Community</span>
          </button>
          <button
            onClick={() => setActiveTab('doubts')}
            className={`pb-3 text-sm font-semibold transition cursor-pointer border-b-2 flex items-center space-x-2 shrink-0 ${
              activeTab === 'doubts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Academic Doubts</span>
          </button>
        </div>

        {/* Tab 1: Student Comprehensive Dashboard */}
        {activeTab === 'profile' ? <ProfilePage /> : activeTab === 'settings' ? <AppearanceSettingsPage /> : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            {/* Today's Timetable Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Clock className="w-5 h-5" />
                  <h2 className="text-base font-bold text-white">Today's Class Timetable</h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>

              {!dashboardData?.timetable || dashboardData.timetable.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No classes scheduled for today. Enjoy your academic study and lab prep!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboardData.timetable.map((slot) => (
                    <div
                      key={slot.id}
                      className={`bg-slate-950 border rounded-xl p-4 flex flex-col justify-between space-y-3 ${'status' in slot && slot.status === 'CANCELLED' ? 'border-red-800 opacity-70' : 'border-slate-800'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-semibold">
                          Period {slot.periodNumber}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-white">{slot.subject.code}</h3>
                        <p className="text-xs text-slate-300 truncate">{slot.subject.name}</p>
                        {'status' in slot && slot.status === 'CANCELLED' && <p className="text-xs text-red-300 mt-1">Cancelled{slot.note ? ` · ${slot.note}` : ''}</p>}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Room: {slot.roomNumber || 'Main Lab'}</span>
                        <span className="text-slate-300 font-medium">
                          {slot.faculty.firstName} {slot.faculty.lastName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-indigo-400 mb-4">
                <CalendarCheck className="w-5 h-5" />
                <h2 className="text-base font-bold text-white">Weekly timetable & academic calendar</h2>
              </div>
              {!dashboardData?.calendar?.length ? (
                <p className="text-xs text-slate-500 text-center py-5">No classes or calendar events for this week.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {dashboardData.calendar.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">{item.title}</p>
                        <p className="text-xs text-slate-400">{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{item.endDate && item.endDate !== item.date ? ` – ${new Date(`${item.endDate}T00:00:00`).toLocaleDateString()}` : ''}{item.type === 'CLASS' && 'periodNumber' in item ? ` · Period ${item.periodNumber}` : ''}{item.type === 'CLASS' && 'startTime' in item ? ` · ${item.startTime}–${item.endTime}` : ''}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded border ${item.type === 'CLASS' ? 'text-indigo-300 bg-indigo-950 border-indigo-800' : 'text-amber-300 bg-amber-950 border-amber-800'}`}>
                        {item.status === 'CANCELLED' ? 'CANCELLED' : item.type.replaceAll('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Metrics Grid (Attendance Overview & Latest Marks) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Attendance Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Attendance Overview
                    </span>
                    {dashboardData?.attendance?.hasShortage ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-mono animate-pulse">
                        Shortage Warning
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                        In Good Standing
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline space-x-3">
                    <span
                      className={`text-3xl font-extrabold font-mono ${
                        dashboardData?.attendance?.hasShortage ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {dashboardData?.attendance?.overallPercentage ?? 100}%
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (Institutional Min: {dashboardData?.attendance?.threshold ?? 75}%)
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    {dashboardData?.attendance?.presentCount || 0} present • {dashboardData?.attendance?.lateCount || 0} late out of {dashboardData?.attendance?.totalConducted || 0} classes conducted.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('attendance')}
                  className="mt-4 w-full py-2 bg-slate-950 hover:bg-slate-800 text-indigo-400 border border-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                >
                  View Attendance Breakdown & What-If Calculator →
                </button>
              </div>

              {/* Latest Published Marks */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Latest Published Scores
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                      Rule 5: Official Only
                    </span>
                  </div>

                  {(!dashboardData?.latestMarks || dashboardData.latestMarks.length === 0) ? (
                    <p className="text-xs text-slate-500 py-4">No published scores available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboardData.latestMarks.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{m.assessmentName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{m.subjectCode}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-white">
                              {m.isAbsent ? 'Absent' : `${m.score}/${m.maxMarks}`}
                            </span>
                            <span className="font-mono font-bold text-indigo-400 bg-indigo-950/70 border border-indigo-800/80 px-2 py-0.5 rounded-lg text-xs">
                              {m.gradeLetter || '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('marks')}
                  className="mt-4 w-full py-2 bg-slate-950 hover:bg-slate-800 text-indigo-400 border border-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                >
                  View Full Academic Report & SGPA →
                </button>
              </div>
            </div>

            {/* Recent Materials & Campus Announcements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recent Materials */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Recently Uploaded Materials
                  </h3>
                  <button
                    onClick={() => setActiveTab('materials')}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                {(!dashboardData?.recentMaterials || dashboardData.recentMaterials.length === 0) ? (
                  <p className="text-xs text-slate-500 py-4">No study materials posted yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {dashboardData.recentMaterials.map((mat) => (
                      <div
                        key={mat.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-white truncate">{mat.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {mat.subjectName} • {mat.type.replace('_', ' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenViewer(mat as any)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold flex items-center space-x-1 shrink-0 transition cursor-pointer"
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center space-x-2 text-cyan-400 mb-3">
                  <Megaphone className="w-4 h-4" />
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Campus Circulars & Announcements
                  </h3>
                </div>

                {(!dashboardData?.announcements || dashboardData.announcements.length === 0) ? (
                  <p className="text-xs text-slate-500 py-4">No campus circulars at this time.</p>
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
                        <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          By: {ann.author.firstName} {ann.author.lastName} ({ann.author.role})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unanswered Academic Doubts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <HelpCircle className="w-5 h-5" />
                  <div>
                    <h2 className="text-base font-bold text-white">My Academic Doubts & Q&A</h2>
                    <p className="text-xs text-slate-400">
                      Track instructor responses to your questions or post a new doubt.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAskDoubtOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>+ Ask a Doubt</span>
                </button>
              </div>

              {(!dashboardData?.unansweredDoubts || dashboardData.unansweredDoubts.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  You have no pending unanswered doubts. Click "+ Ask a Doubt" if you need instructor help!
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData.unansweredDoubts.map((doubt) => (
                    <div
                      key={doubt.id}
                      className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                          {doubt.subject?.code} - {doubt.subject?.name}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          Awaiting Instructor Reply
                        </span>
                      </div>
                      <h4 className="font-bold text-white">{doubt.title}</h4>
                      <p className="text-slate-300 text-[11px] whitespace-pre-wrap">{doubt.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'marks' ? (
          <div className="space-y-6">
            {/* SGPA & Cumulative Performance Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Semester GPA (SGPA)
                </p>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-4xl font-extrabold font-mono text-indigo-400">
                    {marksReport?.sgpa ?? '0.00'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ 10.0</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  Calculated across {marksReport?.totalCredits || 0} enrolled credits
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Published Gradebook Overview (Rule 5 Guarded)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Only finalized and officially published assessments are reflected here. Any subsequent score corrections by faculty write an immutable log to <code className="text-indigo-300 font-mono">audit_logs</code>.
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
                  <span>Subjects Evaluated: <strong className="text-white">{marksReport?.subjectsSummary.length || 0}</strong></span>
                  <span>Institutional Scale: <strong className="text-emerald-400">10-Point CGPA</strong></span>
                </div>
              </div>
            </div>

            {/* Subject-Wise Assessment Tables */}
            <div className="space-y-5">
              {(marksReport?.subjectsSummary || []).length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                  <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white">No Published Marks Available</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Your instructors are currently grading in draft mode. Published scores will appear here automatically.
                  </p>
                </div>
              ) : (
                marksReport?.subjectsSummary.map((sub) => (
                  <div
                    key={sub.subject.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-bold text-sm text-white">
                          {sub.subject.code} - {sub.subject.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Credits: {sub.subject.credits} • Aggregated Score: {sub.totalEarned} / {sub.totalPossible} ({sub.subjectPercentage}%)
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-slate-400 font-mono">Grade:</span>
                        <span className="text-xl font-extrabold font-mono text-indigo-400 bg-indigo-950/70 border border-indigo-800/80 px-2.5 py-0.5 rounded-xl">
                          {sub.finalGrade}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Assessment</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Score</th>
                            <th className="py-2 px-3">Grade</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {sub.assessments.map((a) => (
                            <tr key={a.markId} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-medium text-slate-200">{a.name}</td>
                              <td className="py-2 px-3">
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                  {a.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-white">
                                {a.isAbsent ? (
                                  <span className="text-red-400">Absent</span>
                                ) : (
                                  `${a.score} / ${a.maxMarks}`
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-indigo-400">
                                {a.gradeLetter || '-'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() =>
                                    setSelectedMarkCorrection({
                                      markId: a.markId,
                                      assessmentName: a.name,
                                      currentScore: a.score,
                                      maxMarks: a.maxMarks,
                                    })
                                  }
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Attendance Overview
                </p>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span
                    className={`text-3xl font-extrabold font-mono ${
                      attendance?.hasShortage ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {attendance?.overallPercentage ?? 100}%
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    (Min: {attendance?.threshold ?? 75}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {attendance?.totalAttended} classes marked present or late out of {attendance?.totalConducted} · late marks count as half credit
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Institutional Shortage Status
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {attendance?.hasShortage
                      ? '⚠️ Warning: Your overall attendance is currently below the required institutional minimum threshold.'
                      : '✅ In Good Standing: Your attendance exceeds the minimum mandatory threshold.'}
                  </p>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden mt-3 border border-slate-800">
                  <div
                    style={{ width: `${Math.min(100, attendance?.overallPercentage || 100)}%` }}
                    className={`h-full ${
                      attendance?.hasShortage ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Subject-Wise Attendance & What-If Simulators */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Subject-Wise Breakdown & Correction Request
              </h2>

              {(attendance?.subjectMetrics || []).map((subMetric) => (
                <div
                  key={subMetric.subject.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-white">
                        {subMetric.subject.code} - {subMetric.subject.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {subMetric.attended} attended • {subMetric.late} late • {subMetric.missed} missed
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-lg font-bold font-mono ${
                          subMetric.isShortage ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {subMetric.percentage}%
                      </span>
                      {subMetric.isShortage && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-950 text-red-300 border border-red-800 font-mono">
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
                    <p className="text-xs font-semibold text-slate-300 mb-2">
                      Recent Class Sessions ({subMetric.records.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {subMetric.records.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs"
                        >
                          <span className="text-slate-300">
                            {new Date(r.date).toLocaleDateString()} (Period {r.period})
                          </span>

                          <div className="flex items-center space-x-3">
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                r.status === 'PRESENT'
                                  ? 'text-emerald-400'
                                  : r.status === 'LATE'
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {r.status}
                            </span>

                            {r.status !== 'PRESENT' && (
                              <button
                                onClick={() =>
                                  setSelectedCorrectionRecord({
                                    id: r.recordId,
                                    date: r.date,
                                    period: r.period,
                                    subjectName: subMetric.subject.name,
                                    currentStatus: r.status,
                                  })
                                }
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
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
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Faculty Classroom Boards & Annotated Slides
            </h2>

            {sessions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No Archived Lessons Available</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  When instructors conduct whiteboard lessons for your section, they will be archived here for revision.
                </p>
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
                        Taught by {sess.faculty?.firstName} {sess.faculty?.lastName} • {sess._count?.pages || 1} slide(s)
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => openStudentCanvas(sess.id)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
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
          <>
            {/* Recently Viewed Carousel */}
        {recentlyViewed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Recently Viewed</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentlyViewed.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenViewer(item)}
                  className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3 w-56 shrink-0 cursor-pointer transition"
                >
                  <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.subject?.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search, Filter & Bookmark Tabs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic, unit, or keywords..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:ring-2 focus:ring-indigo-500"
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
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                bookmarkedOnly
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/80'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Bookmarks</span>
            </button>
          </div>
        </div>

        {/* Materials Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading course notes...</span>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No Learning Materials Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Your instructors haven't published materials matching your criteria yet.
            </p>
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
                    <button
                      onClick={() => toggleBookmark(m.id)}
                      className="p-1 text-slate-500 hover:text-amber-400 transition cursor-pointer"
                      title={m.isBookmarked ? 'Remove bookmark' : 'Bookmark material'}
                    >
                      {m.isBookmarked ? (
                        <BookmarkCheck className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm text-white line-clamp-1">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {m.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">{m.subject?.name}</span>
                    {m.unit && <span className="truncate font-mono">Unit {m.unit.unitNumber}</span>}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 truncate">
                    By {m.createdBy?.firstName} {m.createdBy?.lastName}
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* External video link */}
                    {m.externalUrl ? (
                      <a
                        href={m.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-medium flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Watch</span>
                      </a>
                    ) : (
                      <>
                        {/* Inline Read-Only Viewer */}
                        <button
                          onClick={() => handleOpenViewer(m)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm shadow-indigo-600/20"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View (PDF.js)</span>
                        </button>

                        {/* Strict Server-Enforced Download Button */}
                        {m.allowDownload ? (
                          <button
                            onClick={() => handleDirectDownload(m)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            title="Downloads disabled by instructor"
                            className="p-1.5 bg-slate-800/40 text-slate-600 rounded-lg cursor-not-allowed"
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
        </>
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
