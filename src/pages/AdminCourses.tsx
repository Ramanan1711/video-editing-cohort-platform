import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/useAuth';
import {
  bulkUpdateLessonStatus,
  createAssignment,
  createCohort,
  createLesson,
  createLessonResource,
  createModule,
  deleteAssignment,
  deleteCohort,
  deleteLesson,
  deleteLessonResource,
  deleteModule,
  detectResourceType,
  duplicateLesson,
  duplicateModule,
  formatFileSize,
  listAllAssignments,
  listAllLessonResources,
  listCohorts,
  listModules,
  reorderLesson,
  reorderModule,
  type Assignment,
  type Cohort,
  type Lesson,
  type LessonResource,
  type Module,
  type ResourceType,
  type VisibilityRule,
  updateAssignment,
  updateCohort,
  updateLesson,
  updateLessonResource,
  updateLessonStatus,
  updateModule,
  uploadCourseAsset,
} from '../lib/courseService';

type EditorModalType = 'cohort' | 'module' | 'lesson' | 'assignment' | 'resource';

interface CohortEditorState {
  type: 'cohort';
  id?: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  capacity: string;
  visibility: 'public' | 'private' | 'unlisted';
  enrollmentStart: string;
  enrollmentEnd: string;
}

interface ModuleEditorState {
  type: 'module';
  id?: string;
  cohortId: string;
  title: string;
  description: string;
  position: number;
}

interface LessonEditorState {
  type: 'lesson';
  id?: string;
  moduleId: string;
  title: string;
  description: string;
  videoUrl: string;
  durationMinutes: string;
  position: number;
  status: 'draft' | 'published' | 'archived';
}

interface AssignmentEditorState {
  type: 'assignment';
  id?: string;
  lessonId: string;
  title: string;
  instructions: string;
  deadline: string;
}

interface ResourceEditorState {
  type: 'resource';
  id?: string;
  lessonId: string;
  name: string;
  url: string;
  visibility: VisibilityRule;
  resourceType: ResourceType;
  fileSize: number | null;
  sourceMode: 'upload' | 'url';
}

type EditorState =
  | CohortEditorState
  | ModuleEditorState
  | LessonEditorState
  | AssignmentEditorState
  | ResourceEditorState;

