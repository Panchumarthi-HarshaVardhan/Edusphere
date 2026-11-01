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

  return (
    <PortalLayout portalName="Admin Command Center" sidebarItems={sidebarItems} onSettingsClick={() => setActiveTab('appearance')}>
      <div className="admin-portal w-full max-w-[1500px] space-y-6">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 text-indigo-400 mb-1">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="text-xl font-bold text-white">Administrative Command Center</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Logged in as <span className="text-slate-200 font-semibold">{user?.firstName} {user?.lastName}</span> ({user?.role}).
              Tenant-scoped to <span className="text-indigo-400 font-mono font-semibold">{user?.institutionName}</span>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800 rounded-full font-mono flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
              <span>Tenant Isolated</span>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Tenant ID Scoping</p>
                <p className="text-sm font-mono text-emerald-400 mt-2 truncate">{user?.institutionId}</p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 rounded-lg">
                  Rule 1: Scoped Queries Active
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current Threshold</p>
                <p className="text-2xl font-black text-indigo-400 font-mono mt-1">
                  {settings?.defaultAttendanceThreshold || 75}%
                </p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800 rounded-lg">
                  Rule 6: Shortage Trigger
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Institution Domain</p>
                <p className="text-lg font-bold text-white mt-1">{settings?.domain || 'edusphere.edu'}</p>
                <span className="inline-block mt-3 text-[11px] px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">
                  Multi-Institution Mesh
                </span>
              </div>
            </div>

            {/* Attendance Threshold Configuration Card (Rule 6) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center space-x-3 text-indigo-400 mb-2">
                <Sliders className="w-5 h-5" />
                <h2 className="text-base font-bold text-white">Institutional Attendance Threshold Setting</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Set the default minimum attendance percentage threshold across all programs and sections. Students falling below this threshold will automatically be flagged for shortage warnings and What-If calculators.
              </p>

              <form onSubmit={handleUpdateThreshold} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Minimum Attendance Percentage (%)
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min="50"
                      max="100"
                      step="0.5"
                      value={thresholdInput}
                      onChange={(e) => setThresholdInput(parseFloat(e.target.value) || 0)}
                      className="w-36 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-lg focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingSettings ? 'Saving...' : 'Apply Threshold'}
                    </button>
                  </div>
                </div>

                {settingsMessage && (
                  <p className="text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">User Directory & Status Control</h2>
                <p className="text-xs text-slate-400">
                  Manage accounts with soft-delete (isActive) and role assignment.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="FACULTY">FACULTY</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="HOD">HOD</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search user..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading user catalog...</div>
            ) : usersList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Name & Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Association</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-white">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : u.role === 'FACULTY'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {u.department
                            ? `Dept: ${u.department.code}`
                            : u.enrollments && u.enrollments.length > 0
                            ? `Roll: ${u.enrollments[0].rollNumber} (${u.enrollments[0].section.name})`
                            : 'Administration'}
                        </td>
                        <td className="py-2.5 px-3">
                          {u.isActive ? (
                            <span className="text-emerald-400 font-medium flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="text-red-400 font-medium flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              <span>Deactivated</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              u.isActive
                                ? 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80'
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Immutable Institutional Audit Log</h2>
                <p className="text-xs text-slate-400">
                  Every published marks change, sensitive setting update, and status toggle is recorded here (Rule 4).
                </p>
              </div>
              <button
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">User
                <select value={auditFilters.userId} onChange={(e) => setAuditFilters({ ...auditFilters, userId: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
                  <option value="">All users</option>{auditUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">Action
                <input value={auditFilters.action} onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })} placeholder="Filter action" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">From
                <input type="date" value={auditFilters.startDate} onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">Through
                <input type="date" value={auditFilters.endDate} onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading audit records...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No audit records logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Resource</th>
                      <th className="py-2.5 px-3">Details / Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-white">
                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.user?.email || 'N/A'}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{log.resource}</td>
                        <td className="py-2.5 px-3">
                          <pre className="text-[10px] text-slate-300 font-mono bg-slate-950 p-2 rounded-lg max-w-xs overflow-x-auto">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Institutional Grade Rules & Scale</h2>
                <p className="text-xs text-slate-400">
                  Configure cutoffs for letter grades and grade points used in marks calculation.
                </p>
              </div>
              <button
                onClick={handleSaveGradeRules}
                disabled={savingGrades}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {savingGrades ? 'Saving...' : 'Save Grade Rules'}
              </button>
            </div>

            {gradeMessage && (
              <p className="text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{gradeMessage}</span>
              </p>
            )}

            {loadingGrades ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading grade rules...</div>
            ) : gradeRules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No custom grade rules found. Default 10-point scale active.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Grade Letter</th>
                      <th className="py-2.5 px-3">Grade Point</th>
                      <th className="py-2.5 px-3">Min %</th>
                      <th className="py-2.5 px-3">Max %</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {gradeRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-white text-sm">{rule.gradeLetter}</td>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{rule.gradePoint.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-slate-300">{rule.minPercentage}%</td>
                        <td className="py-2.5 px-3 text-slate-300">{rule.maxPercentage}%</td>
                        <td className="py-2.5 px-3">
                          {rule.isPass ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                              PASS
                            </span>
                          ) : (
                            <span className="text-[10px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
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
