import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  ExternalLink,
  FileArchive,
  FileText,
  Flame,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  Megaphone,
  MessagesSquare,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trophy,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { useToast } from '../../context/useToast';
import {
  formatFileSize,
  getLessonResourceDownloadUrl,
  getSecureAssetUrl,
  isSecurableAsset,
  listLessonResources,
  parseVideoUrl,
  updateLessonWatchProgress,
  type Cohort,
  type Lesson,
  type LessonResource,
  type Module,
  type StudentAnnouncement,
  type StudentCourseData,
  type StudentLiveSession,
  type StudentUnifiedProgress,
} from '../../lib/courseService';
import type { GamificationProfile } from '../../lib/gamificationService';
import type { StudioRecommendation } from '../../lib/recommendationService';
import type { InternshipDayStatus } from '../../lib/internshipService';
import { clearPendingCohortCheckout, markJustEnrolledCohort } from '../../lib/cohortCheckoutPersistence';
import { NotificationCenter } from '../NotificationCenter';
import { MilestonePanel, EnrollmentPanel, AssignmentPanel } from '../StudentFlowPanels';
import { SprintChallengeTracker } from '../internship/SprintChallengeTracker';
import { StudentCalendar } from '../StudentCalendar';
import { CommunityBoard } from '../CommunityBoard';
import { Button } from '../ui/Button';

export interface StudentPlayerViewProps {
  user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null;
  profile: { full_name?: string | null; whatsapp_number?: string | null } | null;
  course: StudentCourseData;
  targetCohortId?: string | null;
  allCohorts: Cohort[];
  allLessons: Lesson[];
  selectedLesson: Lesson | null;
  selectedLessonId: string | null;
  completedIds: Set<string>;
  completedCount: number;
  progressPercent: number;
  unifiedProgress: StudentUnifiedProgress | null;
  sprintDays: InternshipDayStatus[];
  sprintCompletedCount: number;
  sprintStreak: number;
  sprintScore: number | null;
  totalSprintDays: number;
  streak: number;
  gamification: GamificationProfile;
  studioRecommendations: StudioRecommendation[];
  learningTimeStr: string;
  unreadFeedbackCount: number;
  liveSessions: StudentLiveSession[];
  announcements: StudentAnnouncement[];
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
  selectLesson: (lesson: Lesson) => void;
  toggleComplete: () => Promise<void>;
  handleWatchProgress: (lessonId: string, watchPct: number, autoCompleted: boolean) => void;
  refreshSubmissions: () => Promise<void>;
  onBackToCatalog: () => void;
  onOpenAchievements: () => void;
  onOpenCertificate: () => void;
  onOpenReportCard: () => void;
  onEnrollmentSuccess?: (cohortId: string, cohortName?: string) => void;
}

