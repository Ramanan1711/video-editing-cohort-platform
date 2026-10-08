import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  GraduationCap,
  Megaphone,
  MessagesSquare,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type {
  Cohort,
  Lesson,
  StudentAnnouncement,
  StudentCourseData,
  StudentLiveSession,
  StudentUnifiedProgress,
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
import {
  VideoScreen,
  LessonSidebar,
  ResourceList,
  AssignmentSubmitCard,
  LessonPlayer,
  StatCard,
  EmptyState,
  SidebarSkeleton,
  PlayerSkeleton,
  HabitHeatmapCard,
  StudioCopilotCard,
  LiveSessionsTab,
  AnnouncementsTab,
} from './player';

// Re-export for seamless backward compatibility across routes and tests
export {
  VideoScreen,
  LessonSidebar,
  ResourceList,
  AssignmentSubmitCard,
  LessonPlayer,
  StatCard,
  EmptyState,
  SidebarSkeleton,
  PlayerSkeleton,
  HabitHeatmapCard,
  StudioCopilotCard,
  LiveSessionsTab,
  AnnouncementsTab,
};

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
  onSelectCohort?: (cohortId: string) => void;
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
  onSelectCohort,
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
  const [nowTimestamp] = useState(() => Date.now());

  const enrolledCohortsList = useMemo(() => {
    const list: Cohort[] = [];
    const seen = new Set<string>();

    if (course.enrolledCohorts && course.enrolledCohorts.length > 0) {
      for (const c of course.enrolledCohorts) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          list.push(c);
        }
      }
    }

    if (course.cohort && !seen.has(course.cohort.id)) {
      seen.add(course.cohort.id);
      list.push(course.cohort);
    }

    return list;
  }, [course.enrolledCohorts, course.cohort]);

  const [isTransitioningCohort, setIsTransitioningCohort] = useState(false);

  useEffect(() => {
    if (isTransitioningCohort && course.cohort?.id) {
      const timer = setTimeout(() => {
        setIsTransitioningCohort(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [course.cohort?.id, isTransitioningCohort]);

  const handleSelectCohort = useCallback(
    (newCohortId: string) => {
      if (!newCohortId || newCohortId === course.cohort?.id) return;

      setIsTransitioningCohort(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('cohortId', newCohortId);
      newParams.set('view', 'player');
      setSearchParams(newParams);

      onSelectCohort?.(newCohortId);
    },
    [course.cohort?.id, onSelectCohort, searchParams, setSearchParams]
  );

  const isCohortAuthorized = useMemo(() => {
    if (!course.cohort) return false;
    const isEnrolled = (course.enrolledCohorts || []).some((c) => c.id === course.cohort?.id);
    if (!isEnrolled) return false;
    if (targetCohortId && targetCohortId !== course.cohort.id) {
      const isTargetEnrolled = (course.enrolledCohorts || []).some((c) => c.id === targetCohortId);
      if (!isTargetEnrolled) {
        return false;
      }
    }
    return true;
  }, [course.cohort, course.enrolledCohorts, targetCohortId]);

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
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active Course Switcher in Workspace Header */}
          {course.cohort && (
            <div className="flex items-center gap-2">
              <label htmlFor="workspace-course-switcher" className="sr-only">
                Active Course
              </label>
              <div className="relative inline-flex items-center">
                <div className="pointer-events-none absolute left-2.5 flex items-center text-orange-500 dark:text-orange-400">
                  <GraduationCap size={15} />
                </div>
                <select
                  id="workspace-course-switcher"
                  data-testid="workspace-course-switcher"
                  aria-label="Switch active course"
                  value={course.cohort.id}
                  onChange={(e) => handleSelectCohort(e.target.value)}
                  disabled={enrolledCohortsList.length <= 1}
                  className={`appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-7 py-1.5 text-xs font-black text-slate-900 dark:text-slate-100 shadow-2xs hover:border-orange-300 dark:hover:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition max-w-[190px] sm:max-w-[320px] truncate ${
                    enrolledCohortsList.length > 1 ? 'cursor-pointer' : 'cursor-default opacity-90'
                  }`}
                >
                  {enrolledCohortsList.map((cohort) => (
                    <option
                      key={cohort.id}
                      value={cohort.id}
                      className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 font-bold"
                    >
                      {cohort.name}
                    </option>
                  ))}
                </select>
                {enrolledCohortsList.length > 1 && (
                  <div className="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-slate-500">
                    <ChevronRight size={13} className="rotate-90" />
                  </div>
                )}
              </div>
            </div>
          )}

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
        {isCohortAuthorized && (
          <LessonSidebar
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
            course={course}
            unifiedProgress={unifiedProgress}
            progressPercent={progressPercent}
            completedCount={completedCount}
            allLessons={allLessons}
            completedIds={completedIds}
            selectedLessonId={selectedLessonId}
            onSelectLesson={selectLesson}
            loading={loading}
          />
        )}

        {/* Main Workspace Area */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <div className="mx-auto max-w-5xl">
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

            {/* If Student is not enrolled in the requested cohort */}
            {!isCohortAuthorized && !loading ? (
              user && (
                <div className="py-6">
                  <EnrollmentPanel
                    userId={user.id}
                    userEmail={user.email}
                    userName={profile?.full_name || user.user_metadata?.full_name}
                    initialCohortId={targetCohortId || course.cohort?.id || undefined}
                    autoCheckout={Boolean(searchParams.get('checkout'))}
                    onEnrolled={() => {
                      const matchedId = targetCohortId || course.cohort?.id || '';
                      const matchedCohort = allCohorts.find((c) => c.id === matchedId);
                      markJustEnrolledCohort(matchedId, matchedCohort?.name);
                      clearPendingCohortCheckout();
                      onEnrollmentSuccess?.(matchedId, matchedCohort?.name);
                      setRefreshKey((k) => k + 1);
                    }}
                  />
                </div>
              )
            ) : (
              <>
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
                <HabitHeatmapCard gamification={gamification} />

                {/* AI Studio Copilot Smart Recommendations */}
                <StudioCopilotCard
                  studioRecommendations={studioRecommendations}
                  allLessons={allLessons}
                  selectLesson={selectLesson}
                  onTabChange={handleTabChange}
                  onOpenAchievements={onOpenAchievements}
                />

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

                {/* Smooth Cross-Fade Container for Cohort Transitions */}
                <div
                  className={`transition-opacity duration-200 ${
                    isTransitioningCohort || (loading && Boolean(course.cohort))
                      ? 'opacity-60 pointer-events-none'
                      : 'opacity-100'
                  }`}
                >
                  {/* TAB: Dynamic Production Sprint */}
                  {activeTab === 'internship_sprint' && course.cohort && user && (
                    <SprintChallengeTracker
                      key={course.cohort.id}
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
                      {loading && !course.cohort ? (
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
                      key={course.cohort.id}
                      userId={user.id}
                      cohortId={course.cohort.id}
                      onFeedbackRead={refreshSubmissions}
                    />
                  </div>
                )}

                {/* TAB: Schedule & Deadlines Calendar */}
                {activeTab === 'calendar' && user && course.cohort && (
                  <div>
                    <StudentCalendar key={course.cohort.id} userId={user.id} cohortId={course.cohort.id} />
                  </div>
                )}

                {/* TAB: Cohort Community Board */}
                {activeTab === 'community' && user && course.cohort && (
                  <div>
                    <CommunityBoard
                      key={course.cohort.id}
                      userId={user.id}
                      cohortId={course.cohort.id}
                    />
                  </div>
                )}

                {/* TAB: Live Sessions */}
                {activeTab === 'sessions' && (
                  <LiveSessionsTab
                    liveSessions={liveSessions}
                    nowTimestamp={nowTimestamp}
                  />
                )}

                {/* TAB 4: Student Announcements */}
                {activeTab === 'announcements' && (
                  <AnnouncementsTab
                    announcements={announcements}
                    allCohorts={allCohorts}
                  />
                )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
