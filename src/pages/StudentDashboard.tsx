import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Layers,
  Lightbulb,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Moon,
  Play,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Video,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import {
  calculateLearningTime,
  calculateStreak,
  formatFileSize,
  getStudentCourseData,
  listAssignments,
  listLessonResources,
  listMySubmissions,
  listStudentAnnouncements,
  listStudentLiveSessions,
  markLessonComplete,
  parseVideoUrl,
  updateLessonWatchProgress,
  type Assignment,
  type Lesson,
  type LessonResource,
  type StudentAnnouncement,
  type StudentCourseData,
  type StudentLiveSession,
  type Submission,
} from '../lib/courseService';
import {
  calculateGamificationProfile,
  syncGamificationProfile,
  type GamificationProfile,
} from '../lib/gamificationService';
import {
  generateSmartRecommendations,
  type StudioRecommendation,
} from '../lib/recommendationService';
import {
  AssignmentPanel,
  CohortDiscoveryModal,
  EnrollmentPanel,
  MilestonePanel,
} from '../components/StudentFlowPanels';
import { NotificationCenter } from '../components/NotificationCenter';
import { CertificateModal } from '../components/CertificateModal';
import { StudentCalendar } from '../components/StudentCalendar';
import { CommunityBoard } from '../components/CommunityBoard';
import { Button } from '../components/ui/Button';
import { StateFallback } from '../components/ui/StateFallback';
import { parseDatabaseError, type AppError } from '../lib/errorHandling';

