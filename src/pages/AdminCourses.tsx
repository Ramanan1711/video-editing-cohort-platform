import { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronDown, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/useAuth';
import { createCohort, createLesson, createModule, deleteCohort, deleteLesson, deleteModule, listCohorts, listModules, type Cohort, type Lesson, type Module, updateCohort, updateLesson, updateModule } from '../lib/courseService';

type EditorState = { type: 'cohort' | 'module' | 'lesson'; id?: string; parentId?: string; name: string; description: string; videoUrl: string; duration: string; position: string };
const blankEditor: EditorState = { type: 'cohort', name: '', description: '', videoUrl: '', duration: '', position: '1' };

export function AdminCourses() {
  const { profile } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const [nextCohorts, nextModules] = await Promise.all([listCohorts(), listModules()]); setCohorts(nextCohorts); setModules(nextModules); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load courses.'); } finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    Promise.all([listCohorts(), listModules()]).then(([nextCohorts, nextModules]) => {
      if (!active) return;
      setCohorts(nextCohorts);
      setModules(nextModules);
    }).catch((loadError: unknown) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load courses.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setError(null);
    try {
      if (editor.type === 'cohort') {
        if (editor.id) await updateCohort(editor.id, { name: editor.name, description: editor.description || null });
        else await createCohort({ name: editor.name, description: editor.description || null });
      }
      if (editor.type === 'module') {
        if (editor.id) await updateModule(editor.id, { title: editor.name, description: editor.description || null, position: Number(editor.position) });
        else await createModule({ cohort_id: editor.parentId ?? '', title: editor.name, description: editor.description || null, position: Number(editor.position) });
      }
      if (editor.type === 'lesson') {
        if (editor.id) await updateLesson(editor.id, { title: editor.name, description: editor.description || null, video_url: editor.videoUrl || null, duration_minutes: editor.duration ? Number(editor.duration) : null, position: Number(editor.position) });
        else await createLesson({ module_id: editor.parentId ?? '', title: editor.name, description: editor.description || null, video_url: editor.videoUrl || null, duration_minutes: editor.duration ? Number(editor.duration) : null, position: Number(editor.position) });
      }
      setEditor(null); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save this item.'); } finally { setSaving(false); }
  };

  const remove = async (type: EditorState['type'], id: string) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try { if (type === 'cohort') await deleteCohort(id); if (type === 'module') await deleteModule(id); if (type === 'lesson') await deleteLesson(id); await load(); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this item.'); }
  };
  if (profile?.role !== 'admin') return <div className="min-h-screen bg-[#f6f7f9] p-8 text-center text-slate-600">Admin access required.</div>;

  return <div className="min-h-screen bg-[#f6f7f9] text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Admin studio</p><h1 className="mt-1 text-2xl font-black text-slate-950">Course content</h1></div><Button onClick={() => setEditor({ ...blankEditor })}><Plus size={17} /> New cohort</Button></div></header><main className="mx-auto max-w-6xl px-5 py-8 lg:px-8"><div className="mb-7 flex items-center justify-between"><div><p className="text-sm text-slate-500">Manage the learning path students see in their dashboard.</p></div>{loading && <LoaderCircle className="animate-spin text-orange-500" size={20} />}</div>{error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<div className="space-y-4">{cohorts.map((cohort) => { const cohortModules = modules.filter((module) => module.cohort_id === cohort.id); return <Card key={cohort.id} className="overflow-hidden"><div className="flex items-center justify-between gap-4 p-5"><button onClick={() => setExpanded(expanded === cohort.id ? null : cohort.id)} className="flex min-w-0 items-center gap-3 text-left"><ChevronDown className={`shrink-0 text-slate-400 transition ${expanded === cohort.id ? 'rotate-180' : ''}`} size={18} /><span><strong className="block truncate text-base text-slate-950">{cohort.name}</strong><span className="text-sm text-slate-500">{cohort.description || 'No description'} · {cohortModules.length} modules</span></span></button><div className="flex shrink-0 gap-1"><button onClick={() => setEditor({ ...blankEditor, type: 'cohort', id: cohort.id, name: cohort.name, description: cohort.description ?? '' })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950" aria-label="Edit cohort"><Pencil size={16} /></button><button onClick={() => void remove('cohort', cohort.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete cohort"><Trash2 size={16} /></button></div></div>{expanded === cohort.id && <div className="border-t border-slate-100 bg-slate-50/70 p-5"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Modules</p><Button variant="secondary" onClick={() => setEditor({ ...blankEditor, type: 'module', parentId: cohort.id })}><Plus size={15} /> Add module</Button></div>{cohortModules.length ? <div className="space-y-3">{cohortModules.map((module) => <div key={module.id} className="rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-4"><span className="flex items-center gap-3"><BookOpen className="text-orange-500" size={18} /><span><strong className="block text-sm text-slate-950">{module.position}. {module.title}</strong><span className="text-xs text-slate-400">{module.lessons.length} lessons</span></span></span><div className="flex gap-1"><button onClick={() => setEditor({ ...blankEditor, type: 'module', id: module.id, parentId: cohort.id, name: module.title, description: module.description ?? '', position: String(module.position) })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Edit module"><Pencil size={15} /></button><button onClick={() => void remove('module', module.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete module"><Trash2 size={15} /></button></div></div><div className="border-t border-slate-100 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Lessons</span><button onClick={() => setEditor({ ...blankEditor, type: 'lesson', parentId: module.id })} className="flex items-center gap-1 text-xs font-bold text-orange-600"><Plus size={14} /> Add lesson</button></div>{module.lessons.length ? module.lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} onEdit={() => setEditor({ ...blankEditor, type: 'lesson', id: lesson.id, parentId: module.id, name: lesson.title, description: lesson.description ?? '', videoUrl: lesson.video_url ?? '', duration: lesson.duration_minutes ? String(lesson.duration_minutes) : '', position: String(lesson.position) })} onDelete={() => void remove('lesson', lesson.id)} />) : <p className="text-xs text-slate-400">No lessons yet.</p>}</div></div>)}</div> : <p className="text-sm text-slate-400">No modules yet. Add the first one to start building this course.</p>}</div>}</Card>; })}{!loading && !cohorts.length && <Card className="p-10 text-center"><p className="text-sm text-slate-500">No cohorts found. Create one to start building your course.</p></Card>}</div></main>{editor && <EditorModal editor={editor} saving={saving} onChange={setEditor} onClose={() => setEditor(null)} onSubmit={submit} />}</div>;
}