export function StudentPlayerView({
  user,
  profile,
  course,
  targetCohortId,
  allCohorts,
  allLessons,
  selectedLesson,
  selectedLessonId,
  completedIds,
  completedCount,
  progressPercent,
  unifiedProgress,
  sprintDays,
  sprintCompletedCount,
  sprintStreak,
  sprintScore,
  totalSprintDays,
  streak,
  gamification,
  studioRecommendations,
  learningTimeStr,
  unreadFeedbackCount,
  liveSessions,
  announcements,
  loading,
  error,
  setError,
  setRefreshKey,
  prevLesson,
  nextLesson,
  selectLesson,
  toggleComplete,
  handleWatchProgress,
  refreshSubmissions,
  onBackToCatalog,
  onOpenAchievements,
  onOpenCertificate,
  onOpenReportCard,
  onEnrollmentSuccess,
}: StudentPlayerViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    'curriculum' | 'internship_sprint' | 'assignments' | 'calendar' | 'community' | 'sessions' | 'announcements'
  >(() => {
    const t = searchParams.get('tab');
    if (
      t === 'internship_sprint' ||
      t === 'assignments' ||
      t === 'calendar' ||
      t === 'community' ||
      t === 'sessions' ||
      t === 'announcements'
    ) {
      return t;
    }
    return 'curriculum';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lessonSearchQuery, setLessonSearchQuery] = useState('');
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());
  const [nowTimestamp] = useState(() => Date.now());

  const handleTabChange = useCallback(
    (tab: 'curriculum' | 'internship_sprint' | 'assignments' | 'calendar' | 'community' | 'sessions' | 'announcements') => {
      setActiveTab(tab);
      const newParams = new URLSearchParams(searchParams);
      if (tab === 'curriculum') {
        newParams.delete('tab');
      } else {
        newParams.set('tab', tab);
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

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
    <div>
      {/* Top Sub-bar with Back to Courses button */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <ChevronLeft size={16} />
          <span>Back to Courses</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 hidden sm:inline">
            {course.cohort?.name}
          </span>
          {user && <NotificationCenter userId={user.id} />}
          <button
            type="button"
            onClick={onOpenAchievements}
            className="flex items-center gap-2 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 to-orange-50/90 px-3 py-1.5 text-xs font-bold text-amber-950 transition hover:border-amber-300 hover:shadow-xs"
            title="View Editor Level & Achievements"
          >
            <div className="flex size-5 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
              <Trophy size={11} />
            </div>
            <span className="text-[10px] font-black uppercase text-orange-600">
              Lvl {gamification.level}
            </span>
            <span className="text-[11px] font-black text-slate-800 truncate max-w-28 hidden md:inline">
              {gamification.tierTitle}
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Left Sidebar: Collapsible Curriculum Navigation */}
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
              onClick={() => setSidebarOpen(false)}
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
                              onClick={() => selectLesson(lesson)}
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
              <EmptyState label="Your lessons will appear here once you are enrolled in a cohort." />
            )}
          </nav>
        </aside>

        {/* Backdrop for Mobile Sidebar */}
        {sidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}

        {/* Main Workspace Area */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <div className="mx-auto max-w-5xl">
            {/* Top Student Banner & Welcome */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-orange-500">Keep Building Your Edge</p>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                  Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Editor'}.
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Pick up where you left off and polish your creative timeline today.
                </p>
              </div>

              {/* Real Metric Stat Pills */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenAchievements}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-2 shadow-2xs hover:border-amber-300 transition text-left"
                  title="Click to inspect Editor Level & Milestones"
                >
                  <Trophy size={16} className="text-amber-600" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-amber-800">
                      Lvl {gamification.level} · {gamification.tierTitle}
                    </p>
                    <p className="text-xs font-black text-slate-950">
                      {gamification.totalXp} XP <span className="text-[10px] font-normal text-slate-500">({gamification.badges.filter((b) => b.unlocked).length}/7 Badges)</span>
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs">
                  <Flame size={16} className="text-orange-500" />
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Streak</p>
                    <p className="text-xs font-black text-slate-950">
                      {streak} {streak === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs">
                  <Clock3 size={16} className="text-blue-500" />
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Time</p>
                    <p className="text-xs font-black text-slate-950">{learningTimeStr}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Habit Momentum & 14-Day Activity Heatmap */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4.5 sm:p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Flame size={18} />
                  </span>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      14-Day Editing Momentum &amp; Habit Activity
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Daily timeline drills reinforce muscle memory and editorial instinct.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Zap size={14} className="text-amber-500" />
                    <span>
                      Momentum: {Math.min(100, Math.round((gamification.weeklyActiveCount / gamification.weeklyTarget) * 100))}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Shield
                      size={14}
                      className={gamification.hasStreakShield ? 'text-emerald-500' : 'text-slate-400'}
                    />
                    <span className="text-[11px]">
                      {gamification.hasStreakShield ? 'Streak Shield Ready' : 'Streak Shield Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 14 Days Visual Heatmap Blocks */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
                  {(gamification.recentHeatmap ?? []).map((day) => (
                    <div
                      key={day.dateStr}
                      className="flex flex-col items-center gap-1 flex-1 min-w-[34px]"
                      title={`${day.dateStr}: ${day.isActive ? 'Active session' : 'Rest day'}`}
                    >
                      <div
                        className={`h-7 w-full rounded-lg border transition-all ${
                          day.isActive
                            ? 'bg-orange-500 border-orange-600 text-white shadow-2xs'
                            : day.isToday
                            ? 'bg-slate-100 border-dashed border-orange-400'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold ${
                          day.isToday ? 'text-orange-600 font-black' : 'text-slate-400'
                        }`}
                      >
                        {day.dayLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Studio Copilot Smart Recommendations */}
            {studioRecommendations.length > 0 && (
              <div className="mb-6 rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50/40 via-white to-amber-50/40 p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-orange-100/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
                      <Lightbulb size={15} />
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-orange-950">
                        Studio Copilot · Smart Learning Advisor
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Targeted recommendations grounded in your watch history, submissions, and mentor critique scores.
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-extrabold text-orange-800 uppercase tracking-wider">
                    AI Guided
                  </span>
                </div>

                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  {studioRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex flex-col justify-between rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-3xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-wider">
                          {rec.type === 'next_lesson' ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <Compass size={12} /> Next Up
                            </span>
                          ) : rec.type === 'weak_skill' ? (
                            <span className="text-rose-600 flex items-center gap-1">
                              <AlertCircle size={12} /> Rubric Focus Area
                            </span>
                          ) : rec.type === 'deadline' ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Clock3 size={12} /> Urgent Deadline
                            </span>
                          ) : (
                            <span className="text-blue-600 flex items-center gap-1">
                              <Sparkles size={12} /> Pro Polish Tip
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-950 leading-tight">{rec.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{rec.subtitle}</p>
                      </div>

                      {rec.actionText && (
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (rec.actionType === 'navigate_lesson' && rec.targetId) {
                                const target = allLessons.find((l) => l.id === rec.targetId);
                                if (target) {
                                  selectLesson(target);
                                  handleTabChange('curriculum');
                                }
                              } else if (rec.actionType === 'navigate_assignment') {
                                handleTabChange('assignments');
                              } else if (rec.actionType === 'open_modal') {
                                onOpenAchievements();
                              } else {
                                handleTabChange('assignments');
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                          >
                            <span>{rec.actionText}</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Banner with Retry */}
            {error && (
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setRefreshKey((k) => k + 1);
                    }}
                    className="border-red-200 bg-white text-red-800 hover:bg-red-100 text-xs py-1"
                  >
                    <RefreshCw size={12} className="mr-1" /> Retry Connection
                  </Button>
                  <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-400 hover:text-red-700">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* If Student is not enrolled in any cohort */}
            {!course.cohort && !loading ? (
              user && (
                <EnrollmentPanel
                  userId={user.id}
                  userEmail={user.email}
                  userName={profile?.full_name || user.user_metadata?.full_name}
                  initialCohortId={targetCohortId || undefined}
                  autoCheckout={Boolean(searchParams.get('checkout'))}
                  onEnrolled={() => {
                    const matchedCohort = allCohorts.find((c) => c.id === targetCohortId);
                    markJustEnrolledCohort(targetCohortId || '', matchedCohort?.name);
                    clearPendingCohortCheckout();
                    onEnrollmentSuccess?.(targetCohortId || '', matchedCohort?.name);
                    setRefreshKey((k) => k + 1);
                  }}
                />
              )
            ) : (
              <>
                {/* Dynamic Sprint High-Priority Notification Banner */}
                {course.cohort && (
                  <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/50 p-4 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shrink-0">
                        <Flame size={20} className="animate-pulse" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">
                            {totalSprintDays}-Day Internship Track
                          </span>
                          <span className="rounded-full bg-orange-200/80 px-2 py-0.2 text-[9px] font-extrabold text-orange-900">
                            Day {Math.min(totalSprintDays, sprintCompletedCount + 1)} of {totalSprintDays}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-900">
                          {sprintCompletedCount >= totalSprintDays
                            ? `All ${totalSprintDays} Sprint challenges completed! Awaiting final graduation certification.`
                            : `Today's production task is live! Complete and submit your deliverable for mentor critique.`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTabChange('internship_sprint')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 px-3.5 py-2 text-xs font-black text-white shadow-sm transition shrink-0"
                    >
                      <span>Open {totalSprintDays}-Day Sprint</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Workspace Navigation Tabs */}
                <div className="mb-6 flex overflow-x-auto border-b border-slate-200 text-sm font-bold gap-4 sm:gap-6">
                  <button
                    onClick={() => handleTabChange('curriculum')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'curriculum'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Play size={16} />
                    <span>Curriculum &amp; Player</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('internship_sprint')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'internship_sprint'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Flame size={16} className={activeTab === 'internship_sprint' ? 'text-orange-500' : 'text-slate-400'} />
                    <span>Sprint Track</span>
                    <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
                      {sprintCompletedCount}/{totalSprintDays}
                    </span>
                  </button>

                  <button
                    onClick={() => handleTabChange('assignments')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'assignments'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen size={16} />
                    <span>Assignments &amp; Reviews</span>
                    {unreadFeedbackCount > 0 && (
                      <span className="flex size-4.5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white shadow-2xs animate-pulse">
                        {unreadFeedbackCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleTabChange('calendar')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'calendar'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar size={16} />
                    <span>Schedule &amp; Deadlines</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('community')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'community'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessagesSquare size={16} />
                    <span>Community Board</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('sessions')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'sessions'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Radio size={16} />
                    <span>Live Sessions ({liveSessions.length})</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('announcements')}
                    className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition ${
                      activeTab === 'announcements'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Megaphone size={16} />
                    <span>Announcements ({announcements.length})</span>
                  </button>
                </div>

                {/* TAB: Dynamic Production Sprint */}
                {activeTab === 'internship_sprint' && course.cohort && user && (
                  <SprintChallengeTracker
                    cohortId={course.cohort.id}
                    cohortName={course.cohort.name}
                    userId={user.id}
                    studentName={profile?.full_name || 'Student'}
                    sprintDays={sprintDays}
                    completedCount={sprintCompletedCount}
                    streakCount={sprintStreak}
                    overallScore={sprintScore}
                    totalDays={totalSprintDays}
                    onRefresh={() => setRefreshKey((k) => k + 1)}
                  />
                )}

                {/* TAB 1: Curriculum & Video Player */}
                {activeTab === 'curriculum' && (
                  <div>
                    {loading ? (
                      <PlayerSkeleton />
                    ) : selectedLesson ? (
                      <div>
                        <LessonPlayer
                          key={selectedLesson.id}
                          lesson={selectedLesson}
                          completed={completedIds.has(selectedLesson.id)}
                          onToggleComplete={toggleComplete}
                          prevLesson={prevLesson}
                          nextLesson={nextLesson}
                          onSelectLesson={selectLesson}
                          userId={user?.id}
                          cohortId={course.cohort?.id}
                          initialWatchPercentage={
                            course.progress.find((p) => p.lesson_id === selectedLesson.id)?.watch_percentage ?? 0
                          }
                          initialLastPositionSeconds={
                            course.progress.find((p) => p.lesson_id === selectedLesson.id)?.last_position_seconds ?? 0
                          }
                          onWatchProgressUpdate={handleWatchProgress}
                        />
                      </div>
                    ) : (
                      <EmptyState label="No lessons have been published for this cohort yet." large />
                    )}

                    {/* Milestone & Dynamic Metric Cards */}
                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                      <StatCard
                        icon={<BookOpen size={19} />}
                        label="Lessons completed"
                        value={`${completedCount}/${allLessons.length}`}
                      />
                      <StatCard
                        icon={<Clock3 size={19} />}
                        label="Estimated learning time"
                        value={learningTimeStr}
                      />
                      <StatCard
                        icon={<Sparkles size={19} />}
                        label="Current daily streak"
                        value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
                      />
                    </div>

                    <MilestonePanel
                      progressPercent={unifiedProgress ? unifiedProgress.overall.composite_percent : progressPercent}
                      completedCount={unifiedProgress ? unifiedProgress.overall.completed_milestones : completedCount}
                      totalLessons={unifiedProgress ? unifiedProgress.overall.total_milestones : allLessons.length}
                      label={unifiedProgress ? 'program milestones complete' : 'lessons complete'}
                      onViewCertificate={onOpenCertificate}
                      onViewReportCard={onOpenReportCard}
                    />
                  </div>
                )}

                {/* TAB 2: Assignments & Proof Loop */}
                {activeTab === 'assignments' && user && course.cohort && (
                  <div>
                    <AssignmentPanel
                      userId={user.id}
                      cohortId={course.cohort.id}
                      onFeedbackRead={refreshSubmissions}
                    />
                  </div>
                )}

                {/* TAB: Schedule & Deadlines Calendar */}
                {activeTab === 'calendar' && user && (
                  <div>
                    <StudentCalendar userId={user.id} cohortId={course.cohort?.id} />
                  </div>
                )}

                {/* TAB: Cohort Community Board */}
                {activeTab === 'community' && user && (
                  <div>
                    <CommunityBoard
                      userId={user.id}
                      cohortId={course.cohort?.id}
                    />
                  </div>
                )}

                {/* TAB: Live Sessions */}
                {activeTab === 'sessions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Live Mentorship</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Cohort Live Review Sessions</h2>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {liveSessions.length} {liveSessions.length === 1 ? 'Session' : 'Sessions'} Scheduled
                      </span>
                    </div>

                    {liveSessions.length ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {liveSessions.map((session) => {
                          const dateObj = new Date(session.starts_at);
                          const isUpcoming = dateObj.getTime() > nowTimestamp;

                          return (
                            <div
                              key={session.id}
                              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-orange-300 transition"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                                      isUpcoming
                                        ? 'bg-orange-50 text-orange-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    <Radio size={12} className={isUpcoming ? 'animate-pulse text-orange-600' : ''} />
                                    {isUpcoming ? 'Upcoming Live Session' : 'Past Session'}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500">
                                    {dateObj.toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>

                                <h3 className="mt-3 text-lg font-black text-slate-950">{session.title}</h3>
                                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                                  {session.description || 'Live timeline review, critique room, and Q&A with mentors.'}
                                </p>

                                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-700">
                                  <Calendar size={14} className="text-orange-500" />
                                  <span>
                                    {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-6 pt-4 border-t border-slate-100">
                                <a
                                  href={session.meeting_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
                                >
                                  <span>Join Video Room (Zoom / Meet)</span>
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                        <Radio size={28} className="mx-auto text-slate-300 mb-2" />
                        <h3 className="text-sm font-black text-slate-900">No Live Sessions Scheduled</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Check back soon! Mentors post weekly critique and Q&amp;A sessions here.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Student Announcements */}
                {activeTab === 'announcements' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Studio Dispatch</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Cohort Announcements</h2>
                      </div>
                    </div>

                    {announcements.length ? (
                      <div className="space-y-4">
                        {announcements.map((announcement) => (
                          <div
                            key={announcement.id}
                            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                  <Megaphone size={14} />
                                </span>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-black text-slate-950">{announcement.title}</h3>
                                    {announcement.cohort_id ? (
                                      <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                        {allCohorts.find((c) => c.id === announcement.cohort_id)?.name ||
                                          allCohorts.find((c) => c.id === announcement.cohort_id)?.title ||
                                          'Cohort Announcement'}
                                      </span>
                                    ) : (
                                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                        Platform Broadcast
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-slate-400">
                                {new Date(announcement.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                              {announcement.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                        <Megaphone size={28} className="mx-auto text-slate-300 mb-2" />
                        <h3 className="text-sm font-black text-slate-900">No Announcements Yet</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Instructors and mentors will broadcast milestones, updates, and reminders here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Enhanced Video Player & Resource Manager
export interface LessonPlayerProps {
  lesson: Lesson;
  completed: boolean;
  onToggleComplete: () => void;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
  userId?: string;
  cohortId?: string | null;
  initialWatchPercentage?: number;
  initialLastPositionSeconds?: number;
  onWatchProgressUpdate?: (lessonId: string, watchPercentage: number, autoCompleted: boolean) => void;
}

export function LessonPlayer({
  lesson,
  completed,
  onToggleComplete,
  prevLesson,
  nextLesson,
  onSelectLesson,
  userId,
  cohortId,
  initialWatchPercentage = 0,
  initialLastPositionSeconds = 0,
  onWatchProgressUpdate,
}: LessonPlayerProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'notes' | 'discussion'>('overview');
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [watchPercentage, setWatchPercentage] = useState<number>(initialWatchPercentage);
  const [downloadingResourceId, setDownloadingResourceId] = useState<string | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(lesson.video_url);
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(
    () => initialLastPositionSeconds > 10 && !completed
  );
  const [isRefreshingStream, setIsRefreshingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Optimistic UI for 80% watch completion and instant toggle
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean>(completed);
  useEffect(() => {
    setOptimisticCompleted(completed);
  }, [completed]);
  const effectiveCompleted = optimisticCompleted || completed || watchPercentage >= 80;

  // Video HUD feedback for keyboard interactions
  const [hudMessage, setHudMessage] = useState<{
    text: string;
    icon: 'play' | 'pause' | 'rewind' | 'forward' | 'fullscreen';
  } | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHud = useCallback(
    (text: string, icon: 'play' | 'pause' | 'rewind' | 'forward' | 'fullscreen') => {
      setHudMessage({ text, icon });
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      hudTimerRef.current = setTimeout(() => setHudMessage(null), 1200);
    },
    []
  );

  // Keyboard controls: Space (play/pause), F (fullscreen), ← / → (5s scrub)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (document.body.style.overflow === 'hidden') {
        return;
      }

      const vid = videoRef.current;
      if (!vid) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (vid.paused) {
          vid.play().catch(() => {});
          triggerHud('Playing', 'play');
        } else {
          vid.pause();
          triggerHud('Paused', 'pause');
        }
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const container = videoContainerRef.current || vid;
        if (!document.fullscreenElement) {
          if (container.requestFullscreen) {
            void container.requestFullscreen();
            triggerHud('Fullscreen', 'fullscreen');
          }
        } else {
          if (document.exitFullscreen) {
            void document.exitFullscreen();
            triggerHud('Exit Fullscreen', 'fullscreen');
          }
        }
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - 5);
        triggerHud('-5s Rewind', 'rewind');
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const dur = vid.duration || Infinity;
        vid.currentTime = Math.min(dur, vid.currentTime + 5);
        triggerHud('+5s Skip', 'forward');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [triggerHud]);

  const lastSyncTimeRef = useRef<number>(0);
  const lastKnownTimeRef = useRef<number>(initialLastPositionSeconds || 0);
  const signedAtRef = useRef<number>(Date.now());
  const isRefreshingRef = useRef<boolean>(false);
  const refreshAttemptsRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setStreamError(null);
    refreshAttemptsRef.current = 0;

    if (!lesson.video_url) {
      setResolvedVideoUrl(null);
      return;
    }
    if (isSecurableAsset(lesson.video_url)) {
      void getSecureAssetUrl(lesson.video_url)
        .then((signed) => {
          if (isMounted) {
            signedAtRef.current = Date.now();
            setResolvedVideoUrl(signed);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Initial secure asset resolution error:', err);
            setStreamError('Could not authorize video stream access. Please refresh.');
          }
        });
    } else {
      setResolvedVideoUrl(lesson.video_url);
    }
    return () => {
      isMounted = false;
    };
  }, [lesson.video_url]);

  const videoMeta = parseVideoUrl(resolvedVideoUrl);

  const refreshSignedUrl = useCallback(
    async (resumeAt?: number, autoResume = true) => {
      if (!lesson.video_url) return;
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      setIsRefreshingStream(true);

      const targetPos =
        resumeAt !== undefined
          ? resumeAt
          : videoRef.current
          ? videoRef.current.currentTime
          : lastKnownTimeRef.current;

      try {
        const freshSignedUrl = await getSecureAssetUrl(lesson.video_url, 3600);
        signedAtRef.current = Date.now();
        setResolvedVideoUrl(freshSignedUrl);
        setStreamError(null);

        if (videoRef.current) {
          const vid = videoRef.current;
          if (vid.src !== freshSignedUrl) {
            vid.src = freshSignedUrl;
          }
          vid.load();

          const restorePlayback = () => {
            if (targetPos > 0) {
              try {
                vid.currentTime = targetPos;
              } catch {
                // Ignore if media not seekable yet
              }
            }
            if (autoResume) {
              vid.play().catch(() => {});
            }
          };

          if (vid.readyState >= 1) {
            restorePlayback();
          } else {
            vid.addEventListener('loadedmetadata', restorePlayback, { once: true });
            vid.addEventListener('canplay', restorePlayback, { once: true });
          }
        }

        toast.info('Video stream re-authenticated. Resuming playback...', 'Stream Renewed');
      } catch (err: unknown) {
        console.error('Failed to renew video signed URL:', err);
        setStreamError('Playback session expired or chunk fetch failed (HTTP 403). Click below to reconnect.');
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshingStream(false);
      }
    },
    [lesson.video_url, toast]
  );

  const handleVideoError = useCallback(async () => {
    if (isRefreshingRef.current) return;

    const currentVideo = videoRef.current;
    const currentSrc = currentVideo?.src || resolvedVideoUrl || '';
    const currentPos = currentVideo?.currentTime || lastKnownTimeRef.current;

    const isSecurable = isSecurableAsset(lesson.video_url) || isSecurableAsset(currentSrc);
    if (!isSecurable) {
      setStreamError('Video could not be loaded. Please check your network connection.');
    } else if (refreshAttemptsRef.current >= 3) {
      setStreamError('Playback session expired (HTTP 403) and auto-recovery failed. Click below to reconnect.');
    } else {
      refreshAttemptsRef.current += 1;

      // Check if chunk / range request returns 403 Forbidden
      let is403 = false;
      try {
        if (currentSrc && (currentSrc.startsWith('http://') || currentSrc.startsWith('https://'))) {
          const probeRes = await fetch(currentSrc, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
          });
          if (probeRes.status === 403 || probeRes.status === 401) {
            is403 = true;
          }
        }
      } catch {
        is403 = true;
      }

      const elapsedMs = Date.now() - signedAtRef.current;
      const isExpired = elapsedMs > 50 * 60 * 1000;

      if (is403 || isExpired || isSecurable) {
        await refreshSignedUrl(currentPos, wasPlayingRef.current || true);
      }
    }
  }, [lesson.video_url, resolvedVideoUrl, refreshSignedUrl]);

  const handlePlay = () => {
    wasPlayingRef.current = true;
    setStreamError(null);
    const isSecurable = isSecurableAsset(lesson.video_url) || isSecurableAsset(resolvedVideoUrl);
    if (isSecurable && Date.now() - signedAtRef.current > 50 * 60 * 1000) {
      const cur = videoRef.current ? videoRef.current.currentTime : lastKnownTimeRef.current;
      void refreshSignedUrl(cur, true);
    }
  };

  const handlePause = () => {
    wasPlayingRef.current = false;
    if (videoRef.current) {
      lastKnownTimeRef.current = videoRef.current.currentTime;
    }
  };

  const handlePlaying = () => {
    refreshAttemptsRef.current = 0;
    setStreamError(null);
  };

  const handleDownloadResource = async (resource: LessonResource) => {
    setDownloadingResourceId(resource.id);
    try {
      const secureUrl = await getLessonResourceDownloadUrl(resource.id, resource.url);
      if (!secureUrl) throw new Error('Could not resolve download link.');
      window.open(secureUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download resource.';
      if (message.includes('LOCKED_RESOURCE')) {
        toast.error('Mark this lesson complete first to unlock this download.');
      } else if (message.includes('UNAUTHORIZED')) {
        toast.error('You must be actively enrolled in this cohort to download this file.');
      } else {
        toast.error(message, 'Download Failed');
      }
    } finally {
      setDownloadingResourceId(null);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'resources' as const, label: `Downloads & Resources (${resources.length})` },
    { id: 'notes' as const, label: 'Timeline Notes' },
    { id: 'discussion' as const, label: 'Lesson Q&A & Discussion' },
  ];

  useEffect(() => {
    void listLessonResources(lesson.id).then(setResources);
  }, [lesson.id]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const syncWatchProgress = (pct: number, currentTime: number) => {
    if (!userId) return;
    const isAutoCompleted = pct >= 80;
    if (isAutoCompleted) {
      setOptimisticCompleted(true);
    }
    // Optimistic UI: notify parent state immediately before background promise
    if (onWatchProgressUpdate) {
      onWatchProgressUpdate(lesson.id, pct, isAutoCompleted);
    }
    void updateLessonWatchProgress(userId, lesson.id, pct, currentTime, playbackSpeed);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    lastKnownTimeRef.current = cur;
    const dur = videoRef.current.duration;
    if (!dur || isNaN(dur)) return;

    const pct = Math.min(100, Math.round((cur / dur) * 100));
    if (pct > watchPercentage) {
      setWatchPercentage(pct);
    }
    if (pct >= 80 && !optimisticCompleted) {
      setOptimisticCompleted(true);
    }

    const now = Date.now();
    if (now - lastSyncTimeRef.current > 5000 || (pct >= 80 && watchPercentage < 80)) {
      lastSyncTimeRef.current = now;
      syncWatchProgress(Math.max(watchPercentage, pct), cur);
    }
  };

  const handleEnded = () => {
    setWatchPercentage(100);
    setOptimisticCompleted(true);
    if (videoRef.current) {
      syncWatchProgress(100, videoRef.current.duration || 0);
    }
  };

  const handleResumePlayback = () => {
    if (videoRef.current && initialLastPositionSeconds > 0) {
      videoRef.current.currentTime = initialLastPositionSeconds;
      lastKnownTimeRef.current = initialLastPositionSeconds;
      void videoRef.current.play().catch(() => {});
    }
    setShowResumePrompt(false);
  };

  const handleToggleComplete = () => {
    setOptimisticCompleted(!effectiveCompleted);
    onToggleComplete();
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5">
      {/* Video Display Container */}
      <div ref={videoContainerRef} className="relative aspect-video w-full overflow-hidden bg-slate-950">
        {/* Visual HUD Overlay for Space/F/Arrow shortcuts */}
        {hudMessage && (
          <div
            data-testid="video-hud-overlay"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-2.5 rounded-2xl bg-black/85 px-5 py-3 text-white backdrop-blur-md border border-white/15 shadow-2xl animate-in fade-in zoom-in-90 duration-150"
          >
            {hudMessage.icon === 'play' && <Play size={20} fill="currentColor" className="text-orange-400" />}
            {hudMessage.icon === 'pause' && (
              <div className="flex gap-1 size-5 items-center justify-center">
                <div className="w-1.5 h-4 bg-orange-400 rounded-xs" />
                <div className="w-1.5 h-4 bg-orange-400 rounded-xs" />
              </div>
            )}
            {hudMessage.icon === 'rewind' && <RotateCcw size={18} className="text-orange-400" />}
            {hudMessage.icon === 'forward' && <Sparkles size={18} className="text-orange-400" />}
            {hudMessage.icon === 'fullscreen' && <Gauge size={18} className="text-orange-400" />}
            <span className="text-xs font-mono font-bold tracking-wider uppercase">{hudMessage.text}</span>
          </div>
        )}

        {/* Floating Resume Playback Prompt */}
        {showResumePrompt && initialLastPositionSeconds > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900/90 p-3.5 text-white backdrop-blur-md border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
                <Play size={13} fill="currentColor" />
              </span>
              <div>
                <p className="text-xs font-bold">
                  Resume playback from {Math.floor(initialLastPositionSeconds / 60)}:
                  {String(Math.floor(initialLastPositionSeconds % 60)).padStart(2, '0')}?
                </p>
                <p className="text-[10px] text-slate-300">
                  Pick up where you left off during your last editing session.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResumePlayback}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-2xs"
              >
                Resume ({Math.floor(initialLastPositionSeconds / 60)}:{String(Math.floor(initialLastPositionSeconds % 60)).padStart(2, '0')})
              </button>
              <button
                type="button"
                onClick={() => setShowResumePrompt(false)}
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {videoMeta.type === 'embed' ? (
          <iframe
            src={videoMeta.embedUrl!}
            title={lesson.title}
            className="absolute inset-0 size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : videoMeta.type === 'video' ? (
          <>
            <video
              ref={videoRef}
              key={lesson.id}
              className="absolute inset-0 size-full object-contain bg-black"
              controls
              src={videoMeta.directUrl!}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={handleVideoError}
              onPlay={handlePlay}
              onPause={handlePause}
              onPlaying={handlePlaying}
            />

            {/* In-place Re-authenticating / Refreshing Overlay */}
            {isRefreshingStream && !streamError && (
              <div
                data-testid="video-reauthenticating-overlay"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white"
              >
                <RefreshCw size={28} className="animate-spin text-orange-400 mb-2" />
                <p className="text-xs font-semibold text-slate-200">Re-authenticating secure stream...</p>
                <p className="text-[11px] text-slate-400">
                  Restoring playback from your last position...
                </p>
              </div>
            )}

            {/* Stream Error / Reconnect Fallback UI */}
            {streamError && (
              <div
                data-testid="video-stream-error-overlay"
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center backdrop-blur-sm"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400 mb-3">
                  <RefreshCw size={24} className={isRefreshingStream ? 'animate-spin' : ''} />
                </div>
                <h4 className="text-base font-bold text-white">Playback Interrupted</h4>
                <p className="mt-1 text-xs text-slate-300 max-w-sm mb-4">
                  {streamError}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    refreshAttemptsRef.current = 0;
                    void refreshSignedUrl(lastKnownTimeRef.current, true);
                  }}
                  disabled={isRefreshingStream}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRefreshingStream ? 'animate-spin' : ''} />
                  {isRefreshingStream ? 'Renewing Access...' : 'Reconnect Video Stream'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/40 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 text-orange-400 backdrop-blur-md shadow-2xl mb-3">
              <Play size={28} fill="currentColor" className="ml-1" />
            </div>
            <h4 className="text-sm font-bold text-white">Video Lesson Stream</h4>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Source timeline or lesson video is being finalized by instructor.
            </p>
          </div>
        )}

        {/* Video Overlays */}
        <div className="pointer-events-none absolute top-4 left-4">
          <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Lesson {lesson.position}
          </span>
        </div>

        {lesson.duration_minutes && (
          <div className="pointer-events-none absolute top-4 right-4">
            <span className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {lesson.duration_minutes} mins
            </span>
          </div>
        )}
      </div>

      {/* Video Watch Progress & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Clock3 size={13} className="text-orange-500" />
            Watch Progress:
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 sm:w-44 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  watchPercentage >= 80 || effectiveCompleted ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700">
              {Math.max(watchPercentage, effectiveCompleted ? 100 : 0)}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {watchPercentage >= 80 || effectiveCompleted ? (
              <span className="font-bold text-emerald-600">✓ Completed (≥80% watched)</span>
            ) : (
              <span>(80% required to verify)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Keyboard shortcut guide badge */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">Space</span> Play
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">F</span> Fullscreen
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold">←/→</span> ±5s
          </div>

          {videoMeta.type === 'video' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 font-bold text-slate-600">
                <Gauge size={13} className="text-orange-500" />
                <span>Speed:</span>
              </div>
              <div className="flex items-center gap-1">
                {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`rounded-md px-2 py-0.5 font-bold transition text-[11px] ${
                      playbackSpeed === speed
                        ? 'bg-orange-500 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Details & Prev/Next Controls */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Active Lesson</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{lesson.title}</h2>
            <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-600">
              {lesson.description ??
                'Sharpen your editing reflexes, storytelling pace, and master the technical timeline craft.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(() => {
              const hasVideo = Boolean(lesson.video_url && lesson.video_url.trim().length > 0);
              const isLocked = !effectiveCompleted && hasVideo && watchPercentage < 80;

              return (
                <button
                  onClick={handleToggleComplete}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? `Watch at least 80% to mark complete (currently ${watchPercentage}%)`
                      : effectiveCompleted
                      ? 'Click to toggle incomplete'
                      : 'Mark lesson as complete'
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                    effectiveCompleted
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : isLocked
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-slate-950 text-white hover:bg-orange-600'
                  }`}
                >
                  {effectiveCompleted ? (
                    <span className="flex items-center gap-1.5">
                      <Check size={15} /> Completed
                    </span>
                  ) : isLocked ? (
                    <span className="flex items-center gap-1.5">
                      <Lock size={13} className="text-slate-400" /> Watch 80% to Complete ({watchPercentage}%)
                    </span>
                  ) : (
                    'Mark as Complete'
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Prev / Next Lesson Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between border-y border-slate-100 py-3 text-xs font-bold">
          {prevLesson ? (
            <button
              onClick={() => onSelectLesson(prevLesson)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Previous:</span> {prevLesson.title}
            </button>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <button
              onClick={() => onSelectLesson(nextLesson)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-orange-700 hover:bg-orange-100 transition"
            >
              <span className="hidden sm:inline">Next:</span> {nextLesson.title}
              <ChevronRight size={16} />
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-slate-100 text-xs sm:text-sm font-bold">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-24 pt-5 text-xs sm:text-sm leading-relaxed text-slate-600">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p>
                Watch the complete demonstration, apply the key cutting and pacing concepts in your timeline, and mark the
                lesson complete to track your streak.
              </p>
              <p className="text-slate-500">
                Completing this lesson also automatically unlocks restricted downloadable resources and sample project
                files attached below.
              </p>
            </div>
          )}

          {activeTab === 'resources' && (
            <div>
              {resources.length ? (
                <div className="space-y-3">
                  {resources.map((resource) => {
                    const isLocked = resource.visibility === 'after_completion' && !completed;

                    if (isLocked) {
                      return (
                        <div
                          key={resource.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                              <Lock size={16} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="text-xs sm:text-sm font-bold text-slate-900">{resource.name}</strong>
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Locked Resource
                                </span>
                                {resource.file_size && (
                                  <span className="text-[10px] text-slate-400">
                                    ({formatFileSize(resource.file_size)})
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-amber-700">
                                Mark this lesson as complete to unlock this download (e.g. project files, source media, or LUTs).
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={onToggleComplete}
                            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 shadow-2xs hover:bg-amber-100"
                          >
                            Mark complete to unlock
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={resource.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-orange-300"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            {getStudentResourceIcon(resource.resource_type)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-xs sm:text-sm font-bold text-slate-900">{resource.name}</strong>
                              {resource.visibility === 'after_completion' && (
                                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  ✓ Unlocked
                                </span>
                              )}
                              {resource.visibility === 'public' && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  Public Preview
                                </span>
                              )}
                              {resource.file_size && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  {formatFileSize(resource.file_size)}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] capitalize text-slate-400">
                              {resource.resource_type ? resource.resource_type.replace('_', ' ') : 'Downloadable Asset'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={downloadingResourceId === resource.id}
                          onClick={() => void handleDownloadResource(resource)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-orange-600 disabled:opacity-60 cursor-pointer"
                        >
                          {downloadingResourceId === resource.id ? (
                            <>
                              <span className="inline-block animate-spin text-[10px]">⏳</span>
                              <span>Resolving link...</span>
                            </>
                          ) : (
                            <>
                              <span>Download / Open</span>
                              <ExternalLink size={13} />
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400">No downloadable resources attached to this lesson.</p>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <p>
                Keep a dedicated notebook or editing journal to jot down timecodes, audio transition notes, and shortcut
                combinations demonstrated in this lesson.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <strong className="block font-bold text-slate-800 mb-1">Editor Pro-Tip:</strong>
                Always cut on subject action or kinetic eye-movement to disguise hard transitions and maintain viewer focus.
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="pt-2">
              <CommunityBoard
                userId={userId || ''}
                cohortId={cohortId}
                lessonId={lesson.id}
                isInlineLesson
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function getStudentResourceIcon(type?: string) {
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
      return <FileText size={16} className="text-slate-500" />;
  }
}

export function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
        {icon}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function EmptyState({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white text-center ${large ? 'px-6 py-24' : 'px-4 py-8'}`}>
      <BookOpen className="mx-auto mb-3 text-slate-300" size={large ? 30 : 22} />
      <p className="mx-auto max-w-xs text-xs sm:text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function SidebarSkeleton() {
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

export function PlayerSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-video animate-pulse bg-slate-200" />
      <div className="space-y-4 p-8">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
