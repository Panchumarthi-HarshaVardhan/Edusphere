import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, RefreshCw, Upload, Plus, Pencil, Trash2, KeyRound, ArrowUpRight } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

type Entity = 'departments' | 'programs' | 'academic-years' | 'semesters' | 'sections' | 'subjects';
type Item = Record<string, any> & { id: string };
const entities: Entity[] = ['departments', 'programs', 'academic-years', 'semesters', 'sections', 'subjects'];
const labels: Record<Entity, string> = { departments: 'Departments', programs: 'Programs / Classes', 'academic-years': 'Academic years', semesters: 'Semesters / Terms', sections: 'Sections', subjects: 'Subjects' };
const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition';
const buttonClass = 'rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 transition cursor-pointer shadow-xs';

export function AdminSetupPanel() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'hierarchy' | 'users' | 'assignments' | 'import' | 'institutions'>('hierarchy');
  const [mode, setMode] = useState<'university' | 'school'>('university');
  const [entity, setEntity] = useState<Entity>('departments');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [programs, setPrograms] = useState<Item[]>([]);
  const [years, setYears] = useState<Item[]>([]);
  const [semesters, setSemesters] = useState<Item[]>([]);
  const [sections, setSections] = useState<Item[]>([]);
  const [subjects, setSubjects] = useState<Item[]>([]);
  const [users, setUsers] = useState<Item[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [assignments, setAssignments] = useState<Item[]>([]);
  const [assignment, setAssignment] = useState({ facultyId: '', subjectId: '', sectionId: '' });
  const [enrollment, setEnrollment] = useState({ studentId: '', sectionId: '', rollNumber: '' });
  const [promotion, setPromotion] = useState({ sectionId: '', targetSectionId: '' });
  const [createUser, setCreateUser] = useState({ email: '', firstName: '', lastName: '', role: 'STUDENT', departmentId: '', sectionId: '', rollNumber: '' });
  const [userResult, setUserResult] = useState('');
  const [importRole, setImportRole] = useState<'students' | 'faculty'>('students');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [institution, setInstitution] = useState({ name: '', code: '', domain: '', adminEmail: '', adminFirst: '', adminLast: '' });

  const visibleEntities = useMemo(() => mode === 'school' ? ['departments', 'programs', 'academic-years', 'semesters', 'sections'] as Entity[] : entities, [mode]);
  const loadReferences = useCallback(async () => {
    const fetchAll = async (name: Entity) => (await api.get(`/admin/setup/${name}`, { params: { limit: 100 } })).data.items as Item[];
    const [d, p, y, s, sec, sub] = await Promise.all(entities.map(fetchAll));
    setDepartments(d); setPrograms(p); setYears(y); setSemesters(s); setSections(sec); setSubjects(sub);
  }, []);
  const loadEntity = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.get(`/admin/setup/${entity}`, { params: { search, limit: 25, offset: page * 25 } });
      setRows(result.data.items); setTotal(result.data.total);
    } catch (error: any) { setMessage(error.response?.data?.message || 'Could not load records'); }
    finally { setBusy(false); }
  }, [entity, page, search]);
  const loadUsers = useCallback(async () => {
    const result = await api.get('/admin/users', { params: { search: userSearch || undefined, role: userRole || undefined, limit: 25, offset: userPage * 25 } });
    setUsers(result.data.users); setUserTotal(result.data.total);
  }, [userPage, userRole, userSearch]);
  useEffect(() => { loadEntity(); }, [loadEntity]);
  useEffect(() => { loadReferences().catch(() => undefined); }, [loadReferences]);
  useEffect(() => { if (tab === 'users' || tab === 'assignments') loadUsers().catch(() => undefined); }, [tab, loadUsers]);
  useEffect(() => { if (tab === 'assignments') api.get('/admin/faculty-assignments').then((r) => setAssignments(r.data.assignments)).catch(() => undefined); }, [tab]);

  const field = (key: string, label: string, required = true, type = 'text', options?: Item[]) => (
    <label key={key} className="grid gap-1 text-xs text-slate-600 font-medium">{label}
      {options ? <select required={required} className={inputClass} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
        <option value="">Choose {label.toLowerCase()}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name || option.code || option.email}</option>)}
      </select> : <input required={required} type={type} className={inputClass} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
    </label>
  );
  const fields: Record<Entity, React.ReactNode[]> = {
    departments: [field('name', mode === 'school' ? 'School group / Department' : 'Department name'), field('code', 'Code')],
    programs: [field('name', mode === 'school' ? 'Class / Grade name' : 'Program name'), field('code', 'Code'), field('departmentId', mode === 'school' ? 'School group' : 'Department', true, 'text', departments)],
    'academic-years': [field('name', 'Academic year'), field('startDate', 'Start date', true, 'date'), field('endDate', 'End date', true, 'date'), <label key="isCurrent" className="flex items-center gap-2 text-xs text-slate-600 font-medium"><input type="checkbox" checked={form.isCurrent === 'true'} onChange={(e) => setForm({ ...form, isCurrent: String(e.target.checked) })} />Current academic year</label>],
    semesters: [field('name', mode === 'school' ? 'Term name' : 'Semester name'), field('semesterNumber', mode === 'school' ? 'Term number' : 'Semester number', true, 'number'), field('startDate', 'Start date', true, 'date'), field('endDate', 'End date', true, 'date'), field('academicYearId', 'Academic year', true, 'text', years), field('programId', mode === 'school' ? 'Class / Grade' : 'Program', true, 'text', programs)],
    sections: [field('name', 'Section name'), field('semesterId', mode === 'school' ? 'Term' : 'Semester', true, 'text', semesters)],
    subjects: [field('name', 'Subject name'), field('code', 'Subject code'), field('credits', 'Credits', false, 'number'), field('semesterId', 'Semester', true, 'text', semesters)],
  };
  const submitEntity = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    const payload: Record<string, unknown> = { ...form };
    if (entity === 'academic-years' || entity === 'semesters') {
      payload.startDate = new Date(`${form.startDate}T00:00:00`).toISOString(); payload.endDate = new Date(`${form.endDate}T00:00:00`).toISOString();
    }
    if (entity === 'academic-years') payload.isCurrent = form.isCurrent === 'true';
    if (entity === 'semesters') payload.semesterNumber = Number(form.semesterNumber);
    if (entity === 'subjects' && form.credits) payload.credits = Number(form.credits);
    try {
      if (editingId) await api.put(`/admin/setup/${entity}/${editingId}`, payload);
      else await api.post(`/admin/setup/${entity}`, payload);
      setForm({}); setEditingId(''); setMessage('Saved and recorded in the audit log.'); await Promise.all([loadEntity(), loadReferences()]);
    } catch (error: any) { setMessage(error.response?.data?.message || 'Save failed. Check required fields and references.'); }
    finally { setBusy(false); }
  };
  const removeEntity = async (id: string) => {
    try { await api.delete(`/admin/setup/${entity}/${id}`); setMessage('Record deleted and audited.'); await Promise.all([loadEntity(), loadReferences()]); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Cannot delete this record while it is in use.'); }
  };
  const editEntity = (item: Item) => {
    const next: Record<string, string> = {};
    Object.entries(item).forEach(([key, value]) => {
      if (value && typeof value === 'object') return;
      next[key] = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
    });
    if (entity === 'academic-years' || entity === 'semesters') {
      next.startDate = new Date(item.startDate).toISOString().slice(0, 10); next.endDate = new Date(item.endDate).toISOString().slice(0, 10);
    }
    setEditingId(item.id); setForm(next);
  };

  const createUserSubmit = async (event: FormEvent) => {
    event.preventDefault(); setUserResult('');
    try {
      const result = await api.post('/admin/users', { ...createUser, departmentId: createUser.departmentId || undefined, sectionId: createUser.sectionId || undefined, rollNumber: createUser.rollNumber || undefined });
      setUserResult(`Temporary password for ${result.data.user.email}: ${result.data.temporaryPassword}`);
      setCreateUser({ email: '', firstName: '', lastName: '', role: 'STUDENT', departmentId: '', sectionId: '', rollNumber: '' }); await loadUsers();
    } catch (error: any) { setUserResult(error.response?.data?.message || 'Could not create user'); }
  };
  const resetPassword = async (id: string) => {
    try { const result = await api.post(`/admin/users/${id}/reset-password`); setUserResult(`Temporary password (shown once): ${result.data.temporaryPassword}`); }
    catch (error: any) { setUserResult(error.response?.data?.message || 'Password reset failed'); }
  };
  const toggleUser = async (item: Item) => {
    await api.patch(`/admin/users/${item.id}/status`, { isActive: !item.isActive }); await loadUsers();
  };
  const downloadTemplate = async () => {
    const { data } = await api.get(`/admin/users/import/${importRole}/template`, { responseType: 'blob' });
    const url = URL.createObjectURL(data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `edusphere-${importRole}-template.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const doImport = async (event: FormEvent) => {
    event.preventDefault(); if (!importFile) return;
    const body = new FormData(); body.append('file', importFile);
    try { const result = await api.post(`/admin/users/import/${importRole}`, body, { headers: { 'Content-Type': 'multipart/form-data' } }); setImportResults(result.data.results); setMessage(`Imported ${result.data.imported}; rows needing attention ${result.data.failed}.`); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Import failed'); }
  };
  const createInstitution = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await api.post('/admin/institutions', { name: institution.name, code: institution.code, domain: institution.domain || undefined, admin: { email: institution.adminEmail, firstName: institution.adminFirst, lastName: institution.adminLast } });
      setUserResult(`First admin: ${result.data.admin.email}. Temporary password (shown once): ${result.data.temporaryPassword}`);
    } catch (error: any) { setUserResult(error.response?.data?.message || 'Institution setup failed'); }
  };
  const promotionSource = sections.find((section) => section.id === promotion.sectionId);
  const promotionTargets = promotionSource
    ? sections.filter((section) =>
        section.semester?.programId === promotionSource.semester?.programId &&
        new Date(section.semester?.academicYear?.startDate).getTime() > new Date(promotionSource.semester?.academicYear?.startDate).getTime()
      )
    : [];
  const pages = Math.max(1, Math.ceil((tab === 'users' ? userTotal : total) / 25));

  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">
      {(['hierarchy', 'users', 'assignments', 'import', ...(isSuperAdmin ? ['institutions'] : [])] as Array<typeof tab>).map((item) => (
        <button
          key={item}
          onClick={() => setTab(item)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition cursor-pointer ${
            tab === item
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {item === 'hierarchy' ? 'Academic structure' : item}
        </button>
      ))}
    </div>
    {message && <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 font-medium">{message}</div>}
    {tab === 'hierarchy' && <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
      <form onSubmit={submitEntity} className="h-fit space-y-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div><h2 className="font-semibold text-slate-900">{editingId ? 'Edit' : 'Add'} academic record</h2><p className="mt-1 text-xs text-slate-500">University uses department → program → year → semester → section. School mode maps class/grade to Program and term to Semester.</p></div>
        <select className={inputClass} value={mode} onChange={(e) => { setMode(e.target.value as typeof mode); setEntity(e.target.value === 'school' ? 'programs' : 'departments'); setForm({}); setEditingId(''); }}><option value="university">University hierarchy</option><option value="school">School hierarchy</option></select>
        <select className={inputClass} value={entity} onChange={(e) => { setEntity(e.target.value as Entity); setForm({}); setEditingId(''); }}>
          {visibleEntities.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
        </select>
        {fields[entity]}
        <div className="flex gap-2"><button className={buttonClass} disabled={busy}>{editingId ? 'Save changes' : 'Create'}</button>{editingId && <button type="button" className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs text-slate-700 cursor-pointer" onClick={() => { setEditingId(''); setForm({}); }}>Cancel</button>}</div>
      </form>
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{labels[entity]}</h2><p className="text-xs text-slate-500">{total} records in this institution</p></div><div className="flex gap-2"><input className={inputClass + ' min-w-44'} placeholder="Search name or code" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /><button onClick={() => { loadEntity(); loadReferences(); }} className="rounded-lg bg-slate-100 hover:bg-slate-200 p-2 text-slate-700 cursor-pointer" aria-label="Refresh"><RefreshCw size={16} /></button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[11px] uppercase text-slate-500 font-mono bg-slate-50 border-b border-slate-200"><tr><th className="py-2.5 px-3">Name</th><th className="py-2.5 px-3">Code / Parent</th><th className="py-2.5 px-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.id} className="hover:bg-slate-50/70 transition"><td className="py-2.5 px-3 font-medium text-slate-900">{item.name || item.semester?.name}{item.isCurrent ? ' · Current' : ''}</td><td className="text-xs text-slate-500">{item.code || item.department?.name || item.program?.name || item.academicYear?.name || item.semester?.name || item.startDate?.slice?.(0, 10) || '—'}</td><td className="text-right px-3"><button onClick={() => editEntity(item)} className="p-1.5 text-indigo-700 hover:text-indigo-900" aria-label="Edit"><Pencil size={15} /></button><button onClick={() => removeEntity(item.id)} className="p-1.5 text-rose-600 hover:text-rose-800" aria-label="Delete"><Trash2 size={15} /></button></td></tr>)}{!rows.length && <tr><td colSpan={3} className="py-10 text-center text-slate-500">{busy ? 'Loading…' : 'No records yet'}</td></tr>}</tbody></table></div>
        <Pager page={page} pages={pages} setPage={setPage} />
      </div>
    </div>}
    {tab === 'users' && <div className="space-y-4">
      <form onSubmit={createUserSubmit} className="grid gap-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs md:grid-cols-4"><div className="md:col-span-4"><h2 className="font-semibold text-slate-900">Create a user</h2><p className="text-xs text-slate-500">A temporary password is generated and first-login reset is required.</p></div>
        <input className={inputClass} type="email" required placeholder="Email" value={createUser.email} onChange={(e) => setCreateUser({ ...createUser, email: e.target.value })} />
        <input className={inputClass} required placeholder="First name" value={createUser.firstName} onChange={(e) => setCreateUser({ ...createUser, firstName: e.target.value })} />
        <input className={inputClass} required placeholder="Last name" value={createUser.lastName} onChange={(e) => setCreateUser({ ...createUser, lastName: e.target.value })} />
        <select className={inputClass} value={createUser.role} onChange={(e) => setCreateUser({ ...createUser, role: e.target.value })}><option>STUDENT</option><option>FACULTY</option><option>HOD</option><option>CLASS_INCHARGE</option><option>ADMIN</option></select>
        {createUser.role === 'STUDENT' && <><select className={inputClass} required value={createUser.sectionId} onChange={(e) => setCreateUser({ ...createUser, sectionId: e.target.value })}><option value="">Section</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.semester?.program?.name || ''}</option>)}</select><input className={inputClass} required placeholder="Roll number" value={createUser.rollNumber} onChange={(e) => setCreateUser({ ...createUser, rollNumber: e.target.value })} /></>}
        {['FACULTY', 'HOD', 'CLASS_INCHARGE'].includes(createUser.role) && <select className={inputClass} value={createUser.departmentId} onChange={(e) => setCreateUser({ ...createUser, departmentId: e.target.value })}><option value="">Department (optional)</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
        <button className={buttonClass}><Plus size={14} className="mr-1 inline" />Create user</button>
      </form>
      {userResult && <div className="break-all rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-mono">{userResult}</div>}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"><div className="mb-4 flex flex-wrap gap-2"><input className={inputClass + ' max-w-sm'} placeholder="Search users" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }} /><select className={inputClass + ' max-w-48'} value={userRole} onChange={(e) => { setUserRole(e.target.value); setUserPage(0); }}><option value="">All roles</option>{['ADMIN', 'HOD', 'CLASS_INCHARGE', 'FACULTY', 'STUDENT'].map((role) => <option key={role}>{role}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[11px] uppercase text-slate-500 font-mono bg-slate-50 border-b border-slate-200"><tr><th className="py-2.5 px-3">User</th><th className="py-2.5 px-3">Role</th><th className="py-2.5 px-3">Status / reset</th><th className="text-right py-2.5 px-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((item) => <tr key={item.id} className="hover:bg-slate-50/70 transition"><td className="py-2.5 px-3 font-medium text-slate-900">{item.firstName} {item.lastName}<div className="text-[11px] text-slate-400 font-mono">{item.email}</div></td><td className="text-xs text-slate-700 px-3">{item.role}</td><td className="text-xs text-slate-700 px-3">{item.isActive ? 'Active' : 'Inactive'}{item.mustResetPassword ? ' · reset required' : ''}</td><td className="space-x-2 text-right px-3"><button onClick={() => resetPassword(item.id)} title="Reset password" className="rounded-md bg-slate-100 hover:bg-slate-200 p-1.5 text-amber-600 cursor-pointer"><KeyRound size={15} /></button><button onClick={() => toggleUser(item)} className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs text-slate-700 cursor-pointer">{item.isActive ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div><Pager page={userPage} pages={Math.max(1, Math.ceil(userTotal / 25))} setPage={setUserPage} /></div>
    </div>}
    {tab === 'assignments' && <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"><h2 className="font-semibold text-slate-900">Faculty assignment</h2><form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api.post('/admin/faculty-assignments', assignment); setMessage('Faculty assigned to this subject and section.'); setAssignments((await api.get('/admin/faculty-assignments')).data.assignments); } catch (error: any) { setMessage(error.response?.data?.message || 'Assignment failed'); } }}>
        <select required className={inputClass} value={assignment.facultyId} onChange={(e) => setAssignment({ ...assignment, facultyId: e.target.value })}><option value="">Choose faculty</option>{users.filter((u) => ['FACULTY', 'CLASS_INCHARGE'].includes(u.role)).map((u) => <option value={u.id} key={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}</select>
        <select required className={inputClass} value={assignment.subjectId} onChange={(e) => setAssignment({ ...assignment, subjectId: e.target.value })}><option value="">Choose subject</option>{subjects.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.code}</option>)}</select>
        <select required className={inputClass} value={assignment.sectionId} onChange={(e) => setAssignment({ ...assignment, sectionId: e.target.value })}><option value="">Choose section</option>{sections.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.semester?.program?.name}</option>)}</select><button className={buttonClass}>Assign faculty</button></form>
        <div className="max-h-64 space-y-2 overflow-auto">{assignments.map((a) => <div key={a.id} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700">{a.faculty.firstName} {a.faculty.lastName} → {a.subject.name} · {a.section.name}</div>)}</div>
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"><h2 className="font-semibold text-slate-900">Enroll and promote students</h2><form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api.post('/admin/student-enrollments', enrollment); setMessage('Student enrolled in section.'); } catch (error: any) { setMessage(error.response?.data?.message || 'Enrollment failed'); } }}><select required className={inputClass} value={enrollment.studentId} onChange={(e) => setEnrollment({ ...enrollment, studentId: e.target.value })}><option value="">Choose student</option>{users.filter((u) => u.role === 'STUDENT').map((u) => <option value={u.id} key={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}</select><select required className={inputClass} value={enrollment.sectionId} onChange={(e) => setEnrollment({ ...enrollment, sectionId: e.target.value })}><option value="">Choose section</option>{sections.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select><input className={inputClass} required placeholder="Roll number" value={enrollment.rollNumber} onChange={(e) => setEnrollment({ ...enrollment, rollNumber: e.target.value })} /><button className={buttonClass}>Enroll student</button></form>
        <form className="grid gap-3 border-t border-slate-100 pt-4" onSubmit={async (e) => { e.preventDefault(); try { const result = await api.post(`/admin/sections/${promotion.sectionId}/promote`, { targetSectionId: promotion.targetSectionId }); setMessage(`Promoted ${result.data.promotedCount} students to the next year.`); } catch (error: any) { setMessage(error.response?.data?.message || 'Promotion failed'); } }}><p className="text-xs font-semibold text-slate-900">Promote active enrollments</p><select required className={inputClass} value={promotion.sectionId} onChange={(e) => setPromotion({ sectionId: e.target.value, targetSectionId: '' })}><option value="">Current section</option>{sections.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.semester?.academicYear?.name}</option>)}</select><select required disabled={!promotionSource || promotionTargets.length === 0} className={inputClass} value={promotion.targetSectionId} onChange={(e) => setPromotion({ ...promotion, targetSectionId: e.target.value })}><option value="">Next-year section</option>{promotionTargets.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.semester?.academicYear?.name}</option>)}</select>{promotionSource && promotionTargets.length === 0 && <p className="text-xs text-amber-700">Create a section in a later academic year for this program before promoting students.</p>}<button disabled={!promotion.sectionId || !promotion.targetSectionId} className={buttonClass}><ArrowUpRight size={14} className="mr-1 inline" />Promote section</button></form>
      </div>
    </div>}
    {tab === 'import' && <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"><div><h2 className="font-semibold text-slate-900">Bulk import</h2><p className="text-xs text-slate-500">CSV and XLSX are accepted. Valid rows import independently; invalid rows appear below.</p></div><form className="flex flex-wrap items-center gap-3" onSubmit={doImport}><select className={inputClass + ' max-w-48'} value={importRole} onChange={(e) => setImportRole(e.target.value as typeof importRole)}><option value="students">Students</option><option value="faculty">Faculty</option></select><input required type="file" accept=".csv,.xlsx" className="text-xs text-slate-600" onChange={(e) => setImportFile(e.target.files?.[0] || null)} /><button type="button" onClick={downloadTemplate} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={14} className="mr-1 inline" />Download template</button><button className={buttonClass}><Upload size={14} className="mr-1 inline" />Import rows</button></form>
      {!!importResults.length && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[11px] uppercase text-slate-500 font-mono bg-slate-50 border-b border-slate-200"><tr><th className="py-2 px-3">Row</th><th className="px-3">Email</th><th className="px-3">Result / errors</th><th className="px-3">Temporary password</th></tr></thead><tbody className="divide-y divide-slate-100">{importResults.map((result, index) => <tr key={`${result.rowNumber}-${index}`}><td className="py-2 px-3 font-mono">{result.rowNumber}</td><td className="px-3 font-mono">{result.email || '—'}</td><td className={`px-3 ${result.status === 'error' ? 'text-rose-600' : 'text-emerald-700 font-medium'}`}>{result.errors?.join('; ') || 'Imported'}</td><td className="font-mono text-xs px-3">{result.temporaryPassword || '—'}</td></tr>)}</tbody></table></div>}
    </div>}
    {tab === 'institutions' && isSuperAdmin && <div className="max-w-3xl rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"><h2 className="mb-1 font-semibold text-slate-900">Provision institution and first admin</h2><p className="mb-4 text-xs text-slate-500">The first admin receives a one-time temporary password and must reset it at first login.</p><form className="grid gap-3 md:grid-cols-2" onSubmit={createInstitution}><input className={inputClass} required placeholder="Institution name" value={institution.name} onChange={(e) => setInstitution({ ...institution, name: e.target.value })} /><input className={inputClass} required placeholder="Institution code" value={institution.code} onChange={(e) => setInstitution({ ...institution, code: e.target.value })} /><input className={inputClass} placeholder="Domain (optional)" value={institution.domain} onChange={(e) => setInstitution({ ...institution, domain: e.target.value })} /><input className={inputClass} type="email" required placeholder="First admin email" value={institution.adminEmail} onChange={(e) => setInstitution({ ...institution, adminEmail: e.target.value })} /><input className={inputClass} required placeholder="Admin first name" value={institution.adminFirst} onChange={(e) => setInstitution({ ...institution, adminFirst: e.target.value })} /><input className={inputClass} required placeholder="Admin last name" value={institution.adminLast} onChange={(e) => setInstitution({ ...institution, adminLast: e.target.value })} /><button className={buttonClass}>Create institution</button></form>{userResult && <p className="mt-4 break-all rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-mono">{userResult}</p>}</div>}
  </section>;
}

function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) {
  return <div className="mt-4 flex items-center justify-end gap-3 text-xs text-slate-500"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 disabled:opacity-40 cursor-pointer">Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 disabled:opacity-40 cursor-pointer">Next</button></div>;
}
