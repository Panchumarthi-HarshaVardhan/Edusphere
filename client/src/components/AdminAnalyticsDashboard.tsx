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
const selectClass = 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200';
const chartCard = 'rounded-2xl border border-slate-800 bg-slate-900 p-5';

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
  const filter = (label: string, key: keyof typeof filters, items: Option[]) => <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">{label}<select className={selectClass} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}><option value="">All {label.toLowerCase()}s</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const card = (label: string, value: number, icon: typeof Users, color: string) => { const Icon = icon; return <div className={chartCard}><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><Icon className={`h-5 w-5 ${color}`} /></div><p className="mt-3 text-3xl font-bold text-white">{value.toLocaleString()}</p></div>; };
  return <div className="space-y-5">
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      {filter('Year', 'academicYearId', years)}{filter('Department', 'departmentId', departments)}{filter('Semester', 'semesterId', semesters)}{filter('Section', 'sectionId', sections)}
      <button onClick={() => void load()} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Apply filters</button>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-xs text-red-300">{error}</p>}
    {loading && <p className="text-center text-sm text-slate-400">Loading analytics…</p>}
    {data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {card('Students', data.counts.students, Users, 'text-indigo-400')}{card('Faculty', data.counts.faculty, UserRound, 'text-cyan-400')}
        {card('Below attendance threshold', data.attendanceShortages.length, TrendingUp, 'text-amber-400')}{card('Threshold', data.attendanceThreshold, Activity, 'text-emerald-400')}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-white">Department attendance</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.attendanceByDepartment}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="department" stroke="#94a3b8"/><YAxis domain={[0, 100]} stroke="#94a3b8"/><Tooltip/><Bar dataKey="attendancePercentage" name="Attendance %" fill="#818cf8"/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-white">Published subject pass percentage</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.passBySubject}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="subject" stroke="#94a3b8"/><YAxis domain={[0, 100]} stroke="#94a3b8"/><Tooltip/><Bar dataKey="passPercentage" name="Pass %" fill="#34d399"/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-white">Faculty workload</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.facultyWorkload}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="faculty" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Legend/><Bar dataKey="assignments" fill="#38bdf8"/><Bar dataKey="scheduledPeriods" name="Weekly periods" fill="#a78bfa"/></BarChart></ResponsiveContainer></div></div>
        <div className={chartCard}><h2 className="mb-4 text-sm font-bold text-white">Community activity · 30 days</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.communityActivity}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Legend/><Line dataKey="posts" stroke="#818cf8"/><Line dataKey="comments" stroke="#34d399"/><Line dataKey="likes" stroke="#fbbf24"/></LineChart></ResponsiveContainer></div></div>
      </section>
      <section className={`${chartCard} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-white">Attendance shortage list</h2><p className="text-xs text-slate-400">Students below the institution’s {data.attendanceThreshold}% attendance threshold.</p></div><div className="flex gap-2"><button onClick={() => void exportRows('csv')} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white"><Download className="h-3.5 w-3.5"/>CSV</button><button onClick={() => void exportRows('xlsx')} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white"><Download className="h-3.5 w-3.5"/>Excel</button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr>{['Student','Email','Section','Sessions','Attendance'].map((x) => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{data.attendanceShortages.map((row) => <tr key={`${row.studentId}:${row.section}`} className="border-t border-slate-800 text-slate-300"><td className="p-2">{row.firstName} {row.lastName}</td><td className="p-2">{row.email}</td><td className="p-2">{row.section}</td><td className="p-2">{row.attended}/{row.totalSessions}</td><td className="p-2 text-amber-300">{row.percentage}%</td></tr>)}{!data.attendanceShortages.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No students below the threshold for these filters.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </div>;
}
