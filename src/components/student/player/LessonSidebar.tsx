import { useState, useMemo, useCallback } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  Search,
  X,
  BookOpen,
} from 'lucide-react';
import type {
  Lesson,
  Module,
  StudentCourseData,
  StudentUnifiedProgress,
} from '../../../lib/courseService';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';

export interface LessonSidebarProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  course: StudentCourseData;
  unifiedProgress: StudentUnifiedProgress | null;
  progressPercent: number;
  completedCount: number;
  allLessons: Lesson[];
  completedIds: Set<string>;
  selectedLessonId: string | null;
  onSelectLesson: (lesson: Lesson) => void;
  loading: boolean;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function SidebarEmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white text-center px-4 py-8">
      <BookOpen className="mx-auto mb-3 text-slate-300" size={22} />
      <p className="mx-auto max-w-xs text-xs sm:text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function LessonSidebar({
  sidebarOpen,
  onCloseSidebar,
  course,
  unifiedProgress,
  progressPercent,
  completedCount,
  allLessons,
  completedIds,
  selectedLessonId,
  onSelectLesson,
  loading,
}: LessonSidebarProps) {
  useModalScrollLock(sidebarOpen);
  const [lessonSearchQuery, setLessonSearchQuery] = useState('');
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());

  const toggleModuleCollapse = useCallback((moduleId: string) => {
    setCollapsedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const filteredModules = useMemo(() => {
    if (!lessonSearchQuery.trim()) return course.modules;
    const q = lessonSearchQuery.toLowerCase();
    return course.modules
      .map((mod: Module) => ({
        ...mod,
        lessons: mod.lessons.filter((l) => l.title.toLowerCase().includes(q)),
      }))
      .filter((mod) => mod.lessons.length > 0);
  }, [course.modules, lessonSearchQuery]);

  return (
    <>
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-40 w-84 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform lg:sticky lg:top-[73px] lg:block lg:h-[calc(100vh-73px)] lg:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">Curriculum Roadmap</p>
            <h2 className="mt-0.5 text-base font-black text-slate-950 truncate max-w-56">
              {course.cohort?.name ?? 'Course Workspace'}
            </h2>
          </div>
          <button
            onClick={onCloseSidebar}
            className="p-2 text-slate-400 hover:text-slate-700 lg:hidden"
            aria-label="Close course navigation"
          >
            <X size={19} />
          </button>
        </div>

        {/* Overall Progress Widget */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="mb-2 flex justify-between text-xs font-bold">
            <span className="text-slate-500">Overall Track Progress</span>
            <span className="text-orange-600">
              {unifiedProgress ? unifiedProgress.overall.composite_percent : progressPercent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
              style={{ width: `${unifiedProgress ? unifiedProgress.overall.composite_percent : progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>
              {unifiedProgress
                ? `${unifiedProgress.overall.completed_milestones} of ${unifiedProgress.overall.total_milestones} milestones complete`
                : `${completedCount} of ${allLessons.length} lessons complete`}
            </span>
            {(unifiedProgress ? unifiedProgress.overall.is_completed : progressPercent === 100 && allLessons.length > 0) && (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <Award size={13} /> Completed
              </span>
            )}
          </div>

          {/* Unified 3-Pillar Breakdown */}
          {unifiedProgress && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="rounded-lg bg-slate-50 p-1.5 border border-slate-100">
                <div className="text-slate-400 font-semibold">Lessons</div>
                <div className="font-extrabold text-slate-800">
                  {unifiedProgress.curriculum.completed_lessons}/{unifiedProgress.curriculum.total_lessons}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-1.5 border border-slate-100">
                <div className="text-slate-400 font-semibold">Tasks</div>
                <div className="font-extrabold text-slate-800">
                  {unifiedProgress.assignments.approved_assignments}/{unifiedProgress.assignments.total_assignments}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-1.5 border border-slate-100">
                <div className="text-slate-400 font-semibold">Sprint</div>
                <div className="font-extrabold text-orange-600">
                  {unifiedProgress.sprint_challenges.completed_challenges}/{unifiedProgress.sprint_challenges.effective_sprint_days}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lesson Search Bar */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={lessonSearchQuery}
              onChange={(e) => setLessonSearchQuery(e.target.value)}
              placeholder="Search lessons..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-orange-400 focus:bg-white"
            />
            {lessonSearchQuery && (
              <button
                onClick={() => setLessonSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Modules & Lessons List */}
        <nav className="max-h-[calc(100vh-270px)] overflow-y-auto p-4 space-y-3">
          {loading ? (
            <SidebarSkeleton />
          ) : filteredModules.length ? (
            filteredModules.map((module) => {
              const isCollapsed = collapsedModuleIds.has(module.id);
              const modCompletedCount = module.lessons.filter((l) => completedIds.has(l.id)).length;
              const modTotal = module.lessons.length;
              const isModComplete = modTotal > 0 && modCompletedCount === modTotal;

              return (
                <div key={module.id} className="rounded-xl border border-slate-100 bg-white shadow-2xs overflow-hidden">
                  {/* Module Accordion Header */}
                  <button
                    onClick={() => toggleModuleCollapse(module.id)}
                    className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Module {module.position}
                        </span>
                        {isModComplete ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            ✓ Complete
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            ({modCompletedCount}/{modTotal})
                          </span>
                        )}
                      </div>
                      <h4 className="mt-0.5 text-xs font-bold text-slate-900 leading-tight">{module.title}</h4>
                    </div>
                    <ChevronDown
                      size={15}
                      className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                        isCollapsed ? '-rotate-90' : 'rotate-0'
                      }`}
                    />
                  </button>

                  {/* Lessons inside Module */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-100 p-1.5 space-y-1 bg-slate-50/50">
                      {module.lessons.map((lesson) => {
                        const isSelected = lesson.id === selectedLessonId;
                        const isDone = completedIds.has(lesson.id);

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => onSelectLesson(lesson)}
                            className={`flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition ${
                              isSelected
                                ? 'bg-orange-500 text-white shadow-xs font-bold'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                                isDone
                                  ? isSelected
                                    ? 'border-white bg-white text-orange-600 font-bold'
                                    : 'border-emerald-500 bg-emerald-500 text-white'
                                  : isSelected
                                  ? 'border-white/80 bg-white/20 text-white'
                                  : 'border-slate-300 text-slate-400'
                              }`}
                            >
                              {isDone ? <Check size={11} /> : lesson.position}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-snug truncate">{lesson.title}</p>
                              {(() => {
                                const lProgress = course.progress.find((p) => p.lesson_id === lesson.id);
                                const wPct = lProgress?.watch_percentage ?? 0;
                                return (
                                  <p
                                    className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${
                                      isSelected ? 'text-white/80' : 'text-slate-400'
                                    }`}
                                  >
                                    {lesson.duration_minutes && <span>{lesson.duration_minutes} mins</span>}
                                    {!isDone && wPct > 0 && (
                                      <span
                                        className={
                                          isSelected
                                            ? 'text-white font-medium'
                                            : 'text-orange-600 font-semibold'
                                        }
                                      >
                                        • {wPct}% watched
                                      </span>
                                    )}
                                  </p>
                                );
                              })()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : lessonSearchQuery ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No lessons found matching &quot;{lessonSearchQuery}&quot;
            </div>
          ) : (
            <SidebarEmptyState label="Your lessons will appear here once you are enrolled in a cohort." />
          )}
        </nav>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseSidebar}
          aria-label="Close navigation overlay"
        />
      )}
    </>
  );
}

