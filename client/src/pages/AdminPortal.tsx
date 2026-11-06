import React, { useState, useEffect } from 'react';
import { PortalLayout } from '../components/PortalLayout';
import {
  ShieldCheck,
  Users,
  Layers,
  BarChart3,
  Database,
  Sliders,
  CheckCircle2,
  Search,
  RotateCcw,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { AdminSetupPanel } from '../components/AdminSetupPanel';
import { ScheduleAdminPanel } from '../components/ScheduleAdminPanel';
import { AdminAnalyticsDashboard } from '../components/AdminAnalyticsDashboard';
import { CommunityFeed } from '../components/CommunityFeed';
import { AppearanceSettingsPage } from '../components/ProfileSettings';

interface InstitutionSettings {
  id: string;
  name: string;
  code: string;
  domain: string;
  defaultAttendanceThreshold: number;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: any;
  ipAddress?: string;
  createdAt: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  department?: { name: string; code: string };
  enrollments?: Array<{ rollNumber: string; section: { name: string } }>;
}

interface GradeRuleItem {
  id?: string;
  gradeLetter: string;
  gradePoint: number;
  minPercentage: number;
  maxPercentage: number;
  isPass: boolean;
}

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audit' | 'grades' | 'setup' | 'schedule' | 'analytics' | 'announcements' | 'appearance'>('overview');

  // State
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [thresholdInput, setThresholdInput] = useState<number>(75);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditUsers, setAuditUsers] = useState<UserItem[]>([]);
  const [auditFilters, setAuditFilters] = useState({ userId: '', action: '', startDate: '', endDate: '' });

  const [gradeRules, setGradeRules] = useState<GradeRuleItem[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeMessage, setGradeMessage] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'grades') fetchGradeRules();
  }, [activeTab, userRoleFilter, auditFilters]);

  useEffect(() => {
    if (activeTab === 'audit') api.get('/admin/users', { params: { limit: 100 } }).then((res) => setAuditUsers(res.data.users || [])).catch(() => undefined);
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
      setThresholdInput(res.data.defaultAttendanceThreshold || 75);
    } catch (err) {
      console.error('Failed to fetch settings:');
    }
  };

  const handleUpdateThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await api.patch('/admin/settings', {
        defaultAttendanceThreshold: Number(thresholdInput),
      });
      setSettings(res.data.settings);
      setSettingsMessage('Attendance threshold updated successfully (Rule 6).');
    } catch (err: any) {
      setSettingsMessage(err.response?.data?.message || 'Failed to update threshold.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params: any = {};
      if (userRoleFilter) params.role = userRoleFilter;
      if (userSearch) params.search = userSearch;
      const res = await api.get('/admin/users', { params });
      setUsersList(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, {
        isActive: !currentStatus,
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/admin/audit-logs', { params: Object.fromEntries(Object.entries(auditFilters).filter(([, value]) => value)) });
      setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchGradeRules = async () => {
    setLoadingGrades(true);
    try {
      const res = await api.get('/admin/grade-rules');
      setGradeRules(res.data || []);
    } catch (err) {
      console.error('Failed to fetch grade rules:');
    } finally {
      setLoadingGrades(false);
    }
  };

  const handleSaveGradeRules = async () => {
    setSavingGrades(true);
    setGradeMessage(null);
    try {
      await api.put('/admin/grade-rules', { rules: gradeRules });
      setGradeMessage('Grading scale updated and audit logged successfully.');
    } catch (err: any) {
      setGradeMessage(err.response?.data?.message || 'Failed to save grade rules.');
    } finally {
      setSavingGrades(false);
    }
  };

  const sidebarItems = [
    {
      icon: BarChart3,
      label: 'Institution Overview',
      active: activeTab === 'overview',
      onClick: () => setActiveTab('overview'),
    },
    {
      icon: Users,
      label: 'User Directory',
      badge: 'Active',
      active: activeTab === 'users',
      onClick: () => setActiveTab('users'),
    },
    {
      icon: Database,
      label: 'Academic Setup',
      active: activeTab === 'setup',
      onClick: () => setActiveTab('setup'),
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      active: activeTab === 'analytics',
      onClick: () => setActiveTab('analytics'),
    },
    {
      icon: Megaphone,
      label: 'Announcements',
      active: activeTab === 'announcements',
      onClick: () => setActiveTab('announcements'),
    },
    {
      icon: Sliders,
      label: 'Timetable & Calendar',
      active: activeTab === 'schedule',
      onClick: () => setActiveTab('schedule'),
    },
    {
      icon: Database,
      label: 'Tenant Audit Logs',
      badge: 'Rule 1 & 4',
      active: activeTab === 'audit',
      onClick: () => setActiveTab('audit'),
    },
    {
      icon: Layers,
      label: 'Grading Rules',
      active: activeTab === 'grades',
      onClick: () => setActiveTab('grades'),
    },
  ];

  const tabTitles: Record<typeof activeTab, string> = {
    overview: 'Institution Overview',
    users: 'User Directory & Roles',
    setup: 'Academic Setup',
    analytics: 'Institutional Analytics',
    announcements: 'Campus Announcements',
    schedule: 'Timetable & Calendar',
    audit: 'Tenant Audit Logs',
    grades: 'Grading Scale & Rules',
    appearance: 'Appearance Settings',
  };

  return (
    <PortalLayout
      portalName="Admin Command Center"
      sidebarItems={sidebarItems}
      onSettingsClick={() => setActiveTab('appearance')}
      activeTitle={tabTitles[activeTab]}
    >
      <div className="w-full max-w-[1500px] space-y-6 mx-auto pb-12">
        {/* Banner */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Administrative Command Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Logged in as <strong className="text-slate-800">{user?.firstName} {user?.lastName}</strong> ({user?.role}) · Institution: <span className="text-indigo-700 font-medium">{user?.institutionName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-mono flex items-center gap-1.5 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Tenant Isolated (Multi-Institution)</span>
            </span>
          </div>
        </div>

        {/* Tab 1: Overview & Attendance Threshold Config */}
        {activeTab === 'analytics' && <AdminAnalyticsDashboard />}
        {activeTab === 'appearance' && <AppearanceSettingsPage />}
        {activeTab === 'announcements' && <CommunityFeed userRole={user?.role} currentUserId={user?.id} />}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Tenant Scoping</p>
                <p className="text-sm font-mono text-emerald-700 font-semibold mt-2 truncate">{user?.institutionId}</p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-medium">
                  Rule 1: Scoped Queries Active
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Attendance Threshold</p>
                <p className="text-2xl font-black text-indigo-700 font-mono mt-1">
                  {settings?.defaultAttendanceThreshold || 75}%
                </p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-medium">
                  Rule 6: Shortage Trigger Minimum
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Institution Domain</p>
                <p className="text-base font-bold text-slate-900 mt-1">{settings?.domain || 'edusphere.edu'}</p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                  Multi-Institution Mesh
                </span>
              </div>
            </div>

            {/* Attendance Threshold Configuration Card (Rule 6) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-indigo-700 mb-1.5">
                <Sliders className="w-4 h-4" />
                <h2 className="text-sm font-bold text-slate-900">Institutional Attendance Threshold Setting</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4 max-w-2xl">
                Set the default minimum attendance percentage threshold across all programs and sections. Students falling below this threshold will automatically be flagged for shortage warnings and What-If calculators.
              </p>

              <form onSubmit={handleUpdateThreshold} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Minimum Attendance Percentage (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="50"
                      max="100"
                      step="0.5"
                      value={thresholdInput}
                      onChange={(e) => setThresholdInput(parseFloat(e.target.value) || 0)}
                      className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-lg focus:bg-white focus:border-indigo-600 outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="saas-btn-primary py-2 px-4 text-xs disabled:opacity-50"
                    >
                      {isSavingSettings ? 'Saving...' : 'Apply Threshold'}
                    </button>
                  </div>
                </div>

                {settingsMessage && (
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{settingsMessage}</span>
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: User Directory */}
        {activeTab === 'setup' && <AdminSetupPanel />}
        {activeTab === 'schedule' && <ScheduleAdminPanel />}
        {activeTab === 'users' && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">User Directory & Status Control</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage accounts with soft-delete (isActive) and role assignment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none transition cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="FACULTY">FACULTY</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="HOD">HOD</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search user..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading user catalog...</div>
            ) : usersList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-mono uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Name & Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Association</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === 'FACULTY'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {u.department
                            ? `Dept: ${u.department.code}`
                            : u.enrollments && u.enrollments.length > 0
                            ? `Roll: ${u.enrollments[0].rollNumber} (${u.enrollments[0].section.name})`
                            : 'Administration'}
                        </td>
                        <td className="py-2.5 px-3">
                          {u.isActive ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1.5 text-xs">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-medium flex items-center gap-1.5 text-xs">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              <span>Deactivated</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer border ${
                              u.isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Tenant Audit Logs (Rule 1 & Rule 4) */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Immutable Institutional Audit Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every published marks change, sensitive setting update, and status toggle is recorded here (Rule 4).
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="saas-btn-secondary text-xs py-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-[11px] uppercase tracking-wide text-slate-500 font-medium">User
                <select
                  value={auditFilters.userId}
                  onChange={(e) => setAuditFilters({ ...auditFilters, userId: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none"
                >
                  <option value="">All users</option>
                  {auditUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} · {u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Action
                <input
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                  placeholder="Filter action..."
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none"
                />
              </label>
              <label className="grid gap-1 text-[11px] uppercase tracking-wide text-slate-500 font-medium">From
                <input
                  type="date"
                  value={auditFilters.startDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none"
                />
              </label>
              <label className="grid gap-1 text-[11px] uppercase tracking-wide text-slate-500 font-medium">Through
                <input
                  type="date"
                  value={auditFilters.endDate}
                  onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none"
                />
              </label>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading audit records...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                No audit records logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-mono uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Resource</th>
                      <th className="py-2.5 px-3">Details / Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">
                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.user?.email || 'N/A'}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-semibold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">{log.resource}</td>
                        <td className="py-2.5 px-3">
                          <pre className="text-[10px] text-slate-700 font-mono bg-slate-50 border border-slate-200 p-2 rounded max-w-xs overflow-x-auto">
                            {JSON.stringify(log.details, null, 1)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Grading Scale & Rules Configuration */}
        {activeTab === 'grades' && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Institutional Grade Rules & Scale</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure cutoffs for letter grades and grade points used in marks calculation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveGradeRules}
                disabled={savingGrades}
                className="saas-btn-primary disabled:opacity-50"
              >
                {savingGrades ? 'Saving...' : 'Save Grade Rules'}
              </button>
            </div>

            {gradeMessage && (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{gradeMessage}</span>
              </p>
            )}

            {loadingGrades ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading grade rules...</div>
            ) : gradeRules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                No custom grade rules found. Default 10-point scale active.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-mono uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Grade Letter</th>
                      <th className="py-2.5 px-3">Grade Point</th>
                      <th className="py-2.5 px-3">Min %</th>
                      <th className="py-2.5 px-3">Max %</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {gradeRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900 text-sm">{rule.gradeLetter}</td>
                        <td className="py-2.5 px-3 text-indigo-700 font-bold">{rule.gradePoint.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-slate-700">{rule.minPercentage}%</td>
                        <td className="py-2.5 px-3 text-slate-700">{rule.maxPercentage}%</td>
                        <td className="py-2.5 px-3">
                          {rule.isPass ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                              PASS
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                              FAIL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