export function AdminCourses() {
  const { profile } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resources, setResources] = useState<LessonResource[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Expansion state
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  // Editor Modal state
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cohortsRes, modulesRes, assignmentsRes, resourcesRes] = await Promise.all([
        listCohorts(),
        listModules(),
        listAllAssignments(),
        listAllLessonResources(),
      ]);
      setCohorts(cohortsRes);
      setModules(modulesRes);
      setAssignments(assignmentsRes);
      setResources(resourcesRes);
      if (cohortsRes.length > 0 && !expandedCohortId) {
        setExpandedCohortId(cohortsRes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load course data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      listCohorts(),
      listModules(),
      listAllAssignments(),
      listAllLessonResources(),
    ])
      .then(([cohortsRes, modulesRes, assignmentsRes, resourcesRes]) => {
        if (!active) return;
        setCohorts(cohortsRes);
        setModules(modulesRes);
        setAssignments(assignmentsRes);
        setResources(resourcesRes);
        if (cohortsRes.length > 0) {
          setExpandedCohortId((current) => current || cohortsRes[0].id);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load course data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCohorts = useMemo(() => {
    const term = search.toLowerCase();
    return cohorts.filter(
      (cohort) =>
        cohort.name.toLowerCase().includes(term) ||
        (cohort.description ?? '').toLowerCase().includes(term)
    );
  }, [cohorts, search]);

  const totalLessons = useMemo(
    () => modules.reduce((sum, mod) => sum + mod.lessons.length, 0),
    [modules]
  );

  // Assignment & Resource lookup maps
  const assignmentsByLesson = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.lesson_id) || [];
      list.push(a);
      map.set(a.lesson_id, list);
    }
    return map;
  }, [assignments]);

  const resourcesByLesson = useMemo(() => {
    const map = new Map<string, LessonResource[]>();
    for (const r of resources) {
      const list = map.get(r.lesson_id) || [];
      list.push(r);
      map.set(r.lesson_id, list);
    }
    return map;
  }, [resources]);

  // Open Modal helpers
  const openCohortEditor = (cohort?: Cohort) => {
    setUploadFile(null);
    if (cohort) {
      setEditor({
        type: 'cohort',
        id: cohort.id,
        name: cohort.name,
        description: cohort.description ?? '',
        status: cohort.status ?? 'published',
        capacity: cohort.capacity != null ? String(cohort.capacity) : '30',
        visibility: cohort.visibility ?? 'public',
        enrollmentStart: cohort.enrollment_start ? cohort.enrollment_start.slice(0, 16) : '',
        enrollmentEnd: cohort.enrollment_end ? cohort.enrollment_end.slice(0, 16) : '',
      });
    } else {
      setEditor({
        type: 'cohort',
        name: '',
        description: '',
        status: 'published',
        capacity: '30',
        visibility: 'public',
        enrollmentStart: '',
        enrollmentEnd: '',
      });
    }
  };

  const openModuleEditor = (cohortId: string, mod?: Module) => {
    setUploadFile(null);
    if (mod) {
      setEditor({
        type: 'module',
        id: mod.id,
        cohortId: mod.cohort_id,
        title: mod.title,
        description: mod.description ?? '',
        position: mod.position,
      });
    } else {
      const cohortModules = modules.filter((m) => m.cohort_id === cohortId);
      setEditor({
        type: 'module',
        cohortId,
        title: '',
        description: '',
        position: cohortModules.length + 1,
      });
    }
  };

  const openLessonEditor = (moduleId: string, lesson?: Lesson) => {
    setUploadFile(null);
    if (lesson) {
      setEditor({
        type: 'lesson',
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        description: lesson.description ?? '',
        videoUrl: lesson.video_url ?? '',
        durationMinutes: lesson.duration_minutes ? String(lesson.duration_minutes) : '',
        position: lesson.position,
        status: lesson.status ?? 'published',
      });
    } else {
      const currentModule = modules.find((m) => m.id === moduleId);
      const nextPos = (currentModule?.lessons.length ?? 0) + 1;
      setEditor({
        type: 'lesson',
        moduleId,
        title: '',
        description: '',
        videoUrl: '',
        durationMinutes: '10',
        position: nextPos,
        status: 'published',
      });
    }
  };

  const openAssignmentEditor = (lessonId: string, assignment?: Assignment) => {
    setUploadFile(null);
    if (assignment) {
      // Format deadline for datetime-local input
      let deadlineFormatted = '';
      if (assignment.deadline) {
        const d = new Date(assignment.deadline);
        if (!isNaN(d.getTime())) {
          deadlineFormatted = d.toISOString().slice(0, 16);
        }
      }
      setEditor({
        type: 'assignment',
        id: assignment.id,
        lessonId: assignment.lesson_id,
        title: assignment.title,
        instructions: assignment.instructions ?? '',
        deadline: deadlineFormatted,
      });
    } else {
      // Default deadline: 7 days in future
      const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      setEditor({
        type: 'assignment',
        lessonId,
        title: '',
        instructions: '',
        deadline: defaultDeadline,
      });
    }
  };

  const openResourceEditor = (lessonId: string, resource?: LessonResource) => {
    setUploadFile(null);
    if (resource) {
      setEditor({
        type: 'resource',
        id: resource.id,
        lessonId: resource.lesson_id,
        name: resource.name,
        url: resource.url,
        visibility: resource.visibility ?? 'enrolled',
        resourceType: resource.resource_type ?? detectResourceType(resource.url),
        fileSize: resource.file_size ?? null,
        sourceMode: 'url',
      });
    } else {
      setEditor({
        type: 'resource',
        lessonId,
        name: '',
        url: '',
        visibility: 'enrolled',
        resourceType: 'project_file',
        fileSize: null,
        sourceMode: 'upload',
      });
    }
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editor.type === 'cohort') {
        if (!editor.name.trim()) throw new Error('Cohort name is required.');
        const cohortPayload = {
          name: editor.name.trim(),
          description: editor.description.trim() || null,
          status: editor.status,
          capacity: Number(editor.capacity) || 30,
          visibility: editor.visibility,
          enrollment_start: editor.enrollmentStart ? new Date(editor.enrollmentStart).toISOString() : null,
          enrollment_end: editor.enrollmentEnd ? new Date(editor.enrollmentEnd).toISOString() : null,
        };
        if (editor.id) {
          await updateCohort(editor.id, cohortPayload);
          setSuccess('Cohort updated successfully.');
        } else {
          const created = await createCohort(cohortPayload);
          setExpandedCohortId(created.id);
          setSuccess('Cohort created successfully.');
        }
      } else if (editor.type === 'module') {
        if (!editor.title.trim()) throw new Error('Module title is required.');
        if (editor.id) {
          await updateModule(editor.id, {
            title: editor.title.trim(),
            description: editor.description.trim() || null,
            position: Number(editor.position) || 1,
          });
          setSuccess('Module updated successfully.');
        } else {
          await createModule({
            cohort_id: editor.cohortId,
            title: editor.title.trim(),
            description: editor.description.trim() || null,
            position: Number(editor.position) || 1,
          });
          setSuccess('Module created successfully.');
        }
      } else if (editor.type === 'lesson') {
        if (!editor.title.trim()) throw new Error('Lesson title is required.');
        let finalVideoUrl = editor.videoUrl.trim() || null;

        if (uploadFile) {
          setUploadingStatus(`Uploading ${uploadFile.name}...`);
          finalVideoUrl = await uploadCourseAsset(uploadFile, 'lessons');
          setUploadingStatus(null);
        }

        const payload = {
          title: editor.title.trim(),
          description: editor.description.trim() || null,
          video_url: finalVideoUrl,
          duration_minutes: editor.durationMinutes ? Number(editor.durationMinutes) : null,
          position: Number(editor.position) || 1,
          status: editor.status,
        };

        if (editor.id) {
          await updateLesson(editor.id, payload);
          setSuccess('Lesson updated successfully.');
        } else {
          await createLesson({
            module_id: editor.moduleId,
            ...payload,
          });
          setSuccess('Lesson created successfully.');
        }
      } else if (editor.type === 'assignment') {
        if (!editor.title.trim()) throw new Error('Assignment title is required.');
        const deadlineIso = editor.deadline ? new Date(editor.deadline).toISOString() : null;

        if (editor.id) {
          await updateAssignment(editor.id, {
            title: editor.title.trim(),
            instructions: editor.instructions.trim() || null,
            deadline: deadlineIso,
          });
          setSuccess('Assignment updated successfully.');
        } else {
          await createAssignment({
            lesson_id: editor.lessonId,
            title: editor.title.trim(),
            instructions: editor.instructions.trim() || null,
            deadline: deadlineIso,
          });
          setSuccess('Assignment created successfully.');
        }
      } else if (editor.type === 'resource') {
        let finalUrl = editor.url.trim();
        let resourceType = editor.resourceType;
        let fileSize = editor.fileSize;

        if (editor.sourceMode === 'upload') {
          if (!uploadFile && !editor.id) {
            throw new Error('Please select a file to upload.');
          }
          if (uploadFile) {
            setUploadingStatus(`Uploading ${uploadFile.name}...`);
            finalUrl = await uploadCourseAsset(uploadFile, 'resources');
            fileSize = uploadFile.size;
            resourceType = detectResourceType(uploadFile.name);
            setUploadingStatus(null);
          }
        }

        if (!finalUrl) throw new Error('A resource file or URL is required.');
        const resourceName = editor.name.trim() || (uploadFile ? uploadFile.name : 'Lesson Resource');

        if (editor.id) {
          await updateLessonResource(editor.id, {
            name: resourceName,
            url: finalUrl,
            visibility: editor.visibility,
            resource_type: resourceType,
            file_size: fileSize,
          });
          setSuccess('Resource updated successfully.');
        } else {
          await createLessonResource({
            lesson_id: editor.lessonId,
            name: resourceName,
            url: finalUrl,
            visibility: editor.visibility,
            resource_type: resourceType,
            file_size: fileSize,
          });
          setSuccess('Resource added successfully.');
        }
      }

      setEditor(null);
      setUploadFile(null);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save item.');
    } finally {
      setSaving(false);
      setUploadingStatus(null);
    }
  };

  // Delete Handlers
  const handleDelete = async (type: EditorModalType, id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (type === 'cohort') await deleteCohort(id);
      if (type === 'module') await deleteModule(id);
      if (type === 'lesson') await deleteLesson(id);
      if (type === 'assignment') await deleteAssignment(id);
      if (type === 'resource') await deleteLessonResource(id);

      setSuccess(`Deleted ${type} successfully.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : `Unable to delete this ${type}.`);
    }
  };

  // Reorder Handlers
  const handleReorderModule = async (cohortId: string, currentMod: Module, direction: 'up' | 'down') => {
    const cohortModules = modules
      .filter((m) => m.cohort_id === cohortId)
      .sort((a, b) => a.position - b.position);
    const index = cohortModules.findIndex((m) => m.id === currentMod.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cohortModules.length) return;

    const otherMod = cohortModules[targetIndex];
    try {
      await Promise.all([
        reorderModule(currentMod.id, otherMod.position),
        reorderModule(otherMod.id, currentMod.position),
      ]);
      setSuccess(`Moved module "${currentMod.title}" ${direction}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder module.');
    }
  };

  const handleReorderLesson = async (currentModule: Module, currentLesson: Lesson, direction: 'up' | 'down') => {
    const sortedLessons = [...currentModule.lessons].sort((a, b) => a.position - b.position);
    const index = sortedLessons.findIndex((l) => l.id === currentLesson.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedLessons.length) return;

    const otherLesson = sortedLessons[targetIndex];
    try {
      await Promise.all([
        reorderLesson(currentLesson.id, otherLesson.position),
        reorderLesson(otherLesson.id, currentLesson.position),
      ]);
      setSuccess(`Moved lesson "${currentLesson.title}" ${direction}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder lesson.');
    }
  };

  // Duplication Handlers
  const handleDuplicateLesson = async (lessonId: string, title: string) => {
    try {
      await duplicateLesson(lessonId);
      setSuccess(`Duplicated "${title}". Created copy in draft status.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate lesson.');
    }
  };

  const handleDuplicateModule = async (moduleId: string, title: string) => {
    try {
      await duplicateModule(moduleId);
      setSuccess(`Duplicated module "${title}" and all its lessons.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate module.');
    }
  };

  // Status Handlers
  const handleUpdateLessonStatus = async (lessonId: string, newStatus: 'draft' | 'published' | 'archived') => {
    try {
      await updateLessonStatus(lessonId, newStatus);
      setSuccess(`Lesson status updated to ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lesson status.');
    }
  };

  const handleBulkModulePublish = async (mod: Module, newStatus: 'published' | 'draft') => {
    const ids = mod.lessons.map((l) => l.id);
    if (!ids.length) return;
    try {
      await bulkUpdateLessonStatus(ids, newStatus);
      setSuccess(`All lessons in "${mod.title}" marked as ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk update lesson statuses.');
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
        <Card className="max-w-md p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <Lock size={22} />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950">Admin access required</h2>
          <p className="mt-2 text-sm text-slate-500">You need administrator privileges to author and manage courses.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Admin studio</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Course Authoring</h1>
            <p className="mt-1 text-xs text-slate-500">
              Manage Cohorts, Modules, Lessons, Assignments, Deadlines &amp; Lesson Resources.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button href="/review/submissions" variant="secondary" className="hidden sm:inline-flex">
              Review Queue
            </Button>
            <Button onClick={() => openCohortEditor()}>
              <Plus size={17} /> New Cohort
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {/* Top Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <StatCard label="Cohorts" value={cohorts.length} icon={<Sparkles size={18} className="text-orange-500" />} />
          <StatCard label="Modules" value={modules.length} icon={<BookOpen size={18} className="text-blue-500" />} />
          <StatCard label="Lessons" value={totalLessons} icon={<Play size={18} className="text-emerald-500" />} />
          <StatCard label="Assignments" value={assignments.length} icon={<Calendar size={18} className="text-purple-500" />} />
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:text-red-900" aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <Check size={17} className="shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="p-1 hover:text-emerald-900" aria-label="Dismiss message">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Controls / Filter */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-slate-500">
            Select a cohort below to manage its modules, video lessons, assignments, and resource downloads.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm focus-within:border-orange-400">
            <Search size={17} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cohorts..."
              className="w-48 bg-transparent outline-none placeholder:text-slate-400 sm:w-64"
            />
          </div>
        </div>

        {/* Cohorts List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
            ))}
          </div>
        ) : filteredCohorts.length ? (
          <div className="space-y-6">
            {filteredCohorts.map((cohort) => {
              const cohortModules = modules
                .filter((m) => m.cohort_id === cohort.id)
                .sort((a, b) => a.position - b.position);
              const isExpanded = expandedCohortId === cohort.id;

              return (
                <Card key={cohort.id} className="overflow-hidden shadow-sm transition">
                  {/* Cohort Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                    <button
                      onClick={() => setExpandedCohortId(isExpanded ? null : cohort.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ChevronDown
                        className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : ''}`}
                        size={20}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="truncate text-lg font-black text-slate-950">{cohort.name}</h2>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              cohort.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700'
                                : cohort.status === 'draft'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cohort.status === 'published' ? '● Published' : cohort.status === 'draft' ? '○ Draft' : 'Archived'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                            {cohortModules.length} {cohortModules.length === 1 ? 'module' : 'modules'}
                          </span>
                          {cohort.capacity && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                              Cap: {cohort.capacity} seats
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {cohort.description || 'No description set'}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openModuleEditor(cohort.id)}>
                        <Plus size={15} /> Add Module
                      </Button>
                      <button
                        onClick={() => openCohortEditor(cohort)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        title="Edit Cohort"
                        aria-label="Edit Cohort"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => void handleDelete('cohort', cohort.id, cohort.name)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete Cohort"
                        aria-label="Delete Cohort"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Cohort Contents (Modules & Lessons) */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 p-5 lg:p-6">
                      {cohortModules.length ? (
                        <div className="space-y-5">
                          {cohortModules.map((module, moduleIndex) => {
                            const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);

                            return (
                              <div
                                key={module.id}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                              >
                                {/* Module Bar */}
                                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-100/50 px-5 py-4 sm:flex-row sm:items-center">
                                  <div className="flex items-center gap-3">
                                    <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-xs font-black text-orange-700">
                                      {module.position}
                                    </span>
                                    <div>
                                      <h3 className="text-sm font-bold text-slate-950 sm:text-base">
                                        {module.title}
                                      </h3>
                                      {module.description && (
                                        <p className="text-xs text-slate-500">{module.description}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                                    {/* Reorder Module Up / Down */}
                                    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                                      <button
                                        disabled={moduleIndex === 0}
                                        onClick={() => void handleReorderModule(cohort.id, module, 'up')}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                                        title="Move module up"
                                      >
                                        <ArrowUp size={13} />
                                      </button>
                                      <button
                                        disabled={moduleIndex === cohortModules.length - 1}
                                        onClick={() => void handleReorderModule(cohort.id, module, 'down')}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                                        title="Move module down"
                                      >
                                        <ArrowDown size={13} />
                                      </button>
                                    </div>

                                    {/* Duplicate Module */}
                                    <button
                                      onClick={() => void handleDuplicateModule(module.id, module.title)}
                                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                      title="Duplicate module and all lessons"
                                    >
                                      <Copy size={13} />
                                    </button>

                                    {/* Bulk Publish / Draft */}
                                    <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-white text-[10px] font-bold overflow-hidden">
                                      <button
                                        onClick={() => void handleBulkModulePublish(module, 'published')}
                                        className="px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                                        title="Publish all lessons in module"
                                      >
                                        Publish All
                                      </button>
                                      <span className="text-slate-200">|</span>
                                      <button
                                        onClick={() => void handleBulkModulePublish(module, 'draft')}
                                        className="px-2 py-1 text-slate-500 hover:bg-slate-100"
                                        title="Draft all lessons in module"
                                      >
                                        Draft All
                                      </button>
                                    </div>

                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => openLessonEditor(module.id)}
                                      className="h-8 text-xs font-bold ml-1"
                                    >
                                      <Plus size={14} /> Add Lesson
                                    </Button>
                                    <button
                                      onClick={() => openModuleEditor(cohort.id, module)}
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-900"
                                      title="Edit Module"
                                      aria-label="Edit Module"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      onClick={() => void handleDelete('module', module.id, module.title)}
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                      title="Delete Module"
                                      aria-label="Delete Module"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>

                                {/* Lessons in Module */}
                                <div className="divide-y divide-slate-100">
                                  {sortedLessons.length ? (
                                    sortedLessons.map((lesson, lessonIndex) => {
                                      const lessonAssignments = assignmentsByLesson.get(lesson.id) || [];
                                      const lessonResources = resourcesByLesson.get(lesson.id) || [];
                                      const isLessonExpanded = expandedLessonId === lesson.id;

                                      return (
                                        <div key={lesson.id} className="transition-colors hover:bg-slate-50/40">
                                          {/* Lesson Row */}
                                          <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                                            <div className="flex min-w-0 items-center gap-3">
                                              <span className="flex size-6 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-600">
                                                {lesson.position}
                                              </span>
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <strong className="truncate text-sm font-bold text-slate-900">
                                                    {lesson.title}
                                                  </strong>

                                                  {/* Publishing Status Dropdown */}
                                                  <select
                                                    value={lesson.status ?? 'published'}
                                                    onChange={(e) =>
                                                      void handleUpdateLessonStatus(
                                                        lesson.id,
                                                        e.target.value as 'draft' | 'published' | 'archived'
                                                      )
                                                    }
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold border outline-none cursor-pointer ${
                                                      lesson.status === 'draft'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                        : lesson.status === 'archived'
                                                        ? 'border-slate-200 bg-slate-100 text-slate-600'
                                                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                    }`}
                                                  >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                  </select>

                                                  {lesson.video_url ? (
                                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                                      <Video size={12} /> Video Attached
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                                      No video
                                                    </span>
                                                  )}
                                                  {lesson.duration_minutes && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                      <Clock size={12} /> {lesson.duration_minutes}m
                                                    </span>
                                                  )}
                                                </div>
                                                {lesson.description && (
                                                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                                    {lesson.description}
                                                  </p>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                                              {/* Move Lesson Up / Down */}
                                              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                                                <button
                                                  disabled={lessonIndex === 0}
                                                  onClick={() => void handleReorderLesson(module, lesson, 'up')}
                                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                                                  title="Move lesson up"
                                                >
                                                  <ArrowUp size={12} />
                                                </button>
                                                <button
                                                  disabled={lessonIndex === sortedLessons.length - 1}
                                                  onClick={() => void handleReorderLesson(module, lesson, 'down')}
                                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                                                  title="Move lesson down"
                                                >
                                                  <ArrowDown size={12} />
                                                </button>
                                              </div>

                                              {/* Duplicate Lesson */}
                                              <button
                                                onClick={() => void handleDuplicateLesson(lesson.id, lesson.title)}
                                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                                                title="Duplicate Lesson"
                                              >
                                                <Copy size={13} />
                                              </button>

                                              {/* Toggle Sub-items */}
                                              <button
                                                onClick={() =>
                                                  setExpandedLessonId(isLessonExpanded ? null : lesson.id)
                                                }
                                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                                                  isLessonExpanded
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                              >
                                                <span>
                                                  {lessonAssignments.length} {lessonAssignments.length === 1 ? 'assignment' : 'assignments'} ·{' '}
                                                  {lessonResources.length} {lessonResources.length === 1 ? 'resource' : 'resources'}
                                                </span>
                                                <ChevronDown
                                                  size={14}
                                                  className={`transition-transform ${isLessonExpanded ? 'rotate-180' : ''}`}
                                                />
                                              </button>

                                              <button
                                                onClick={() => openLessonEditor(module.id, lesson)}
                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                                                title="Edit Lesson"
                                                aria-label="Edit Lesson"
                                              >
                                                <Pencil size={15} />
                                              </button>
                                              <button
                                                onClick={() => void handleDelete('lesson', lesson.id, lesson.title)}
                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                title="Delete Lesson"
                                                aria-label="Delete Lesson"
                                              >
                                                <Trash2 size={15} />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Lesson Expanded Drawer: Assignments & Resources */}
                                          {isLessonExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/90 p-4 sm:p-5">
                                              <div className="grid gap-6 lg:grid-cols-2">
                                                {/* Left Column: Assignments */}
                                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                                  <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <Calendar size={16} className="text-orange-500" />
                                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                                        Assignments &amp; Deadlines
                                                      </h4>
                                                    </div>
                                                    <Button
                                                      variant="secondary"
                                                      size="sm"
                                                      onClick={() => openAssignmentEditor(lesson.id)}
                                                      className="h-7 px-2 text-[11px]"
                                                    >
                                                      <Plus size={13} /> Add Assignment
                                                    </Button>
                                                  </div>

                                                  {lessonAssignments.length ? (
                                                    <div className="space-y-2.5">
                                                      {lessonAssignments.map((assignment) => (
                                                        <div
                                                          key={assignment.id}
                                                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                                                        >
                                                          <div className="min-w-0">
                                                            <strong className="block text-xs font-bold text-slate-900">
                                                              {assignment.title}
                                                            </strong>
                                                            {assignment.instructions && (
                                                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                                                {assignment.instructions}
                                                              </p>
                                                            )}
                                                            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                                                              <Clock size={12} className="text-orange-500" />
                                                              <span>
                                                                Deadline:{' '}
                                                                {assignment.deadline
                                                                  ? new Date(assignment.deadline).toLocaleString([], {
                                                                      month: 'short',
                                                                      day: 'numeric',
                                                                      hour: '2-digit',
                                                                      minute: '2-digit',
                                                                    })
                                                                  : 'No deadline set'}
                                                              </span>
                                                            </div>
                                                          </div>
                                                          <div className="flex shrink-0 items-center gap-1">
                                                            <button
                                                              onClick={() => openAssignmentEditor(lesson.id, assignment)}
                                                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                                                              title="Edit Assignment"
                                                              aria-label="Edit Assignment"
                                                            >
                                                              <Pencil size={13} />
                                                            </button>
                                                            <button
                                                              onClick={() =>
                                                                void handleDelete('assignment', assignment.id, assignment.title)
                                                              }
                                                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                              title="Delete Assignment"
                                                              aria-label="Delete Assignment"
                                                            >
                                                              <Trash2 size={13} />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="py-4 text-center text-xs text-slate-400">
                                                      No assignments for this lesson yet.
                                                    </p>
                                                  )}
                                                </div>

                                                {/* Right Column: Resources */}
                                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                                  <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <Paperclip size={16} className="text-orange-500" />
                                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                                        Lesson Resources &amp; Downloads
                                                      </h4>
                                                    </div>
                                                    <Button
                                                      variant="secondary"
                                                      size="sm"
                                                      onClick={() => openResourceEditor(lesson.id)}
                                                      className="h-7 px-2 text-[11px]"
                                                    >
                                                      <Plus size={13} /> Add Resource
                                                    </Button>
                                                  </div>

                                                  {lessonResources.length ? (
                                                    <div className="space-y-2.5">
                                                      {lessonResources.map((res) => (
                                                        <div
                                                          key={res.id}
                                                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                                                        >
                                                          <div className="flex min-w-0 items-start gap-2.5">
                                                            <span className="mt-0.5 shrink-0 text-slate-500">
                                                              {getResourceIcon(res.resource_type)}
                                                            </span>
                                                            <div className="min-w-0">
                                                              <a
                                                                href={res.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-orange-600"
                                                              >
                                                                <span className="truncate">{res.name}</span>
                                                                <ExternalLink size={11} className="shrink-0 text-slate-400" />
                                                              </a>
                                                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                                <VisibilityBadge rule={res.visibility ?? 'enrolled'} />
                                                                {res.file_size && (
                                                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                                    {formatFileSize(res.file_size)}
                                                                  </span>
                                                                )}
                                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                                                                  {res.resource_type || 'asset'}
                                                                </span>
                                                              </div>
                                                            </div>
                                                          </div>
                                                          <div className="flex shrink-0 items-center gap-1">
                                                            <button
                                                              onClick={() => openResourceEditor(lesson.id, res)}
                                                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                                                              title="Edit Resource"
                                                              aria-label="Edit Resource"
                                                            >
                                                              <Pencil size={13} />
                                                            </button>
                                                            <button
                                                              onClick={() =>
                                                                void handleDelete('resource', res.id, res.name)
                                                              }
                                                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                              title="Delete Resource"
                                                              aria-label="Delete Resource"
                                                            >
                                                              <Trash2 size={13} />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="py-4 text-center text-xs text-slate-400">
                                                      No downloadable files or resources added yet.
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="p-5 text-center text-xs text-slate-400">
                                      No lessons added to this module yet. Click &quot;Add Lesson&quot; above.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                          <BookOpen className="mx-auto mb-2 text-slate-300" size={24} />
                          <p className="text-sm font-semibold text-slate-700">No modules in this cohort yet.</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Create the first module to start assembling the course curriculum.
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-4"
                            onClick={() => openModuleEditor(cohort.id)}
                          >
                            <Plus size={15} /> Add First Module
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <BookOpen className="mx-auto mb-3 text-slate-300" size={32} />
            <h3 className="text-lg font-black text-slate-950">No cohorts found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {search ? 'Try clearing your search query.' : 'Create your first cohort to begin authoring courses.'}
            </p>
            <Button onClick={() => openCohortEditor()} className="mt-5">
              <Plus size={16} /> Create Cohort
            </Button>
          </Card>
        )}
      </main>

      {/* Unified Editor Modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition"
          >
            {/* Modal Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-500">
                  {editor.id ? 'Edit' : 'Create'} {editor.type}
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {editor.type === 'cohort' && (editor.id ? 'Edit Cohort' : 'New Cohort')}
                  {editor.type === 'module' && (editor.id ? 'Edit Module' : 'New Module')}
                  {editor.type === 'lesson' && (editor.id ? 'Edit Lesson' : 'New Lesson')}
                  {editor.type === 'assignment' && (editor.id ? 'Edit Assignment' : 'New Assignment')}
                  {editor.type === 'resource' && (editor.id ? 'Edit Resource' : 'Add Lesson Resource')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setUploadFile(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-left">
              {/* COHORT FIELDS */}
              {editor.type === 'cohort' && (
                <>
                  <FormField
                    label="Cohort Name"
                    value={editor.name}
                    onChange={(val) => setEditor({ ...editor, name: val })}
                    placeholder="e.g., Premiere Pro Masterclass - Spring 2026"
                    required
                  />
                  <TextareaField
                    label="Cohort Description"
                    value={editor.description}
                    onChange={(val) => setEditor({ ...editor, description: val })}
                    placeholder="Overview of the learning objectives, deliverables, and expectations..."
                    rows={3}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block text-left">
                      <span className="mb-1.5 block text-sm font-bold text-slate-700">
                        Publish Status
                      </span>
                      <select
                        value={editor.status}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            status: e.target.value as 'draft' | 'published' | 'archived',
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>

                    <label className="block text-left">
                      <span className="mb-1.5 block text-sm font-bold text-slate-700">
                        Visibility
                      </span>
                      <select
                        value={editor.visibility}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            visibility: e.target.value as 'public' | 'private' | 'unlisted',
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                      </select>
                    </label>

                    <FormField
                      label="Capacity"
                      type="number"
                      min="1"
                      value={editor.capacity}
                      onChange={(val) => setEditor({ ...editor, capacity: val })}
                      placeholder="30"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Enrollment Start"
                      type="datetime-local"
                      value={editor.enrollmentStart}
                      onChange={(val) => setEditor({ ...editor, enrollmentStart: val })}
                    />
                    <FormField
                      label="Enrollment End"
                      type="datetime-local"
                      value={editor.enrollmentEnd}
                      onChange={(val) => setEditor({ ...editor, enrollmentEnd: val })}
                    />
                  </div>
                </>
              )}

              {/* MODULE FIELDS */}
              {editor.type === 'module' && (
                <>
                  <FormField
                    label="Module Title"
                    value={editor.title}
                    onChange={(val) => setEditor({ ...editor, title: val })}
                    placeholder="e.g., Module 1: Editorial Pacing & Narrative Rhythms"
                    required
                  />
                  <TextareaField
                    label="Module Description (Optional)"
                    value={editor.description}
                    onChange={(val) => setEditor({ ...editor, description: val })}
                    placeholder="Brief description of what this module covers..."
                    rows={2}
                  />
                  <FormField
                    label="Position / Order"
                    type="number"
                    min="1"
                    value={String(editor.position)}
                    onChange={(val) => setEditor({ ...editor, position: Number(val) || 1 })}
                    required
                  />
                </>
              )}

              {/* LESSON FIELDS */}
              {editor.type === 'lesson' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <FormField
                        label="Lesson Title"
                        value={editor.title}
                        onChange={(val) => setEditor({ ...editor, title: val })}
                        placeholder="e.g., Cutting on Action and Invisible Continuity"
                        required
                      />
                    </div>
                    <label className="block text-left">
                      <span className="mb-1.5 block text-sm font-bold text-slate-700">
                        Status
                      </span>
                      <select
                        value={editor.status}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            status: e.target.value as 'draft' | 'published' | 'archived',
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                  <TextareaField
                    label="Lesson Description"
                    value={editor.description}
                    onChange={(val) => setEditor({ ...editor, description: val })}
                    placeholder="Key concepts, video timeline walkthrough, and takeaways..."
                    rows={3}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Position"
                      type="number"
                      min="1"
                      value={String(editor.position)}
                      onChange={(val) => setEditor({ ...editor, position: Number(val) || 1 })}
                      required
                    />
                    <FormField
                      label="Duration (Minutes)"
                      type="number"
                      min="1"
                      value={editor.durationMinutes}
                      onChange={(val) => setEditor({ ...editor, durationMinutes: val })}
                      placeholder="e.g. 15"
                    />
                  </div>

                  {/* Video URL or Video File Upload */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Lesson Video Content
                    </span>
                    <FormField
                      label="External Video URL (Optional)"
                      value={editor.videoUrl}
                      onChange={(val) => setEditor({ ...editor, videoUrl: val })}
                      placeholder="https://..."
                    />
                    <div className="mt-3">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Or Upload Video File (.mp4, .mov, .webm)
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/*"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                      {uploadFile && (
                        <p className="mt-1 text-xs text-emerald-600 font-semibold">
                          Selected for upload: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ASSIGNMENT FIELDS */}
              {editor.type === 'assignment' && (
                <>
                  <FormField
                    label="Assignment Title"
                    value={editor.title}
                    onChange={(val) => setEditor({ ...editor, title: val })}
                    placeholder="e.g., Action Cut Sequence: Challenge #1"
                    required
                  />
                  <TextareaField
                    label="Assignment Instructions"
                    value={editor.instructions}
                    onChange={(val) => setEditor({ ...editor, instructions: val })}
                    placeholder="Detailed guidelines, editing brief, technical requirements, and submission instructions..."
                    rows={4}
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-slate-700">
                      Deadline / Due Date (Optional)
                    </span>
                    <input
                      type="datetime-local"
                      value={editor.deadline}
                      onChange={(e) => setEditor({ ...editor, deadline: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                    />
                    <span className="mt-1 block text-xs text-slate-400">
                      Students will see a countdown and deadline badge on their dashboard.
                    </span>
                  </label>
                </>
              )}

              {/* RESOURCE FIELDS */}
              {editor.type === 'resource' && (
                <>
                  <FormField
                    label="Resource Name / Label"
                    value={editor.name}
                    onChange={(val) => setEditor({ ...editor, name: val })}
                    placeholder="e.g., Raw Footage & DaVinci Resolve Project (.drp)"
                  />

                  {/* Resource Source Mode */}
                  <div>
                    <span className="mb-1.5 block text-sm font-bold text-slate-700">Resource Source</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditor({ ...editor, sourceMode: 'upload' })}
                        className={`rounded-xl border py-2 text-xs font-bold transition ${
                          editor.sourceMode === 'upload'
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Upload size={14} className="mr-1 inline" /> Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditor({ ...editor, sourceMode: 'url' })}
                        className={`rounded-xl border py-2 text-xs font-bold transition ${
                          editor.sourceMode === 'url'
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ExternalLink size={14} className="mr-1 inline" /> External URL
                      </button>
                    </div>
                  </div>

                  {editor.sourceMode === 'upload' ? (
                    <div>
                      <span className="mb-1.5 block text-sm font-bold text-slate-700">
                        Select File (Videos, PDFs, Docs, Images, Project Files)
                      </span>
                      <input
                        type="file"
                        accept="video/*,image/*,application/pdf,.doc,.docx,.txt,.rtf,.zip,.rar,.7z,.prproj,.drp,.fcpxml,.aep,.psd"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setUploadFile(file);
                          if (file && !editor.name) {
                            setEditor({
                              ...editor,
                              name: file.name.replace(/\.[^/.]+$/, ''),
                              resourceType: detectResourceType(file.name),
                            });
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Supports Premiere (.prproj), Resolve (.drp), Final Cut (.fcpxml), ZIP, PDF, Docs, Images &amp; Videos.
                      </p>
                      {uploadFile && (
                        <p className="mt-1 text-xs font-semibold text-emerald-600">
                          Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                        </p>
                      )}
                    </div>
                  ) : (
                    <FormField
                      label="Direct Download or Web URL"
                      value={editor.url}
                      onChange={(val) => {
                        setEditor({
                          ...editor,
                          url: val,
                          resourceType: detectResourceType(val),
                        });
                      }}
                      placeholder="https://..."
                      required
                    />
                  )}

                  {/* Resource Type */}
                  <div>
                    <span className="mb-1.5 block text-sm font-bold text-slate-700">Resource Category</span>
                    <select
                      value={editor.resourceType}
                      onChange={(e) => setEditor({ ...editor, resourceType: e.target.value as ResourceType })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-orange-400"
                    >
                      <option value="project_file">Project File (.prproj, .drp, .fcpxml, .aep, .zip)</option>
                      <option value="pdf">PDF Document</option>
                      <option value="document">Text / Word Document</option>
                      <option value="video">Video Asset</option>
                      <option value="image">Image / Graphic</option>
                      <option value="link">External Resource Link</option>
                      <option value="other">Other Asset</option>
                    </select>
                  </div>

                  {/* Resource Visibility Rules */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span className="mb-1 block text-sm font-bold text-slate-900">
                      Resource Visibility Rule
                    </span>
                    <p className="mb-3 text-xs text-slate-500">
                      Determine who can access and download this file.
                    </p>
                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-orange-300">
                        <input
                          type="radio"
                          name="visibility"
                          value="enrolled"
                          checked={editor.visibility === 'enrolled'}
                          onChange={() => setEditor({ ...editor, visibility: 'enrolled' })}
                          className="mt-1 text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <strong className="block text-xs font-bold text-slate-900">
                            Enrolled Students (Default)
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            Visible to all students actively enrolled in this cohort.
                          </span>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-orange-300">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={editor.visibility === 'public'}
                          onChange={() => setEditor({ ...editor, visibility: 'public' })}
                          className="mt-1 text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <strong className="block text-xs font-bold text-slate-900">
                            Public Preview
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            Accessible to everyone, including prospective students exploring the course.
                          </span>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-orange-300">
                        <input
                          type="radio"
                          name="visibility"
                          value="after_completion"
                          checked={editor.visibility === 'after_completion'}
                          onChange={() => setEditor({ ...editor, visibility: 'after_completion' })}
                          className="mt-1 text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <strong className="flex items-center gap-1 text-xs font-bold text-slate-900">
                            <Lock size={12} className="text-amber-600" /> Locked until Lesson Completed
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            Only unlocked after the student marks this lesson complete (great for solutions &amp; source project files).
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditor(null);
                  setUploadFile(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {uploadingStatus || (saving ? 'Saving...' : 'Save Changes')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center justify-between p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100/70">{icon}</div>
    </Card>
  );
}

function VisibilityBadge({ rule }: { rule: VisibilityRule }) {
  if (rule === 'after_completion') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
        <Lock size={10} /> Locked until complete
      </span>
    );
  }
  if (rule === 'public') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
        <Eye size={10} /> Public Preview
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
      Enrolled only
    </span>
  );
}

function getResourceIcon(type?: ResourceType) {
  switch (type) {
    case 'video':
      return <Video size={16} className="text-emerald-500" />;
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'document':
      return <FileText size={16} className="text-blue-500" />;
    case 'image':
      return <ImageIcon size={16} className="text-purple-500" />;
    case 'project_file':
      return <FileArchive size={16} className="text-orange-500" />;
    default:
      return <Paperclip size={16} className="text-slate-400" />;
  }
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
      />
    </label>
  );
}