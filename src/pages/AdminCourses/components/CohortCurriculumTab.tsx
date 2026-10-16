import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Video,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { formatFileSize, getSecureAssetUrl, type Cohort } from '../../../lib/courseService';
import { useAdminCourses } from '../context/useAdminCourses';
import { VisibilityBadge, ResourceIcon } from './SharedSubcomponents';

export function CohortCurriculumTab({ cohort }: { cohort: Cohort }) {
  const {
    modules,
    assignmentsByLesson,
    resourcesByLesson,
    expandedLessonId,
    setExpandedLessonId,
    canManageCurriculum,
    canPublish,
    openModuleEditor,
    openLessonEditor,
    openAssignmentEditor,
    openResourceEditor,
    handleReorderModule,
    handleReorderLesson,
    handleDuplicateModule,
    handleDuplicateLesson,
    handleBulkModulePublish,
    handleUpdateLessonStatus,
    handleDelete,
  } = useAdminCourses();

  const cohortModules = modules
    .filter((m) => m.cohort_id === cohort.id)
    .sort((a, b) => a.position - b.position);

  if (!cohortModules.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
        <BookOpen className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={24} />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No modules in this cohort yet.</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
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
    );
  }

  return (
    <div className="space-y-5">
      {cohortModules.map((module, moduleIndex) => {
        const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);

        return (
          <div
            key={module.id}
            className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            {/* Module Bar */}
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/50 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/60 text-xs font-black text-orange-700 dark:text-orange-300">
                  {module.position}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white sm:text-base">
                      {module.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        module.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : module.status === 'review'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : module.status === 'archived'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {module.status ?? 'published'}
                    </span>
                  </div>
                  {module.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{module.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                {/* Reorder Module Up / Down */}
                <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                  <button
                    disabled={moduleIndex === 0}
                    onClick={() => void handleReorderModule(cohort.id, module, 'up')}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                    title="Move module up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    disabled={moduleIndex === cohortModules.length - 1}
                    onClick={() => void handleReorderModule(cohort.id, module, 'down')}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                    title="Move module down"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                {/* Duplicate Module */}
                <button
                  onClick={() => void handleDuplicateModule(module.id, module.title)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                  title="Duplicate module and all lessons"
                >
                  <Copy size={13} />
                </button>

                {/* Bulk Publish / Review / Draft */}
                {canPublish && (
                  <div className="hidden sm:flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold overflow-hidden shadow-2xs">
                    <button
                      onClick={() => void handleBulkModulePublish(module, 'published')}
                      className="px-2 py-1 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                      title="Publish all lessons in module"
                    >
                      Publish All
                    </button>
                    <span className="text-slate-200 dark:text-slate-700">|</span>
                    <button
                      onClick={() => void handleBulkModulePublish(module, 'review')}
                      className="px-2 py-1 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      title="Submit all lessons for review"
                    >
                      Review All
                    </button>
                    <span className="text-slate-200 dark:text-slate-700">|</span>
                    <button
                      onClick={() => void handleBulkModulePublish(module, 'draft')}
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                      title="Draft all lessons in module"
                    >
                      Draft All
                    </button>
                  </div>
                )}

                {canManageCurriculum && (
                  <>
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
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white transition"
                      title="Edit Module"
                      aria-label="Edit Module"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => void handleDelete('module', module.id, module.title)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                      title="Delete Module"
                      aria-label="Delete Module"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Lessons in Module */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedLessons.length ? (
                sortedLessons.map((lesson, lessonIndex) => {
                  const lessonAssignments = assignmentsByLesson.get(lesson.id) || [];
                  const lessonResources = resourcesByLesson.get(lesson.id) || [];
                  const isLessonExpanded = expandedLessonId === lesson.id;

                  return (
                    <div key={lesson.id} className="transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                      {/* Lesson Row */}
                      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-6 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {lesson.position}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                {lesson.title}
                              </strong>

                              {/* Publishing Status Dropdown with 4 stages */}
                              <select
                                value={lesson.status ?? 'draft'}
                                disabled={!canManageCurriculum}
                                onChange={(e) =>
                                  void handleUpdateLessonStatus(
                                    lesson.id,
                                    e.target.value as 'draft' | 'review' | 'published' | 'archived',
                                    lesson.title
                                  )
                                }
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold border outline-none cursor-pointer ${
                                  lesson.status === 'review'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300'
                                    : lesson.status === 'draft'
                                    ? 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : lesson.status === 'archived'
                                    ? 'border-slate-300 bg-slate-200/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                                }`}
                              >
                                <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">○ Draft</option>
                                <option value="review" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">◐ In Review</option>
                                <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">● Published</option>
                                <option value="archived" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">✕ Archived</option>
                              </select>

                              {/* Quick Lifecycle Action Buttons */}
                              {canManageCurriculum && (lesson.status === 'draft' || !lesson.status) && (
                                <button
                                  onClick={() => void handleUpdateLessonStatus(lesson.id, 'review', lesson.title)}
                                  className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                                  title="Submit lesson for review"
                                >
                                  <Send size={10} /> Submit Review
                                </button>
                              )}
                              {canPublish && lesson.status === 'review' && (
                                <button
                                  onClick={() => void handleUpdateLessonStatus(lesson.id, 'published', lesson.title)}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition"
                                  title="Approve and publish lesson"
                                >
                                  <CheckCircle2 size={10} /> Publish
                                </button>
                              )}
                              {canPublish && lesson.status === 'published' && (
                                <button
                                  onClick={() => void handleUpdateLessonStatus(lesson.id, 'archived', lesson.title)}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                  title="Archive lesson"
                                >
                                  <Archive size={10} /> Archive
                                </button>
                              )}
                              {canPublish && lesson.status === 'archived' && (
                                <button
                                  onClick={() => void handleUpdateLessonStatus(lesson.id, 'draft', lesson.title)}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                  title="Restore lesson to draft"
                                >
                                  <RotateCcw size={10} /> Restore
                                </button>
                              )}

                              {lesson.video_url ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <Video size={12} /> Video Attached
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  No video
                                </span>
                              )}
                              {lesson.duration_minutes && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <Clock size={12} /> {lesson.duration_minutes}m
                                </span>
                              )}
                            </div>
                            {lesson.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                                {lesson.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                          {/* Move Lesson Up / Down */}
                          {canManageCurriculum && (
                            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                              <button
                                disabled={lessonIndex === 0}
                                onClick={() => void handleReorderLesson(module, lesson, 'up')}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                                title="Move lesson up"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                disabled={lessonIndex === sortedLessons.length - 1}
                                onClick={() => void handleReorderLesson(module, lesson, 'down')}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                                title="Move lesson down"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                          )}

                          {/* Duplicate Lesson */}
                          {canManageCurriculum && (
                            <button
                              onClick={() => void handleDuplicateLesson(lesson.id, lesson.title)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Duplicate Lesson"
                            >
                              <Copy size={13} />
                            </button>
                          )}

                          {/* Toggle Sub-items */}
                          <button
                            onClick={() =>
                              setExpandedLessonId(isLessonExpanded ? null : lesson.id)
                            }
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                              isLessonExpanded
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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

                          {canManageCurriculum && (
                            <>
                              <button
                                onClick={() => openLessonEditor(module.id, lesson)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white transition"
                                title="Edit Lesson"
                                aria-label="Edit Lesson"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => void handleDelete('lesson', lesson.id, lesson.title)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                                title="Delete Lesson"
                                aria-label="Delete Lesson"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Lesson Expanded Drawer: Assignments & Resources */}
                      {isLessonExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 p-4 sm:p-5">
                          <div className="grid gap-6 lg:grid-cols-2">
                            {/* Left Column: Assignments */}
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar size={16} className="text-orange-500" />
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    Assignments &amp; Deadlines
                                  </h4>
                                </div>
                                {canManageCurriculum && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openAssignmentEditor(lesson.id, undefined, cohort.id)}
                                    className="h-7 px-2 text-[11px]"
                                  >
                                    <Plus size={13} /> Add Assignment
                                  </Button>
                                )}
                              </div>

                              {lessonAssignments.length ? (
                                <div className="space-y-2.5">
                                  {lessonAssignments.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3"
                                    >
                                      <div className="min-w-0">
                                        <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                                          {assignment.title}
                                        </strong>
                                        {(assignment.instructions || assignment.description) && (
                                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                            {assignment.instructions || assignment.description}
                                          </p>
                                        )}
                                        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
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
                                      {canManageCurriculum && (
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            onClick={() => openAssignmentEditor(lesson.id, assignment, cohort.id)}
                                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white transition"
                                            title="Edit Assignment"
                                            aria-label="Edit Assignment"
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              void handleDelete('assignment', assignment.id, assignment.title)
                                            }
                                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                                            title="Delete Assignment"
                                            aria-label="Delete Assignment"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                                  No assignments for this lesson yet.
                                </p>
                              )}
                            </div>

                            {/* Right Column: Resources */}
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Paperclip size={16} className="text-orange-500" />
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    Lesson Resources &amp; Downloads
                                  </h4>
                                </div>
                                {canManageCurriculum && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openResourceEditor(lesson.id)}
                                    className="h-7 px-2 text-[11px]"
                                  >
                                    <Plus size={13} /> Add Resource
                                  </Button>
                                )}
                              </div>

                              {lessonResources.length ? (
                                <div className="space-y-2.5">
                                  {lessonResources.map((res) => (
                                    <div
                                      key={res.id}
                                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3"
                                    >
                                      <div className="flex min-w-0 items-start gap-2.5">
                                          <ResourceIcon type={res.resource_type} />

                                        <div className="min-w-0">
                                          <a
                                            href={res.url}
                                            onClick={async (e) => {
                                              if (res.url.includes('course-assets') || res.url.startsWith('resources/') || res.url.startsWith('lessons/')) {
                                                e.preventDefault();
                                                try {
                                                  const signed = await getSecureAssetUrl(res.url);
                                                  window.open(signed, '_blank', 'noopener,noreferrer');
                                                } catch (err: unknown) {
                                                  alert(err instanceof Error ? err.message : 'Could not open secure course asset.');
                                                }
                                              }
                                            }}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400"
                                          >
                                            <span className="truncate">{res.name}</span>
                                            <ExternalLink size={11} className="shrink-0 text-slate-400" />
                                          </a>
                                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <VisibilityBadge rule={res.visibility ?? 'enrolled'} />
                                            {res.file_size && (
                                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                                {formatFileSize(res.file_size)}
                                              </span>
                                            )}
                                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                                              {res.resource_type || 'asset'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      {canManageCurriculum && (
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            onClick={() => openResourceEditor(lesson.id, res)}
                                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white transition"
                                            title="Edit Resource"
                                            aria-label="Edit Resource"
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              void handleDelete('resource', res.id, res.name)
                                            }
                                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                                            title="Delete Resource"
                                            aria-label="Delete Resource"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
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
                <div className="p-5 text-center text-xs text-slate-400 dark:text-slate-500">
                  No lessons added to this module yet. Click &quot;Add Lesson&quot; above.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