function LessonRow({ lesson, onEdit, onDelete }: { lesson: Lesson; onEdit: () => void; onDelete: () => void }) { return <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5"><span className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><Check className="shrink-0 text-slate-300" size={15} /><span className="truncate">{lesson.position}. {lesson.title}</span>{lesson.video_url && <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">VIDEO</span>}</span><span className="flex shrink-0 gap-1"><button onClick={onEdit} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label={`Edit ${lesson.title}`}><Pencil size={14} /></button><button onClick={onDelete} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${lesson.title}`}><Trash2 size={14} /></button></span></div>; }

function EditorModal({ editor, saving, onChange, onClose, onSubmit }: { editor: EditorState; saving: boolean; onChange: (editor: EditorState) => void; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-5"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-orange-500">{editor.id ? 'Edit' : 'New'} {editor.type}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{editor.type === 'cohort' ? 'Cohort details' : editor.type === 'module' ? 'Module details' : 'Lesson details'}</h2></div><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-950" aria-label="Close editor">×</button></div><div className="space-y-4"><Field label={editor.type === 'lesson' ? 'Lesson title' : 'Name'} value={editor.name} onChange={(name) => onChange({ ...editor, name })} required /><Field label="Description" value={editor.description} onChange={(description) => onChange({ ...editor, description })} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Position" type="number" min="1" value={editor.position} onChange={(position) => onChange({ ...editor, position })} required />{editor.type === 'lesson' && <Field label="Duration (minutes)" type="number" min="1" value={editor.duration} onChange={(duration) => onChange({ ...editor, duration })} />}</div>{editor.type === 'lesson' && <Field label="Video URL" type="url" value={editor.videoUrl} onChange={(videoUrl) => onChange({ ...editor, videoUrl })} placeholder="https://..." />}</div><div className="mt-7 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>{saving ? 'Saving' : 'Save changes'}</Button></div></form></div>; }
function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; required?: boolean; placeholder?: string }) { return <label className="block text-left"><span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span><input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" /></label>; }