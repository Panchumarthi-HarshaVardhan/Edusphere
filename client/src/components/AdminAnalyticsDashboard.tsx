import { useCallback, useEffect, useState } from 'react';
import { Activity, Download, Users, UserRound, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/client';

type Option = { id: string; name: string; code?: string };
type Analytics = {
  counts: { students: number; faculty: number };
  attendanceThreshold: number;
  attendanceByDepartment: Array<{ department: string; attendancePercentage: number }>;
  passBySubject: Array<{ subject: string; passPercentage: number; students: number }>;
  attendanceShortages: Array<{ studentId: string; firstName: string; lastName: string; email: string; section: string; totalSessions: number; attended: number; percentage: number }>;
  facultyWorkload: Array<{ facultyId: string; faculty: string; assignments: number; scheduledPeriods: number }>;
  communityActivity: Array<{ date: string; posts: number; comments: number; likes: number }>;
};
const selectClass = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-600 transition';
const chartCard = 'rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs';

export function AdminAnalyticsDashboard() {
  const [years, setYears] = useState<Option[]>([]); const [departments, setDepartments] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]); const [sections, setSections] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ academicYearId: '', departmentId: '', semesterId: '', sectionId: '' });
  const [data, setData] = useState<Analytics | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/admin/analytics/dashboard', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }); setData(response.data); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to load analytics.'); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { Promise.all([
    api.get('/admin/setup/academic-years', { params: { limit: 100 } }), api.get('/admin/setup/departments', { params: { limit: 100 } }),
    api.get('/admin/setup/semesters', { params: { limit: 100 } }), api.get('/admin/setup/sections', { params: { limit: 100 } }),
  ]).then(([y, d, s, sec]) => { setYears(y.data.items || []); setDepartments(d.data.items || []); setSemesters(s.data.items || []); setSections(sec.data.items || []); })
    .catch(() => setError('Could not load analytics filters.')); }, []);
  useEffect(() => { void load(); }, [load]);
  const exportRows = async (format: 'csv' | 'xlsx') => {
    try {
      const response = await api.get('/admin/analytics/attendance-shortages/export', { params: { ...filters, format }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `attendance-shortages.${format}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.response?.data?.message || 'Could not export attendance shortage report.'); }
  };
  const filter = (label: string, key: keyof typeof filters, items: Option[]) => <label className="grid gap-1 text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}<select className={selectClass} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}><option value="">All {label.toLowerCase()}s</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const card = (label: string, value: number, icon: typeof Users, color: string) => { const Icon = icon; return <div className={chartCard}><div className="flex items-center justify-between"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p><Icon className={`h-5 w-5 ${color}`} /></div><p className="mt-3 text-2xl font-bold font-mono tracking-tight text-slate-900">{value.toLocaleString()}</p></div>; };
  return <div className="space-y-5">
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
      {filter('Year', 'academicYearId', years)}{filter('Department', 'departmentId', departments)}{filter('Semester', 'semesterId', semesters)}{filter('Section', 'sectionId', sections)}
      <button onClick={() => void load()} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 transition cursor-pointer shadow-xs">Apply filters</button>
    </section>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {loading && <p className="text-center text-sm text-slate-400">Loading analytics…</p>}
    {data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {card('Students', data.counts.students, Users, 'text-indigo-400')}{card('Faculty', data.counts.faculty, UserRound, 'text-cyan-400')}
        {card('Below attendance threshold', data.attendanceShortages.length, TrendingUp, 'text-amber-400')}{card('Threshold', data.attendanceThreshold, Activity, 'text-emerald-400')}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-slate-900">Department attendance</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.attendanceByDepartment}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="department" stroke="#64748b" textAnchor="end" tick={{ fontSize: 11 }}/><YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey="attendancePercentage" name="Attendance %" fill="#4338ca" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-slate-900">Published subject pass percentage</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.passBySubject}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="subject" stroke="#64748b" tick={{ fontSize: 11 }}/><YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey="passPercentage" name="Pass %" fill="#16a34a" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-slate-900">Faculty workload</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.facultyWorkload}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="faculty" stroke="#64748b" tick={{ fontSize: 11 }}/><YAxis stroke="#64748b" tick={{ fontSize: 11 }}/><Tooltip/><Legend/><Bar dataKey="assignments" fill="#0284c7" radius={[4, 4, 0, 0]}/><Bar dataKey="scheduledPeriods" name="Weekly periods" fill="#7c3aed" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-slate-900">Community activity · 30 days</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.communityActivity}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }}/><YAxis stroke="#64748b" tick={{ fontSize: 11 }}/><Tooltip/><Legend/><Line dataKey="posts" stroke="#4338ca" strokeWidth={2}/><Line dataKey="comments" stroke="#16a34a" strokeWidth={2}/><Line dataKey="likes" stroke="#d97706" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
      </section>
      <section className={`${chartCard} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Attendance shortage list</h2><p className="text-xs text-slate-500">Students below the institution’s {data.attendanceThreshold}% attendance threshold.</p></div><div className="flex gap-2"><button onClick={() => void exportRows('csv')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"><Download className="h-3.5 w-3.5 text-slate-500"/>CSV</button><button onClick={() => void exportRows('xlsx')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"><Download className="h-3.5 w-3.5 text-slate-500"/>Excel</button></div></div>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600 uppercase font-mono border-b border-slate-200"><tr>{['Student','Email','Section','Sessions','Attendance'].map((x) => <th key={x} className="p-2.5">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.attendanceShortages.map((row) => <tr key={`${row.studentId}:${row.section}`} className="hover:bg-slate-50/70 transition text-slate-700"><td className="p-2.5 font-medium text-slate-900">{row.firstName} {row.lastName}</td><td className="p-2.5 font-mono text-[11px] text-slate-500">{row.email}</td><td className="p-2.5">{row.section}</td><td className="p-2.5">{row.attended}/{row.totalSessions}</td><td className="p-2.5 font-mono font-bold text-rose-600">{row.percentage}%</td></tr>)}{!data.attendanceShortages.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No students below the threshold for these filters.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </div>;
}
