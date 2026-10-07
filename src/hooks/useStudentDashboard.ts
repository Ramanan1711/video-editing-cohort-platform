import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateLearningTime,
  calculateStreak,
  getStudentCourseData,
  listAssignments,
  listCohorts,
  listModules,
  listMySubmissions,
  listStudentAnnouncements,
  listStudentLiveSessions,
  markLessonComplete,
  getStudentUnifiedProgress,
  type Assignment,
  type Cohort,
  type Lesson,
  type Module,
  type StudentAnnouncement,
  type StudentCourseData,
  type StudentLiveSession,
  type StudentUnifiedProgress,
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
import { parseDatabaseError, type AppError } from '../lib/errorHandling';
import { getStudentSprintDays, type InternshipDayStatus } from '../lib/internshipService';
import { clearPendingCohortCheckout } from '../lib/cohortCheckoutPersistence';

export interface CatalogCourseItem {
  id: string;
  title: string;
  platform: string;
  sections: number;
  lectures: number;
  progress: number;
  isLocked: boolean;
  status: 'in_progress' | 'completed' | 'paid';
  tag?: string;
  batchTag: string;
  headline: string;
  subheadline: string;
  totalVideosCount: number;
  unviewedVideoCount: number;
}

export interface UseStudentDashboardReturn {
  course: StudentCourseData;
  setCourse: React.Dispatch<React.SetStateAction<StudentCourseData>>;
  selectedCohortId: string | null;
  setSelectedCohortId: (id: string | null) => void;
  selectedLessonId: string | null;
  setSelectedLessonId: React.Dispatch<React.SetStateAction<string | null>>;
  mySubmissions: Submission[];
  cohortAssignments: Assignment[];
  liveSessions: StudentLiveSession[];
  announcements: StudentAnnouncement[];
  allCohorts: Cohort[];
  allModules: Module[];
  sprintDays: InternshipDayStatus[];
  sprintCompletedCount: number;
  totalSprintDays: number;
  unifiedProgress: StudentUnifiedProgress | null;
  sprintStreak: number;
  sprintScore: number | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  appError: AppError | null;
  setAppError: React.Dispatch<React.SetStateAction<AppError | null>>;
  failedSections: string[];
  refreshKey: number;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  engagementAlert: { title: string; message: string } | null;
  setEngagementAlert: (alert: { title: string; message: string } | null) => void;

  // Computed
  allLessons: Lesson[];
  selectedLesson: Lesson | null;
  completedIds: Set<string>;
  completedLessons: Lesson[];
  completedCount: number;
  progressPercent: number;
  catalogCourses: CatalogCourseItem[];
  streak: number;
  gamification: GamificationProfile;
  studioRecommendations: StudioRecommendation[];
  learningTimeStr: string;
  unreadFeedbackCount: number;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;

  // Actions
  refreshSubmissions: () => Promise<void>;
  selectLesson: (lesson: Lesson) => void;
  toggleComplete: () => Promise<void>;
  handleWatchProgress: (lessonId: string, watchPct: number, autoCompleted: boolean) => void;
}

const emptyCourse: StudentCourseData = {
  cohort: null,
  modules: [],
  progress: [],
  enrolledCohorts: [],
};

