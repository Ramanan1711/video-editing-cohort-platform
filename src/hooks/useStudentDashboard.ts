import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateLearningTime,
  calculateStreak,
  getStudentCourseData,
  getAllUserLessonProgress,
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
  type LessonProgress,
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

export interface EnrolledCourseProgressSummary {
  cohortId: string;
  cohortName: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  isActive: boolean;
}

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
  enrolledCoursesProgress: EnrolledCourseProgressSummary[];
  enrolledUnifiedProgressMap?: Record<string, StudentUnifiedProgress>;
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
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(initialCohortId ?? targetCohortId ?? null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [cohortAssignments, setCohortAssignments] = useState<Assignment[]>([]);
  const [liveSessions, setLiveSessions] = useState<StudentLiveSession[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [allLessonProgress, setAllLessonProgress] = useState<LessonProgress[]>([]);
  const [appError, setAppError] = useState<AppError | null>(null);

  const [sprintDays, setSprintDays] = useState<InternshipDayStatus[]>([]);
  const [sprintCompletedCount, setSprintCompletedCount] = useState(0);
  const [totalSprintDays, setTotalSprintDays] = useState(15);
  const [unifiedProgress, setUnifiedProgress] = useState<StudentUnifiedProgress | null>(null);
  const [sprintStreak, setSprintStreak] = useState(0);
  const [sprintScore, setSprintScore] = useState<number | null>(null);
  const [enrolledUnifiedProgressMap, setEnrolledUnifiedProgressMap] = useState<Record<string, StudentUnifiedProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [engagementAlert, setEngagementAlert] = useState<{ title: string; message: string } | null>(null);
  const [failedSections, setFailedSections] = useState<string[]>([]);

  // Update selectedCohortId if initialCohortId or targetCohortId changes
  useEffect(() => {
    if (initialCohortId !== undefined && initialCohortId !== null) {
      setSelectedCohortId(initialCohortId);
    } else if (targetCohortId !== undefined && targetCohortId !== null) {
      setSelectedCohortId(targetCohortId);
    }
  }, [initialCohortId, targetCohortId]);

  // Fetch course, submissions, live sessions, announcements, assignments, and all enrolled progress
  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    let active = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const effectiveCohortId = selectedCohortId ?? targetCohortId ?? undefined;
        const [
          courseRes,
          submissionsRes,
          sessionsRes,
          announcementsRes,
          assignmentsRes,
          allCohortsRes,
          allModulesRes,
          allProgressRes,
        ] = await Promise.allSettled([
          getStudentCourseData(currentUserId, effectiveCohortId),
          listMySubmissions(currentUserId),
          listStudentLiveSessions(),
          listStudentAnnouncements(effectiveCohortId),
          listAssignments(effectiveCohortId),
          listCohorts(),
          listModules(),
          typeof getAllUserLessonProgress === 'function'
            ? getAllUserLessonProgress(currentUserId)
            : Promise.resolve([]),
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

        if (allProgressRes.status === 'fulfilled') {
          setAllLessonProgress(allProgressRes.value);
        } else {
          console.warn('All progress load failure:', allProgressRes.reason);
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

        const enrolledCohortsList = courseRes.value.enrolledCohorts || [];
        const progressEntries: Record<string, StudentUnifiedProgress> = {};

        // Fetch dynamic internship sprint progress and unified composite progress for active cohort
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
              setTotalSprintDays(sprintData.totalDays);
              setUnifiedProgress(progressData);
              if (progressData) {
                progressEntries[courseRes.value.cohort.id] = progressData;
              }
            }
          } catch (sprintErr) {
            console.warn('Failed to load sprint or unified progress:', sprintErr);
          }
        } else {
          setSprintDays([]);
          setSprintCompletedCount(0);
          setSprintStreak(0);
          setSprintScore(0);
          setTotalSprintDays(0);
          setUnifiedProgress(null);
        }

        // Concurrently fetch unified composite progress for all other enrolled cohorts
        const otherEnrolledCohorts = enrolledCohortsList.filter(
          (c) => c.id !== courseRes.value.cohort?.id
        );
        if (otherEnrolledCohorts.length > 0) {
          try {
            const otherResults = await Promise.allSettled(
              otherEnrolledCohorts.map((c) => getStudentUnifiedProgress(currentUserId, c.id))
            );
            otherResults.forEach((res, index) => {
              if (res.status === 'fulfilled' && res.value) {
                progressEntries[otherEnrolledCohorts[index].id] = res.value;
              }
            });
          } catch (err) {
            console.warn('Failed to load unified progress for other cohorts:', err);
          }
        }

        if (active) {
          setEnrolledUnifiedProgressMap(progressEntries);
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
    () =>
      new Set(
        course.progress
          .filter((item) => item.completed || (item.watch_percentage ?? 0) >= 80)
          .map((item) => item.lesson_id)
      ),
    [course.progress]
  );
  const completedLessons = useMemo(
    () => allLessons.filter((lesson) => completedIds.has(lesson.id)),
    [allLessons, completedIds]
  );
  const completedCount = completedLessons.length;
  const progressPercent = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  const combinedProgressMap = useMemo(() => {
    const map = new Map<string, LessonProgress>();
    for (const p of allLessonProgress) {
      map.set(p.lesson_id, p);
    }
    for (const p of course.progress) {
      map.set(p.lesson_id, p);
    }
    return map;
  }, [allLessonProgress, course.progress]);

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

    const enrolledIdSet = new Set([
      ...(course.enrolledCohorts || []).map((c) => c.id),
      ...(course.cohort ? [course.cohort.id] : []),
    ]);

    return sourceCohorts.map((cohort) => {
      const isEnrolled = enrolledIdSet.has(cohort.id);
      const isCurrentActive = course.cohort?.id === cohort.id;

      // Authoritative unified composite progress for this enrolled cohort
      const cohortUnified = enrolledUnifiedProgressMap[cohort.id] || (isCurrentActive ? unifiedProgress : null);

      const cohortModules = allModules.filter(
        (m) =>
          m.cohort_id === cohort.id ||
          (cohort.course_id && (m.course_id === cohort.course_id || m.cohort_id === cohort.course_id))
      );
      const sectionsCount = isCurrentActive && course.modules.length > 0
        ? course.modules.length
        : cohortModules.length;

      const cohortLessons = isCurrentActive && allLessons.length > 0
        ? allLessons
        : cohortModules.flatMap((m) => m.lessons || []);

      const lecturesCount = cohortUnified?.curriculum?.total_lessons && cohortUnified.curriculum.total_lessons > 0
        ? cohortUnified.curriculum.total_lessons
        : cohortLessons.length;

      let computedProgress = 0;
      if (cohortUnified) {
        computedProgress = cohortUnified.overall.composite_percent;
      } else if (isCurrentActive && unifiedProgress) {
        computedProgress = unifiedProgress.overall.composite_percent;
      } else if (isCurrentActive && progressPercent > 0) {
        computedProgress = progressPercent;
      } else if (isEnrolled && lecturesCount > 0) {
        const completed = cohortLessons.filter((l) => {
          const p = combinedProgressMap.get(l.id);
          return p && (p.completed || (p.watch_percentage ?? 0) >= 80);
        }).length;
        computedProgress = Math.round((completed / lecturesCount) * 100);
      }

      const videoLessons = cohortLessons.filter(
        (l) => Boolean(l.video_url && l.video_url.trim().length > 0) && l.status !== 'draft'
      );
      const totalVideosCount = videoLessons.length;
      const unviewedVideoLessons = videoLessons.filter((l) => {
        const p = combinedProgressMap.get(l.id);
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
    allModules,
    allLessons,
    progressPercent,
    unifiedProgress,
    enrolledUnifiedProgressMap,
    combinedProgressMap,
  ]);

  const enrolledCoursesProgress = useMemo<EnrolledCourseProgressSummary[]>(() => {
    return catalogCourses
      .filter((c) => !c.isLocked)
      .map((c) => {
        const cohortUnified = enrolledUnifiedProgressMap[c.id];
        const completedLessons = cohortUnified?.curriculum
          ? cohortUnified.curriculum.completed_lessons
          : (c.lectures > 0 ? Math.round((c.progress / 100) * c.lectures) : 0);
        const totalLessons = cohortUnified?.curriculum?.total_lessons && cohortUnified.curriculum.total_lessons > 0
          ? cohortUnified.curriculum.total_lessons
          : c.lectures;

        return {
          cohortId: c.id,
          cohortName: c.title,
          progress: c.progress,
          completedLessons,
          totalLessons,
          isActive: course.cohort?.id === c.id,
        };
      });
  }, [catalogCourses, course.cohort?.id, enrolledUnifiedProgressMap]);

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
    const rollbackUnified = unifiedProgress;
    const rollbackProgressMap = enrolledUnifiedProgressMap;
    const newProgressItem = {
      lesson_id: selectedLesson.id,
      completed,
      completed_at: completed ? new Date().toISOString() : undefined,
      watch_percentage: completed && hasVideo ? Math.max(currentWatchPct, 80) : currentWatchPct,
    };
    setCourse((current) => ({
      ...current,
      progress: [
        ...current.progress.filter((item) => item.lesson_id !== selectedLesson.id),
        newProgressItem,
      ],
    }));
    setAllLessonProgress((prev) => [
      ...prev.filter((p) => p.lesson_id !== selectedLesson.id),
      newProgressItem,
    ]);

    if (unifiedProgress) {
      const delta = completed ? 1 : -1;
      const newCompletedLessons = Math.max(0, unifiedProgress.curriculum.completed_lessons + delta);
      const totalMilestones = unifiedProgress.overall.total_milestones;
      const newCompletedMilestones = Math.max(0, unifiedProgress.overall.completed_milestones + delta);
      const newCompositePercent = totalMilestones > 0
        ? Math.min(100, Math.round((newCompletedMilestones / totalMilestones) * 100))
        : (allLessons.length ? Math.round((newCompletedLessons / allLessons.length) * 100) : 0);

      const updatedUnified: StudentUnifiedProgress = {
        ...unifiedProgress,
        curriculum: {
          ...unifiedProgress.curriculum,
          completed_lessons: newCompletedLessons,
          percent: unifiedProgress.curriculum.total_lessons > 0
            ? Math.round((newCompletedLessons / unifiedProgress.curriculum.total_lessons) * 100)
            : 0,
        },
        overall: {
          ...unifiedProgress.overall,
          completed_milestones: newCompletedMilestones,
          composite_percent: newCompositePercent,
        },
      };
      setUnifiedProgress(updatedUnified);
      if (course.cohort?.id) {
        setEnrolledUnifiedProgressMap((prev) => ({
          ...prev,
          [course.cohort!.id]: updatedUnified,
        }));
      }
    }

    try {
      await markLessonComplete(userId, selectedLesson.id, completed, {
        watchPercentage: currentWatchPct,
      });
    } catch (updateError) {
      // Rollback to previous course progress on mutation failure
      setCourse(rollbackCourse);
      setUnifiedProgress(rollbackUnified);
      setEnrolledUnifiedProgressMap(rollbackProgressMap);
      setError(updateError instanceof Error ? updateError.message : 'Unable to update lesson progress.');
    }
  };

  const handleWatchProgress = (lessonId: string, watchPct: number, autoCompleted: boolean) => {
    const effectivePct = Math.min(100, Math.max(0, Math.round(watchPct)));
    setCourse((current) => {
      const existing = current.progress.find((p) => p.lesson_id === lessonId);
      const isAlreadyCompleted = existing?.completed || false;
      const completed = isAlreadyCompleted || autoCompleted || effectivePct >= 80;

      return {
        ...current,
        progress: [
          ...current.progress.filter((p) => p.lesson_id !== lessonId),
          {
            lesson_id: lessonId,
            completed,
            completed_at: completed ? (existing?.completed_at || new Date().toISOString()) : undefined,
            watch_percentage: Math.max(existing?.watch_percentage ?? 0, effectivePct),
          },
        ],
      };
    });
    setAllLessonProgress((prev) => {
      const existing = prev.find((p) => p.lesson_id === lessonId);
      const isAlreadyCompleted = existing?.completed || false;
      const completed = isAlreadyCompleted || autoCompleted || effectivePct >= 80;
      return [
        ...prev.filter((p) => p.lesson_id !== lessonId),
        {
          lesson_id: lessonId,
          completed,
          completed_at: completed ? (existing?.completed_at || new Date().toISOString()) : undefined,
          watch_percentage: Math.max(existing?.watch_percentage ?? 0, effectivePct),
        },
      ];
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
    enrolledCoursesProgress,
    enrolledUnifiedProgressMap,
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
