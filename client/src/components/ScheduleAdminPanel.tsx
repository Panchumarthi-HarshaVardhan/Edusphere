import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import api from '../api/client';

type Ref = { id: string; name?: string; code?: string; firstName?: string; lastName?: string; email?: string };
type Period = { id: string; number: number; name: string; startTime: string; endTime: string };
type Slot = { id: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; roomNumber?: string | null; section: Ref; subject: Ref; faculty: Ref };
type Event = { id: string; type: string; title: string; startDate: string; endDate: string; section?: Ref | null };
const field = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition';
const action = 'rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 transition cursor-pointer shadow-xs';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dateToday = () => new Date().toISOString().slice(0, 10);
const timetableTemplate = 'sectionName,subjectCode,facultyEmail,periodNumber,dayOfWeek,roomNumber\n';

export function ScheduleAdminPanel() {
  const [periods, setPeriods] = useState<Period[]>([]); const [slots, setSlots] = useState<Slot[]>([]); const [events, setEvents] = useState<Event[]>([]);
  const [sections, setSections] = useState<Ref[]>([]); const [subjects, setSubjects] = useState<Ref[]>([]); const [faculty, setFaculty] = useState<Ref[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [periodForm, setPeriodForm] = useState({ number: '', name: '', startTime: '', endTime: '' });
  const [slotForm, setSlotForm] = useState({ sectionId: '', subjectId: '', facultyId: '', periodId: '', dayOfWeek: '1', roomNumber: '' });
  const [eventForm, setEventForm] = useState({ type: 'HOLIDAY', title: '', description: '', startDate: dateToday(), endDate: dateToday(), sectionId: '' });
  const [override, setOverride] = useState({ slotId: '', date: dateToday(), type: 'CANCELLED', substituteFacultyId: '', substituteRoom: '', note: '' });
  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{ importedCount: number; errorCount: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const timetableInput = useRef<HTMLInputElement>(null);
  const reload = useCallback(async () => {
    const [p, t, e] = await Promise.all([api.get('/calendar/periods'), api.get('/calendar/timetable'), api.get('/calendar/events')]);
    setPeriods(p.data); setSlots(t.data); setEvents(e.data);
  }, []);
  useEffect(() => { Promise.all([
    api.get('/admin/setup/sections', { params: { limit: 100 } }), api.get('/admin/setup/subjects', { params: { limit: 100 } }),
    api.get('/admin/users', { params: { role: 'FACULTY', limit: 100 } }), reload(),
  ]).then(([s, sub, f]) => { setSections(s.data.items || []); setSubjects(sub.data.items || []); setFaculty(f.data.users || []); })
    .catch((error: any) => setMessage(error.response?.data?.message || 'Could not load timetable setup data.')); }, [reload]);
  const save = async (event: FormEvent, url: string, data: unknown, reset: () => void) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await api.post(url, data); reset(); await reload(); setMessage('Saved and audit logged.'); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Could not save. Check the values and timetable clashes.'); }
    finally { setBusy(false); }
  };
  const importTimetable = async (event: FormEvent) => {
    event.preventDefault();
    if (!timetableFile) return;
    setImporting(true); setMessage(''); setImportReport(null);
    try {
      const form = new FormData(); form.append('file', timetableFile);
      const response = await api.post('/calendar/timetable/import', form);
      setImportReport(response.data);
      setMessage(`Imported ${response.data.importedCount} class${response.data.importedCount === 1 ? '' : 'es'}${response.data.errorCount ? ` · ${response.data.errorCount} row${response.data.errorCount === 1 ? '' : 's'} need attention` : ''}.`);
      setTimetableFile(null);
      if (timetableInput.current) timetableInput.current.value = '';
      await reload();
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Timetable import failed. Check the file and try again.');
    } finally { setImporting(false); }
  };
  const downloadTemplate = () => {
    const blob = new Blob([timetableTemplate], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'edusphere-timetable-template.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  const select = (label: string, value: string, items: Ref[], onChange: (v: string) => void, people = false) => <label className="grid gap-1 text-[11px] text-slate-500 font-medium">{label}<select required className={field} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Choose…</option>{items.map((x) => <option key={x.id} value={x.id}>{people ? `${x.firstName} ${x.lastName} (${x.email})` : x.name || x.code}</option>)}</select></label>;
  const heading = (text: string) => <h2 className="text-sm font-bold text-slate-900">{text}</h2>;
  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
      <div><p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Academic operations</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Timetable &amp; calendar</h2><p className="mt-1 max-w-2xl text-xs text-slate-500">Set institution periods, schedule classes without clashes, and publish calendar changes to the right students.</p></div>
      <div className="flex gap-2 text-xs"><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600"><b className="text-slate-900">{periods.length}</b> periods</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600"><b className="text-slate-900">{slots.length}</b> classes</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600"><b className="text-slate-900">{events.length}</b> events</span></div>
    </header>
    {message && <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 font-medium">{message}</p>}
    <section className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2 text-indigo-700"><Clock3 className="h-4 w-4" />{heading('Institution periods')}</div>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => save(e, '/calendar/periods', { ...periodForm, number: Number(periodForm.number) }, () => setPeriodForm({ number: '', name: '', startTime: '', endTime: '' }))}>
        <input required type="number" min="1" max="20" placeholder="Period number" className={field} value={periodForm.number} onChange={(e) => setPeriodForm({ ...periodForm, number: e.target.value })} />
        <input required placeholder="Name" className={field} value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} />
        <input required type="time" aria-label="Start time" className={field} value={periodForm.startTime} onChange={(e) => setPeriodForm({ ...periodForm, startTime: e.target.value })} />
        <input required type="time" aria-label="End time" className={field} value={periodForm.endTime} onChange={(e) => setPeriodForm({ ...periodForm, endTime: e.target.value })} />
        <button disabled={busy} className={action}>Add period</button>
      </form>
      {periods.length ? <div className="flex flex-wrap gap-2">{periods.map((p) => <span key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 font-mono font-medium">P{p.number} · {p.name} · {p.startTime}–{p.endTime}</span>)}</div> : <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">No periods yet. Add the institution’s teaching periods above.</p>}
    </section>
    <section className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100"><FileSpreadsheet className="h-5 w-5" /></div><div><h3 className="text-sm font-semibold text-slate-900">Import a weekly timetable</h3><p className="mt-0.5 text-xs text-slate-500">Upload CSV or Excel. Valid rows are saved; rows with missing data, unassigned faculty, or clashes are returned with row numbers.</p></div></div>
      <form onSubmit={importTimetable} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <label className="grid gap-1.5 text-[11px] font-medium text-slate-600">Timetable file
          <input ref={timetableInput} type="file" accept=".csv,.xlsx" onChange={(event) => { setTimetableFile(event.target.files?.[0] || null); setImportReport(null); }} className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-800`} />
        </label>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Download className="h-4 w-4 text-slate-500" /> Download template</button>
        <button disabled={!timetableFile || importing} className={`${action} inline-flex items-center justify-center gap-2 px-4 py-2`}><Upload className="h-4 w-4" />{importing ? 'Importing…' : 'Upload timetable'}</button>
      </form>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">Create institution periods first. Required columns: <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">sectionName, subjectCode, facultyEmail, periodNumber, dayOfWeek</code>. Optional: <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">roomNumber</code>. Use names and codes from Academic Setup; day can be Monday–Sunday or 1–7.</div>
      {importReport?.errors.length ? <div className="overflow-hidden rounded-xl border border-amber-200"><div className="bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Rows requiring attention</div><div className="max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-2">Row</th><th className="px-4 py-2">Issue</th></tr></thead><tbody>{importReport.errors.map((issue) => <tr key={`${issue.row}-${issue.message}`} className="border-t border-slate-100 text-slate-700"><td className="px-4 py-2 font-mono">{issue.row}</td><td className="px-4 py-2">{issue.message}</td></tr>)}</tbody></table></div></div> : importReport && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 font-medium">All {importReport.importedCount} rows imported successfully.</p>}
    </section>
    <section className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-indigo-700"><CalendarDays className="h-4 w-4" />{heading('Weekly timetable')}</div><button type="button" aria-label="Refresh schedule" onClick={() => reload().catch(() => setMessage('Refresh failed.'))} className="text-slate-400 hover:text-slate-700 transition cursor-pointer"><RefreshCw className="h-4 w-4" /></button></div>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => save(e, '/calendar/timetable', { ...slotForm, dayOfWeek: Number(slotForm.dayOfWeek) }, () => setSlotForm({ sectionId: '', subjectId: '', facultyId: '', periodId: '', dayOfWeek: '1', roomNumber: '' }))}>
        {select('Section', slotForm.sectionId, sections, (sectionId) => setSlotForm({ ...slotForm, sectionId }))}{select('Subject', slotForm.subjectId, subjects, (subjectId) => setSlotForm({ ...slotForm, subjectId }))}
        {select('Faculty', slotForm.facultyId, faculty, (facultyId) => setSlotForm({ ...slotForm, facultyId }), true)}
        {select('Period', slotForm.periodId, periods.map((p) => ({ id: p.id, name: `P${p.number} ${p.name} (${p.startTime}–${p.endTime})` })), (periodId) => setSlotForm({ ...slotForm, periodId }))}
        <label className="grid gap-1 text-[11px] text-slate-500 font-medium">Day<select className={field} value={slotForm.dayOfWeek} onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: e.target.value })}>{days.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
        <input placeholder="Room (optional)" className={field} value={slotForm.roomNumber} onChange={(e) => setSlotForm({ ...slotForm, roomNumber: e.target.value })} /><button disabled={busy || !periods.length} className={action}>Add timetable entry</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 text-slate-600 uppercase font-mono"><tr>{['Day / time', 'Section', 'Subject', 'Faculty', 'Room'].map((x) => <th key={x} className="p-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{slots.map((s) => <tr key={s.id} className="text-slate-700 hover:bg-slate-50/70 transition"><td className="p-3">{days[s.dayOfWeek - 1]} · P{s.periodNumber} · {s.startTime}–{s.endTime}</td><td className="p-3">{s.section.name}</td><td className="p-3 font-medium text-slate-900">{s.subject.code || s.subject.name}</td><td className="p-3">{s.faculty.firstName} {s.faculty.lastName}</td><td className="p-3">{s.roomNumber || '—'}</td></tr>)}{!slots.length && <tr><td colSpan={5} className="p-5 text-center text-slate-500">No classes scheduled yet. Add one here or import a timetable above.</td></tr>}</tbody></table></div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">{heading('Academic calendar')}<form className="grid gap-3" onSubmit={(e) => save(e, '/calendar/events', { ...eventForm, sectionId: eventForm.sectionId || null }, () => setEventForm({ type: 'HOLIDAY', title: '', description: '', startDate: dateToday(), endDate: dateToday(), sectionId: '' }))}>
        <div className="grid gap-3 sm:grid-cols-2"><select className={field} value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}>{['HOLIDAY', 'EXAM', 'EVENT', 'ASSESSMENT_WINDOW'].map((x) => <option key={x}>{x}</option>)}</select><input required placeholder="Title" className={field} value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><input required type="date" className={field} value={eventForm.startDate} onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })} /><input required type="date" className={field} value={eventForm.endDate} onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })} /></div>
        <select className={field} value={eventForm.sectionId} onChange={(e) => setEventForm({ ...eventForm, sectionId: e.target.value })}><option value="">All institution</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <textarea placeholder="Description (optional)" className={field} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /><button disabled={busy} className={action}>Add calendar event</button>
      </form><div className="space-y-2">{events.map((x) => <p key={x.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{x.type} · {x.title} · {new Date(x.startDate).toLocaleDateString()}–{new Date(x.endDate).toLocaleDateString()}{x.section ? ` · ${x.section.name}` : ' · Institution-wide'}</p>)}</div></div>
      <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">{heading('Dated substitutions and cancellations')}<form className="grid gap-3" onSubmit={(e) => save(e, `/calendar/timetable/${override.slotId}/overrides`, { date: override.date, type: override.type, substituteFacultyId: override.type === 'SUBSTITUTE' ? override.substituteFacultyId : null, substituteRoom: override.substituteRoom || null, note: override.note || null }, () => setOverride({ slotId: '', date: dateToday(), type: 'CANCELLED', substituteFacultyId: '', substituteRoom: '', note: '' }))}>
        {select('Class', override.slotId, slots.map((s) => ({ id: s.id, name: `${s.subject.code || s.subject.name} · ${s.section.name} · ${days[s.dayOfWeek - 1]}` })), (slotId) => setOverride({ ...override, slotId }))}
        <div className="grid gap-3 sm:grid-cols-2"><input required type="date" className={field} value={override.date} onChange={(e) => setOverride({ ...override, date: e.target.value })} /><select className={field} value={override.type} onChange={(e) => setOverride({ ...override, type: e.target.value })}><option value="CANCELLED">Cancelled</option><option value="SUBSTITUTE">Substitute</option></select></div>
        {override.type === 'SUBSTITUTE' && select('Substitute faculty', override.substituteFacultyId, faculty, (substituteFacultyId) => setOverride({ ...override, substituteFacultyId }), true)}
        <input placeholder="Updated room (optional)" className={field} value={override.substituteRoom} onChange={(e) => setOverride({ ...override, substituteRoom: e.target.value })} /><textarea placeholder="Note for students and faculty" className={field} value={override.note} onChange={(e) => setOverride({ ...override, note: e.target.value })} />
        <button disabled={busy || !override.slotId || (override.type === 'SUBSTITUTE' && !override.substituteFacultyId)} className={action}>Save override and notify</button>
      </form></div>
    </section>
  </div>;
}