export function useStudentDashboard(
  userId?: string,
  initialCohortId?: string | null,
  targetCohortId?: string | null
): UseStudentDashboardReturn {
  const [course, setCourse] = useState<StudentCourseData>(emptyCourse);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(initialCohortId ?? null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [cohortAssignments, setCohortAssignments] = useState<Assignment[]>([]);
  const [liveSessions, setLiveSessions] = useState<StudentLiveSession[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [appError, setAppError] = useState<AppError | null>(null);

  const [sprintDays, setSprintDays] = useState<InternshipDayStatus[]>([]);
  const [sprintCompletedCount, setSprintCompletedCount] = useState(0);
  const [totalSprintDays, setTotalSprintDays] = useState(15);
  const [unifiedProgress, setUnifiedProgress] = useState<StudentUnifiedProgress | null>(null);
  const [sprintStreak, setSprintStreak] = useState(0);
  const [sprintScore, setSprintScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [engagementAlert, setEngagementAlert] = useState<{ title: string; message: string } | null>(null);
  const [failedSections, setFailedSections] = useState<string[]>([]);

  // Update selectedCohortId if initialCohortId changes
  useEffect(() => {
    if (initialCohortId !== undefined) {
      setSelectedCohortId(initialCohortId);
    }
  }, [initialCohortId]);

  // Fetch course, submissions, live sessions, announcements, assignments
  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    let active = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [
          courseRes,
          submissionsRes,
          sessionsRes,
          announcementsRes,
          assignmentsRes,
          allCohortsRes,
          allModulesRes,
        ] = await Promise.allSettled([
          getStudentCourseData(currentUserId, selectedCohortId ?? undefined),
          listMySubmissions(currentUserId),
          listStudentLiveSessions(),
          listStudentAnnouncements(selectedCohortId ?? undefined),
          listAssignments(selectedCohortId ?? undefined),
          listCohorts(),
          listModules(),
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

        if (allCohortsRes.status === 'fulfilled') {
          setAllCohorts(allCohortsRes.value);
        } else {
          console.warn('Cohorts load failure:', allCohortsRes.reason);
        }

        if (allModulesRes.status === 'fulfilled') {
          setAllModules(allModulesRes.value);
        } else {
          console.warn('Modules load failure:', allModulesRes.reason);
        }

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

        // Fetch dynamic internship sprint progress and unified composite progress
        if (courseRes.value.cohort) {
          if (targetCohortId && courseRes.value.cohort.id === targetCohortId) {
            clearPendingCohortCheckout();
          }
          try {
            const [sprintData, progressData] = await Promise.all([
              getStudentSprintDays(currentUserId, courseRes.value.cohort.id),
              getStudentUnifiedProgress(currentUserId, courseRes.value.cohort.id),
            ]);
            if (active) {
              setSprintDays(sprintData.days);
              setSprintCompletedCount(sprintData.completedCount);
              setSprintStreak(sprintData.streakCount);
              setSprintScore(sprintData.overallScore);
              setTotalSprintDays(sprintData.totalDays || 15);
              setUnifiedProgress(progressData);
            }
          } catch (sprintErr) {
            console.warn('Failed to load sprint or unified progress:', sprintErr);
          }
        }

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
  }, [userId, selectedCohortId, refreshKey, targetCohortId]);

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

  // Courses catalog dynamically mapped from existing cohorts in the database
  const catalogCourses = useMemo<CatalogCourseItem[]>(() => {
    let sourceCohorts: Cohort[] = [];
    if (allCohorts.length > 0) {
      sourceCohorts = allCohorts;
    } else if (course.enrolledCohorts && course.enrolledCohorts.length > 0) {
      sourceCohorts = course.enrolledCohorts;
    } else if (course.cohort) {
      sourceCohorts = [course.cohort];
    }

    const progressMap = new Map(course.progress.map((p) => [p.lesson_id, p]));
    const completedLessonIdSet = new Set(
      course.progress.filter((p) => p.completed).map((p) => p.lesson_id)
    );
    const enrolledIdSet = new Set([
      ...(course.enrolledCohorts || []).map((c) => c.id),
      ...(course.cohort ? [course.cohort.id] : []),
    ]);

    return sourceCohorts.map((cohort) => {
      const isEnrolled = enrolledIdSet.has(cohort.id);
      const isCurrentActive = course.cohort?.id === cohort.id;

      const cohortModules = allModules.filter((m) => m.cohort_id === cohort.id);
      const sectionsCount = isCurrentActive && course.modules.length > 0
        ? course.modules.length
        : cohortModules.length;

      const cohortLessons = isCurrentActive && allLessons.length > 0
        ? allLessons
        : cohortModules.flatMap((m) => m.lessons || []);

      const lecturesCount = cohortLessons.length;

      let computedProgress = 0;
      if (isCurrentActive && unifiedProgress) {
        computedProgress = unifiedProgress.overall.composite_percent;
      } else if (isEnrolled && lecturesCount > 0) {
        const completed = cohortLessons.filter((l) => completedLessonIdSet.has(l.id)).length;
        computedProgress = Math.round((completed / lecturesCount) * 100);
      } else if (isCurrentActive && progressPercent > 0) {
        computedProgress = progressPercent;
      }

      const videoLessons = cohortLessons.filter(
        (l) => Boolean(l.video_url && l.video_url.trim().length > 0) && l.status !== 'draft'
      );
      const totalVideosCount = videoLessons.length;
      const unviewedVideoLessons = videoLessons.filter((l) => {
        const p = progressMap.get(l.id);
        if (!p) return true;
        const isViewed = Boolean(p.completed || (p.watch_percentage ?? 0) > 0 || (p.last_position_seconds ?? 0) > 0);
        return !isViewed;
      });
      const unviewedVideoCount = unviewedVideoLessons.length;

      const isCourseDone = isEnrolled && computedProgress === 100;
      const status: 'in_progress' | 'completed' | 'paid' = isEnrolled
        ? isCourseDone
          ? 'completed'
          : 'in_progress'
        : 'paid';

      const cleanName = (cohort.name || 'COHORT').trim();
      const nameWithoutBatch = cleanName.replace(/^(b(?:atch)?\s*[-]?\s*\d+\s*[-]?\s*)/i, '').trim();
      const displayParts = (nameWithoutBatch || cleanName).split(/\s+/);
      const headline = displayParts.slice(0, 2).join(' ').toUpperCase();
      const subheadline = displayParts.length > 2 
        ? displayParts.slice(2).join(' ').toUpperCase() 
        : 'VIDEO EDITING COHORT';

      const batchMatch = cleanName.match(/\b(b(?:atch)?\s*[-]?\s*\d+)\b/i);
      const batchTag = batchMatch ? batchMatch[0].toUpperCase() : 'BATCH';

      return {
        id: cohort.id,
        title: cleanName,
        platform: 'ProCut Hub',
        sections: sectionsCount,
        lectures: lecturesCount,
        progress: computedProgress,
        isLocked: !isEnrolled,
        status,
        tag: isEnrolled ? 'Active Enrollment' : undefined,
        batchTag,
        headline,
        subheadline,
        totalVideosCount,
        unviewedVideoCount,
      };
    });
  }, [
    allCohorts,
    course.enrolledCohorts,
    course.cohort,
    course.modules,
    course.progress,
    allModules,
    allLessons,
    progressPercent,
    unifiedProgress,
  ]);

  const streak = useMemo(() => {
    const activityTimestamps = [
      ...course.progress.map((p) => p.completed_at),
      ...mySubmissions.map((s) => s.created_at),
    ];
    return calculateStreak(activityTimestamps);
  }, [course.progress, mySubmissions]);

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

  useEffect(() => {
    if (userId && gamification) {
      void syncGamificationProfile(userId, gamification);
    }
  }, [userId, gamification]);

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
    if (!userId) return;
    try {
      const submissionsData = await listMySubmissions(userId);
      setMySubmissions(submissionsData);
    } catch (err) {
      console.warn('Failed to refresh student submissions:', err);
    }
  }, [userId]);

  const selectLesson = (lesson: Lesson) => {
    setSelectedLessonId(lesson.id);
  };

  const toggleComplete = async () => {
    if (!userId || !selectedLesson) return;
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

    // Optimistic UI: Apply completion state locally immediately
    const rollbackCourse = course;
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

    try {
      await markLessonComplete(userId, selectedLesson.id, completed, {
        watchPercentage: currentWatchPct,
      });
    } catch (updateError) {
      // Rollback to previous course progress on mutation failure
      setCourse(rollbackCourse);
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

  const currentLessonIndex = allLessons.findIndex((l) => l.id === selectedLessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  return {
    course,
    setCourse,
    selectedCohortId,
    setSelectedCohortId,
    selectedLessonId,
    setSelectedLessonId,
    mySubmissions,
    cohortAssignments,
    liveSessions,
    announcements,
    allCohorts,
    allModules,
    sprintDays,
    sprintCompletedCount,
    totalSprintDays,
    unifiedProgress,
    sprintStreak,
    sprintScore,
    loading,
    error,
    setError,
    appError,
    setAppError,
    failedSections,
    refreshKey,
    setRefreshKey,
    engagementAlert,
    setEngagementAlert,

    allLessons,
    selectedLesson,
    completedIds,
    completedLessons,
    completedCount,
    progressPercent,
    catalogCourses,
    streak,
    gamification,
    studioRecommendations,
    learningTimeStr,
    unreadFeedbackCount,
    prevLesson,
    nextLesson,

    refreshSubmissions,
    selectLesson,
    toggleComplete,
    handleWatchProgress,
  };
}