const emptyCourse: StudentCourseData = { cohort: null, modules: [], progress: [], enrolledCohorts: [] };

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [course, setCourse] = useState<StudentCourseData>(emptyCourse);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [cohortAssignments, setCohortAssignments] = useState<Assignment[]>([]);
  const [liveSessions, setLiveSessions] = useState<StudentLiveSession[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [activeTab, setActiveTab] = useState<
    'curriculum' | 'assignments' | 'calendar' | 'community' | 'sessions' | 'announcements'
  >('curriculum');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);
  const [lessonSearchQuery, setLessonSearchQuery] = useState('');
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [engagementAlert, setEngagementAlert] = useState<{ title: string; message: string } | null>(null);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [nowTimestamp] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch course, submissions, live sessions, announcements, assignments
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let active = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [courseRes, submissionsRes, sessionsRes, announcementsRes, assignmentsRes] = await Promise.allSettled([
          getStudentCourseData(userId, selectedCohortId ?? undefined),
          listMySubmissions(userId),
          listStudentLiveSessions(),
          listStudentAnnouncements(),
          listAssignments(selectedCohortId ?? undefined),
        ]);

        if (!active) return;

        if (courseRes.status === 'rejected') {
          const parsed = parseDatabaseError(courseRes.reason);
          setAppError(parsed);
          throw courseRes.reason;
        }

        setAppError(null);
        const partialErrors: string[] = [];

        setCourse(courseRes.value);

        if (submissionsRes.status === 'fulfilled') {
          setMySubmissions(submissionsRes.value);
        } else {
          console.warn('Submissions load failure:', submissionsRes.reason);
          partialErrors.push('submissions');
        }

        if (sessionsRes.status === 'fulfilled') {
          setLiveSessions(sessionsRes.value);
        } else {
          console.warn('Live sessions load failure:', sessionsRes.reason);
          partialErrors.push('live sessions');
        }

        if (announcementsRes.status === 'fulfilled') {
          setAnnouncements(announcementsRes.value);
        } else {
          console.warn('Announcements load failure:', announcementsRes.reason);
        }

        if (assignmentsRes.status === 'fulfilled') {
          setCohortAssignments(assignmentsRes.value);
        } else {
          console.warn('Cohort assignments load failure:', assignmentsRes.reason);
          partialErrors.push('assignments');
        }

        setFailedSections(partialErrors);

        // Auto select first lesson if no lesson selected or cohort changed
        const firstLessonId = courseRes.value.modules[0]?.lessons[0]?.id ?? null;
        setSelectedLessonId((prev) => {
          if (!prev) return firstLessonId;
          const exists = courseRes.value.modules.some((m) => m.lessons.some((l) => l.id === prev));
          return exists ? prev : firstLessonId;
        });
      } catch (fetchError: unknown) {
        if (active) {
          const parsed = parseDatabaseError(fetchError);
          setAppError(parsed);
          setError(parsed.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, [user, selectedCohortId, refreshKey]);

  const allLessons = useMemo(() => course.modules.flatMap((module) => module.lessons), [course.modules]);
  const selectedLesson = allLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const completedIds = useMemo(
    () => new Set(course.progress.filter((item) => item.completed).map((item) => item.lesson_id)),
    [course.progress]
  );
  const completedLessons = useMemo(
    () => allLessons.filter((lesson) => completedIds.has(lesson.id)),
    [allLessons, completedIds]
  );
  const completedCount = completedLessons.length;
  const progressPercent = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  // Real computed metrics
  const streak = useMemo(() => {
    const activityTimestamps = [
      ...course.progress.map((p) => p.completed_at),
      ...mySubmissions.map((s) => s.created_at),
    ];
    return calculateStreak(activityTimestamps);
  }, [course.progress, mySubmissions]);

  // Gamification Profile & Badges
  const gamification: GamificationProfile = useMemo(() => {
    const allReplies = mySubmissions.flatMap((s) =>
      (s.feedback_history ?? []).flatMap((f) => f.replies ?? [])
    );
    return calculateGamificationProfile(
      course.progress,
      mySubmissions,
      allReplies,
      streak
    );
  }, [course.progress, mySubmissions, streak]);

  // Sync gamification in background (non-blocking)
  useEffect(() => {
    if (user?.id && gamification) {
      void syncGamificationProfile(user.id, gamification);
    }
  }, [user?.id, gamification]);

  // Smart Studio AI Recommendations
  const studioRecommendations: StudioRecommendation[] = useMemo(() => {
    return generateSmartRecommendations(
      course.modules,
      course.progress,
      cohortAssignments,
      mySubmissions
    );
  }, [course.modules, course.progress, cohortAssignments, mySubmissions]);

  const learningTimeStr = useMemo(() => {
    return calculateLearningTime(completedLessons);
  }, [completedLessons]);

  const unreadFeedbackCount = useMemo(() => {
    let count = 0;
    for (const sub of mySubmissions) {
      for (const item of sub.feedback_history ?? []) {
        if (!item.student_read_at) {
          count++;
        }
      }
    }
    return count;
  }, [mySubmissions]);

  const refreshSubmissions = useCallback(async () => {
    if (!user) return;
    try {
      const submissionsData = await listMySubmissions(user.id);
      setMySubmissions(submissionsData);
    } catch (err) {
      console.warn('Failed to refresh student submissions:', err);
    }
  }, [user]);

  const selectLesson = (lesson: Lesson) => {
    setSelectedLessonId(lesson.id);
    setActiveTab('curriculum');
    setSidebarOpen(false);
  };

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const toggleComplete = async () => {
    if (!user || !selectedLesson) return;
    const completed = !completedIds.has(selectedLesson.id);
    const existing = course.progress.find((item) => item.lesson_id === selectedLesson.id);
    const currentWatchPct = existing?.watch_percentage ?? 0;
    const hasVideo = Boolean(selectedLesson.video_url && selectedLesson.video_url.trim().length > 0);

    if (completed && hasVideo && currentWatchPct < 80) {
      setEngagementAlert({
        title: 'Video Watch Verification Required',
        message: `You have currently watched ${currentWatchPct}% of "${selectedLesson.title}". CUT / CRAFT requires at least 80% verified video watch progress before marking a lesson complete and issuing milestone credits.`,
      });
      return;
    }

    try {
      await markLessonComplete(user.id, selectedLesson.id, completed, {
        watchPercentage: currentWatchPct,
      });
      setCourse((current) => ({
        ...current,
        progress: [
          ...current.progress.filter((item) => item.lesson_id !== selectedLesson.id),
          {
            lesson_id: selectedLesson.id,
            completed,
            completed_at: completed ? new Date().toISOString() : undefined,
            watch_percentage: completed && hasVideo ? Math.max(currentWatchPct, 80) : currentWatchPct,
          },
        ],
      }));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update lesson progress.');
    }
  };

  const handleWatchProgress = (lessonId: string, watchPct: number, autoCompleted: boolean) => {
    setCourse((current) => {
      const existing = current.progress.find((p) => p.lesson_id === lessonId);
      const isAlreadyCompleted = existing?.completed || false;
      const completed = isAlreadyCompleted || autoCompleted;

      return {
        ...current,
        progress: [
          ...current.progress.filter((p) => p.lesson_id !== lessonId),
          {
            lesson_id: lessonId,
            completed,
            completed_at: completed ? (existing?.completed_at || new Date().toISOString()) : undefined,
            watch_percentage: Math.max(existing?.watch_percentage ?? 0, watchPct),
          },
        ],
      };
    });
  };

  // Prev / Next Lesson Navigation
  const currentLessonIndex = allLessons.findIndex((l) => l.id === selectedLessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  // Search filtered modules
  const filteredModules = useMemo(() => {
    if (!lessonSearchQuery.trim()) return course.modules;
    const query = lessonSearchQuery.toLowerCase();
    return course.modules
      .map((mod) => ({
        ...mod,
        lessons: mod.lessons.filter(
          (l) => l.title.toLowerCase().includes(query) || l.description?.toLowerCase().includes(query)
        ),
      }))
      .filter((mod) => mod.lessons.length > 0);
  }, [course.modules, lessonSearchQuery]);

  // Guard 1: Missing Session / Unauthenticated User
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-6">
        <StateFallback
          type="stale-auth"
          title="Sign In Required"
          description="Please sign in to access your video editing timeline, assignments, and cohort workspace."
          actionText="Sign In"
          onAction={() => navigate('/login')}
        />
      </div>
    );
  }

  // Guard 2: Initial Platform Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex h-[41px] max-w-[1440px] items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-orange-500/20 animate-pulse" />
              <div className="h-4 w-28 rounded-lg bg-slate-200 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 rounded-full bg-slate-100 animate-pulse" />
              <div className="size-8 rounded-full bg-slate-100 animate-pulse" />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-5xl py-12 px-6">
          <div className="mb-4 h-6 w-48 rounded-lg bg-slate-200 animate-pulse" />
          <div className="mb-8 h-10 w-80 rounded-xl bg-slate-200 animate-pulse" />
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="h-24 rounded-2xl bg-white border border-slate-100 p-4 shadow-2xs animate-pulse" />
            <div className="h-24 rounded-2xl bg-white border border-slate-100 p-4 shadow-2xs animate-pulse" />
            <div className="h-24 rounded-2xl bg-white border border-slate-100 p-4 shadow-2xs animate-pulse" />
          </div>
          <div className="h-96 rounded-3xl bg-white border border-slate-100 shadow-2xs animate-pulse" />
        </div>
      </div>
    );
  }

  // Guard 3: Fatal Error / Connection / Permission / Migration Failure
  if (appError) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex h-[41px] max-w-[1440px] items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white font-black text-xs">
                C
              </span>
              <span className="text-sm font-black tracking-tight text-slate-950">CUT / CRAFT</span>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-2xl py-16 px-6">
          <StateFallback
            appError={appError}
            onAction={() => {
              setAppError(null);
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    );
  }

  // Guard 4: Empty Dataset (User enrolled in zero cohorts)
  if (!course.cohort && course.enrolledCohorts.length === 0) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex h-[41px] max-w-[1440px] items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white font-black text-xs">
                C
              </span>
              <span className="text-sm font-black tracking-tight text-slate-950">CUT / CRAFT</span>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-2xl py-16 px-6 text-center">
          <StateFallback
            type="empty"
            title="Welcome to CUT / CRAFT Cohort Studio"
            description="You are not currently enrolled in an active video editing cohort. Discover open cohorts to unlock weekly modules, timeline assignments, and mentor feedback."
            actionText="Explore Open Cohorts"
            onAction={() => setDiscoveryModalOpen(true)}
          />
          {discoveryModalOpen && (
            <CohortDiscoveryModal
              userId={user.id}
              isOpen={discoveryModalOpen}
              onClose={() => setDiscoveryModalOpen(false)}
              currentCohortId={undefined}
              onSelectCohort={(cohortId) => {
                setSelectedCohortId(cohortId);
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[73px] max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Open course navigation"
            >
              <Menu size={21} />
            </button>
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">CUT / CRAFT</p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">
                Student Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cohort Switcher / Discovery Button */}
            {course.cohort && (
              <div className="flex items-center gap-1.5">
                {course.enrolledCohorts.length > 1 ? (
                  <div className="relative">
                    <select
                      value={course.cohort.id}
                      onChange={(e) => setSelectedCohortId(e.target.value)}
                      className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none hover:bg-slate-100 focus:border-orange-400"
                    >
                      {course.enrolledCohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
                  </div>
                ) : (
                  <span className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 md:inline-block">
                    {course.cohort.name}
                  </span>
                )}

                <button
                  onClick={() => setDiscoveryModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                  title="Discover other cohorts"
                >
                  <Layers size={14} className="text-orange-500" />
                  <span className="hidden sm:inline">Explore Cohorts</span>
                </button>
              </div>
            )}

            {/* Gamification Level & XP Badge */}
            <button
              type="button"
              onClick={() => setAchievementsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 to-orange-50/90 px-3 py-1.5 text-xs font-bold text-amber-950 transition hover:border-amber-300 hover:shadow-xs"
              title="View Editor Level & Achievements"
            >
              <div className="flex size-6 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
                <Trophy size={13} />
              </div>
              <div className="text-left hidden md:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[10px] uppercase font-black tracking-wider text-orange-600">
                    Lvl {gamification.level}
                  </span>
                  <span className="text-[11px] font-black text-slate-800 truncate max-w-28">
                    {gamification.tierTitle}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-amber-200/70">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-300"
                      style={{
                        width: `${gamification.progressPercent}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-500">{gamification.totalXp} XP</span>
                </div>
              </div>
            </button>

            {/* Notification Center */}
            {user && <NotificationCenter userId={user.id} />}

            {/* Role Links */}
            {profile?.role === 'admin' && (
              <Link
                to="/admin/courses"
                className="hidden rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 sm:inline-block"
              >
                Admin
              </Link>
            )}
            {profile?.role === 'mentor' && (
              <Link
                to="/review/submissions"
                className="hidden rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 sm:inline-block"
              >
                Review Queue
              </Link>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle color theme"
            >
              {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>

            {/* User Profile Badge */}
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900 sm:flex">
              <div className="flex size-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-950/60 dark:text-orange-400">
                {profile?.full_name?.charAt(0) ?? 'S'}
              </div>
              <span className="max-w-28 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{profile?.full_name ?? 'Student'}</span>
            </div>

            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 transition"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="sticky top-[73px] z-30 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-400 px-4 py-2 text-center text-xs font-bold text-amber-950 shadow-sm">
          <WifiOff size={15} />
          <span>
            You are currently offline. Lessons and downloaded media remain accessible; submissions and watch milestones will sync when reconnected.
          </span>
        </div>
      )}

      {/* Partial Data Load Warning Banner */}
      {failedSections.length > 0 && (
        <div className="sticky top-[73px] z-30 flex items-center justify-between gap-3 border-b border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-950 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-orange-600 shrink-0" />
            <span>
              Some platform data could not be refreshed ({failedSections.join(', ')}). Your current work is safe.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-orange-700 transition shrink-0"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px]">
        {/* Left Sidebar: Collapsible Curriculum Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-40 w-84 border-r border-slate-200 bg-white transition-transform flex flex-col lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:translate-x-0 dark:border-slate-800 dark:bg-slate-950`}
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
              <span className="text-slate-500">Overall Progress</span>
              <span className="text-orange-600">{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>
                {completedCount} of {allLessons.length} lessons complete
              </span>
              {progressPercent === 100 && allLessons.length > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                  <Award size={13} /> Completed
                </span>
              )}
            </div>
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
          <nav className="flex-1 overflow-y-auto p-4 space-y-3">
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
                                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
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

          {/* Mobile Footer: Theme Toggle & Sign out */}
          <div className="border-t border-slate-100 p-4 dark:border-slate-800/80 lg:hidden flex items-center justify-between">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-lg p-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle color theme"
            >
              {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
              <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
            </button>

            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-lg p-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </div>
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
                  onClick={() => setAchievementsModalOpen(true)}
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
                  {gamification.recentHeatmap.map((day) => (
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
                                if (target) selectLesson(target);
                              } else if (rec.actionType === 'navigate_assignment') {
                                setActiveTab('assignments');
                              } else if (rec.actionType === 'open_modal') {
                                setAchievementsModalOpen(true);
                              } else {
                                setActiveTab('assignments');
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
                  onEnrolled={() => {
                    setRefreshKey((k) => k + 1);
                  }}
                />
              )
            ) : (
              <>
                {/* Workspace Navigation Tabs */}
                <div className="mb-6 flex overflow-x-auto border-b border-slate-200 text-sm font-bold gap-4 sm:gap-6">
                  <button
                    onClick={() => setActiveTab('curriculum')}
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
                    onClick={() => setActiveTab('assignments')}
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
                    onClick={() => setActiveTab('calendar')}
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
                    onClick={() => setActiveTab('community')}
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
                    onClick={() => setActiveTab('sessions')}
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
                    onClick={() => setActiveTab('announcements')}
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
                      progressPercent={progressPercent}
                      completedCount={completedCount}
                      totalLessons={allLessons.length}
                      onViewCertificate={() => setCertificateModalOpen(true)}
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
                                <h3 className="text-base font-black text-slate-950">{announcement.title}</h3>
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

      {/* Cohort Discovery / Switcher Modal */}
      {user && (
        <CohortDiscoveryModal
          userId={user.id}
          isOpen={discoveryModalOpen}
          onClose={() => setDiscoveryModalOpen(false)}
          currentCohortId={course.cohort?.id}
          onSelectCohort={(cohortId) => {
            setSelectedCohortId(cohortId);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Certificate Modal */}
      {user && course.cohort && (
        <CertificateModal
          isOpen={certificateModalOpen}
          onClose={() => setCertificateModalOpen(false)}
          studentName={profile?.full_name || 'Student'}
          cohortName={course.cohort.name}
          cohortId={course.cohort.id}
          studentId={user.id}
        />
      )}

      {/* Engagement & Watch Progress Warning Modal */}
      {engagementAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">{engagementAlert.title}</h3>
                <p className="text-[11px] font-bold text-amber-700">Watch Verification Required</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {engagementAlert.message}
            </p>
            <div className="mt-5 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setEngagementAlert(null)}>
                Understood, Continue Watching
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Progression & Milestone Achievements Modal */}
      {achievementsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">
                    Level {gamification.level}: {gamification.tierTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Challenge progression milestones &amp; master editor achievements.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAchievementsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Level XP Progress Bar */}
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-amber-950 mb-2">
                <span>XP Progression</span>
                <span>
                  {gamification.totalXp} / {gamification.nextLevelXp || 'Max'} XP
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                  style={{
                    width: `${gamification.progressPercent}%`,
                  }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Next Rank:{' '}
                  <strong>
                    {gamification.level >= 5
                      ? 'Master Lead Editor (Max Level)'
                      : `Level ${gamification.level + 1} • ${gamification.nextTierTitle}`}
                  </strong>
                </span>
                <span>
                  {gamification.nextLevelXp && gamification.totalXp < gamification.nextLevelXp
                    ? `${gamification.nextLevelXp - gamification.totalXp} XP to next level`
                    : 'Max rank achieved!'}
                </span>
              </div>
            </div>

            {/* Milestone Badges Grid */}
            <div className="mt-6">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                Milestone Badges ({gamification.badges.filter((b) => b.unlocked).length} of{' '}
                {gamification.badges.length} Unlocked)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {gamification.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                      badge.unlocked
                        ? 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-white text-slate-900 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/60 opacity-60'
                    }`}
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base ${
                        badge.unlocked ? 'bg-amber-100' : 'bg-slate-200'
                      }`}
                    >
                      {badge.category === 'craft' ? (
                        <Award size={18} className="text-amber-600" />
                      ) : badge.category === 'consistency' ? (
                        <Flame size={18} className="text-orange-500" />
                      ) : badge.category === 'timeline' ? (
                        <Layers size={18} className="text-blue-500" />
                      ) : (
                        <Sparkles size={18} className="text-purple-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h5 className="text-xs font-bold text-slate-950 truncate">{badge.name}</h5>
                        {badge.unlocked ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800 uppercase">
                            Unlocked
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400">
                            <Lock size={9} /> Locked
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <Button size="sm" variant="secondary" onClick={() => setAchievementsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Video Player & Resource Manager
interface LessonPlayerProps {
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

function LessonPlayer({
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
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'notes' | 'discussion'>('overview');
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [watchPercentage, setWatchPercentage] = useState<number>(initialWatchPercentage);
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(
    () => initialLastPositionSeconds > 10 && !completed
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncTimeRef = useRef<number>(0);

  const videoMeta = parseVideoUrl(lesson.video_url);

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
    void updateLessonWatchProgress(userId, lesson.id, pct, currentTime);
    if (onWatchProgressUpdate) {
      onWatchProgressUpdate(lesson.id, pct, isAutoCompleted);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    if (!dur || isNaN(dur)) return;

    const pct = Math.min(100, Math.round((cur / dur) * 100));
    if (pct > watchPercentage) {
      setWatchPercentage(pct);
    }

    const now = Date.now();
    if (now - lastSyncTimeRef.current > 5000 || (pct >= 80 && watchPercentage < 80)) {
      lastSyncTimeRef.current = now;
      syncWatchProgress(Math.max(watchPercentage, pct), cur);
    }
  };

  const handleEnded = () => {
    setWatchPercentage(100);
    if (videoRef.current) {
      syncWatchProgress(100, videoRef.current.duration || 0);
    }
  };

  const handleResumePlayback = () => {
    if (videoRef.current && initialLastPositionSeconds > 0) {
      videoRef.current.currentTime = initialLastPositionSeconds;
      void videoRef.current.play().catch(() => {});
    }
    setShowResumePrompt(false);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5">
      {/* Video Display Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
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
          <video
            ref={videoRef}
            key={videoMeta.directUrl}
            className="absolute inset-0 size-full object-contain bg-black"
            controls
            src={videoMeta.directUrl!}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
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
                  watchPercentage >= 80 || completed ? 'bg-emerald-500' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.max(watchPercentage, completed ? 100 : 0)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700">
              {Math.max(watchPercentage, completed ? 100 : 0)}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {watchPercentage >= 80 || completed ? (
              <span className="font-bold text-emerald-600">✓ Completed (≥80% watched)</span>
            ) : (
              <span>(80% required to verify)</span>
            )}
          </span>
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
              const isLocked = !completed && hasVideo && watchPercentage < 80;

              return (
                <button
                  onClick={onToggleComplete}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? `Watch at least 80% to mark complete (currently ${watchPercentage}%)`
                      : completed
                      ? 'Click to toggle incomplete'
                      : 'Mark lesson as complete'
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                    completed
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : isLocked
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-slate-950 text-white hover:bg-orange-600'
                  }`}
                >
                  {completed ? (
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

                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-orange-600"
                        >
                          <span>Download / Open</span>
                          <ExternalLink size={13} />
                        </a>
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

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

function EmptyState({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white text-center ${large ? 'px-6 py-24' : 'px-4 py-8'}`}>
      <BookOpen className="mx-auto mb-3 text-slate-300" size={large ? 30 : 22} />
      <p className="mx-auto max-w-xs text-xs sm:text-sm text-slate-500">{label}</p>
    </div>
  );
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

function PlayerSkeleton() {
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