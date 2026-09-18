import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileArchive,
  FileText,
  Gauge,
  Image as ImageIcon,
  Layers,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Play,
  Radio,
  Search,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  calculateLearningTime,
  calculateStreak,
  formatFileSize,
  getStudentCourseData,
  listLessonResources,
  listMySubmissions,
  listStudentAnnouncements,
  listStudentLiveSessions,
  markLessonComplete,
  parseVideoUrl,
  type Lesson,
  type LessonResource,
  type StudentAnnouncement,
  type StudentCourseData,
  type StudentLiveSession,
  type Submission,
} from '../lib/courseService';
import {
  AssignmentPanel,
  CohortDiscoveryModal,
  EnrollmentPanel,
  MilestonePanel,
} from '../components/StudentFlowPanels';
import { NotificationCenter } from '../components/NotificationCenter';
import { CertificateModal } from '../components/CertificateModal';

const emptyCourse: StudentCourseData = { cohort: null, modules: [], progress: [], enrolledCohorts: [] };

export function StudentDashboard() {
  const { user, profile, signOut } = useAuth();
  const [course, setCourse] = useState<StudentCourseData>(emptyCourse);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [liveSessions, setLiveSessions] = useState<StudentLiveSession[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [activeTab, setActiveTab] = useState<'curriculum' | 'assignments' | 'sessions' | 'announcements'>('curriculum');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [lessonSearchQuery, setLessonSearchQuery] = useState('');
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowTimestamp] = useState(() => Date.now());

  // Fetch course, submissions, live sessions, announcements
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [courseData, submissionsData, sessionsData, announcementsData] = await Promise.all([
          getStudentCourseData(user!.id, selectedCohortId ?? undefined),
          listMySubmissions(user!.id).catch(() => []),
          listStudentLiveSessions().catch(() => []),
          listStudentAnnouncements().catch(() => []),
        ]);

        if (!active) return;
        setCourse(courseData);
        setMySubmissions(submissionsData);
        setLiveSessions(sessionsData);
        setAnnouncements(announcementsData);

        // Auto select first lesson if no lesson selected or cohort changed
        const firstLessonId = courseData.modules[0]?.lessons[0]?.id ?? null;
        setSelectedLessonId((prev) => {
          if (!prev) return firstLessonId;
          const exists = courseData.modules.some((m) => m.lessons.some((l) => l.id === prev));
          return exists ? prev : firstLessonId;
        });
      } catch (fetchError: unknown) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load course data.');
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

  const learningTimeStr = useMemo(() => {
    return calculateLearningTime(completedLessons);
  }, [completedLessons]);

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
    try {
      await markLessonComplete(user.id, selectedLesson.id, completed);
      setCourse((current) => ({
        ...current,
        progress: [
          ...current.progress.filter((item) => item.lesson_id !== selectedLesson.id),
          { lesson_id: selectedLesson.id, completed, completed_at: new Date().toISOString() },
        ],
      }));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update lesson progress.');
    }
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

            {/* User Profile Badge */}
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
              <div className="flex size-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {profile?.full_name?.charAt(0) ?? 'S'}
              </div>
              <span className="max-w-28 truncate text-xs font-bold text-slate-800">{profile?.full_name ?? 'Student'}</span>
            </div>

            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Left Sidebar: Collapsible Curriculum Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-40 w-84 border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-[73px] lg:block lg:h-[calc(100vh-73px)] lg:translate-x-0`}
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
                                {lesson.duration_minutes && (
                                  <p
                                    className={`text-[10px] mt-0.5 ${
                                      isSelected ? 'text-white/80' : 'text-slate-400'
                                    }`}
                                  >
                                    {lesson.duration_minutes} mins
                                  </p>
                                )}
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs">
                  <Sparkles size={16} className="text-orange-500" />
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

            {/* Error Banner */}
            {error && (
              <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{error}</span>
                <button onClick={() => setError(null)} aria-label="Dismiss error">
                  <X size={16} />
                </button>
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
                <div className="mb-6 flex overflow-x-auto border-b border-slate-200 text-sm font-bold gap-6">
                  <button
                    onClick={() => setActiveTab('curriculum')}
                    className={`pb-3 border-b-2 flex items-center gap-2 transition ${
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
                    className={`pb-3 border-b-2 flex items-center gap-2 transition ${
                      activeTab === 'assignments'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen size={16} />
                    <span>Assignments &amp; Reviews</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('sessions')}
                    className={`pb-3 border-b-2 flex items-center gap-2 transition ${
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
                    className={`pb-3 border-b-2 flex items-center gap-2 transition ${
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
                          lesson={selectedLesson}
                          completed={completedIds.has(selectedLesson.id)}
                          onToggleComplete={toggleComplete}
                          prevLesson={prevLesson}
                          nextLesson={nextLesson}
                          onSelectLesson={selectLesson}
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
                    <AssignmentPanel userId={user.id} cohortId={course.cohort.id} />
                  </div>
                )}

                {/* TAB 3: Live Sessions Calendar */}
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
    </div>
  );
}

// Enhanced Video Player & Resource Manager
function LessonPlayer({
  lesson,
  completed,
  onToggleComplete,
  prevLesson,
  nextLesson,
  onSelectLesson,
}: {
  lesson: Lesson;
  completed: boolean;
  onToggleComplete: () => void;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'notes'>('overview');
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoMeta = parseVideoUrl(lesson.video_url);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'resources' as const, label: `Downloads & Resources (${resources.length})` },
    { id: 'notes' as const, label: 'Timeline Notes' },
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

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5">
      {/* Video Display Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
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

      {/* Video Controls Toolbar (for direct video player) */}
      {videoMeta.type === 'video' && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-600">
            <Gauge size={14} className="text-orange-500" />
            <span>Playback Speed:</span>
          </div>
          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`rounded-md px-2.5 py-1 font-bold transition ${
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
            <button
              onClick={onToggleComplete}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                completed
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-slate-950 text-white hover:bg-orange-600'
              }`}
            >
              {completed ? (
                <span className="flex items-center gap-1.5">
                  <Check size={15} /> Completed
                </span>
              ) : (
                'Mark as Complete'
              )}
            </button>
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