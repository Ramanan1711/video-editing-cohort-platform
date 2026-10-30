import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { useToast } from '../../../context/useToast';
import { parseDatabaseError, type AppError } from '../../../lib/errorHandling';
import { logAuditEvent } from '../../../lib/adminService';
import { hasAdminPermission } from '../../../lib/adminPermissions';
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
  listAllAssignments,
  listAllLessonResources,
  listCohorts,
  listCourses,
  listModules,
  reorderLessons,
  reorderModules,
  updateAssignment,
  updateCohort,
  updateLesson,
  updateLessonResource,
  updateLessonStatus,
  updateModule,
  updateModuleStatus,
  uploadCourseAsset,
  getVideoThumbnailUrl,
  adminReviewCohort,
  type Assignment,
  type Cohort,
  type CohortStatus,
  type Course,
  type Lesson,
  type LessonResource,
  type Module,
} from '../../../lib/courseService';
import {
  listDailyChallenges,
  createDailyChallenge,
  updateDailyChallenge,
  deleteDailyChallenge,
  clearCohortDailyChallenges,
  type DailyChallenge,
  type DailyChallengeInput,
} from '../../../lib/internshipService';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../../../lib/paymentService';
import {
  fetchCourseChallenges,
  deleteCourseChallenge,
  type CourseChallengeItem,
} from '../../../lib/courseChallengeService';
import type { EditorModalType, EditorState } from '../types';

import { AdminCoursesContext } from './adminCoursesContextValue';


export function AdminCoursesProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resources, setResources] = useState<LessonResource[]>([]);

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'review' | 'published' | 'archived'>('all');

  const [searchParams] = useSearchParams();
  const urlCohortId = searchParams.get('cohortId');

  const isAdmin = profile?.role === 'admin';
  const isMentor = profile?.role === 'mentor';

  const canManageCurriculum = isAdmin ? hasAdminPermission(profile?.admin_role, 'manage_curriculum') : isMentor;
  const canPublish = isAdmin ? hasAdminPermission(profile?.admin_role, 'publish_content') : false;
  const canManageCohorts = isAdmin ? hasAdminPermission(profile?.admin_role, 'manage_cohorts') : isMentor;

  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(urlCohortId || null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (urlCohortId) {
      setExpandedCohortId(urlCohortId);
    }
  }, [urlCohortId]);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadThumbnailFile, setUploadThumbnailFile] = useState<File | null>(null);

  const [challengesByCohort, setChallengesByCohort] = useState<Record<string, DailyChallenge[]>>({});
  const [cohortActiveTab, setCohortActiveTab] = useState<Record<string, 'curriculum' | 'challenges' | 'sprint'>>({});
  const [loadingChallengesCohortId, setLoadingChallengesCohortId] = useState<string | null>(null);

  const [showUploadChallengeModal, setShowUploadChallengeModal] = useState<boolean>(false);
  const [uploadModalCohortId, setUploadModalCohortId] = useState<string | undefined>(undefined);
  const [courseChallengesByCohort, setCourseChallengesByCohort] = useState<Record<string, CourseChallengeItem[]>>({});
  const [loadingCourseChallengesCohortId, setLoadingCourseChallengesCohortId] = useState<string | null>(null);

  const [bulkImportTargetCohort, setBulkImportTargetCohort] = useState<{ id: string; title: string } | null>(null);

  const loadData = async () => {
    try {
      const [cohortsRes, modulesRes, assignmentsRes, resourcesRes, coursesRes] = await Promise.all([
        listCohorts(),
        listModules(),
        listAllAssignments(),
        listAllLessonResources(),
        listCourses(),
      ]);
      setCohorts(cohortsRes);
      setModules(modulesRes);
      setAssignments(assignmentsRes);
      setResources(resourcesRes);
      setCourses(coursesRes);
      setError(null);
      setAppError(null);
      if (urlCohortId) {
        setExpandedCohortId(urlCohortId);
      } else if (cohortsRes.length > 0 && !expandedCohortId) {
        setExpandedCohortId(cohortsRes[0].id);
      }
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setAppError(parsed);
      setError(parsed.message);
    } finally {
      setLoading(false);
      setRetrying(false);
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
        setError(null);
        setAppError(null);
        if (urlCohortId) {
          setExpandedCohortId(urlCohortId);
        } else if (cohortsRes.length > 0) {
          setExpandedCohortId((current) => current || cohortsRes[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const parsed = parseDatabaseError(err);
        setAppError(parsed);
        setError(parsed.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRetrying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadTrigger, urlCohortId]);

  const handleRetry = () => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const filteredCohorts = useMemo(() => {
    const term = search.toLowerCase();
    return cohorts.filter((cohort) => {
      const matchesSearch =
        cohort.name.toLowerCase().includes(term) ||
        (cohort.description ?? '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || (cohort.status || 'published') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cohorts, search, statusFilter]);

  const totalLessons = useMemo(
    () => modules.reduce((sum, mod) => sum + mod.lessons.length, 0),
    [modules]
  );

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

  const openCohortEditor = (cohort?: Cohort) => {
    setUploadFile(null);
    setUploadThumbnailFile(null);
    if (cohort) {
      setEditor({
        type: 'cohort',
        id: cohort.id,
        courseId: cohort.course_id || (courses[0]?.id ?? ''),
        name: cohort.name,
        description: cohort.description ?? '',
        status: cohort.status ?? 'draft',
        capacity: cohort.capacity != null ? String(cohort.capacity) : '30',
        priceInr: cohort.price_inr != null ? String(cohort.price_inr) : String(DEFAULT_COHORT_FEE_INR),
        visibility: cohort.visibility ?? 'public',
        enrollmentStart: cohort.enrollment_start ? cohort.enrollment_start.slice(0, 16) : '',
        enrollmentEnd: cohort.enrollment_end ? cohort.enrollment_end.slice(0, 16) : '',
        startDate: cohort.start_date ? cohort.start_date.slice(0, 10) : '',
        endDate: cohort.end_date ? cohort.end_date.slice(0, 10) : '',
        durationDays: cohort.duration_days != null ? String(cohort.duration_days) : '15',
        reviewFeedback: cohort.review_feedback ?? '',
      });
    } else {
      setEditor({
        type: 'cohort',
        courseId: courses[0]?.id ?? '',
        name: '',
        description: '',
        status: 'draft',
        capacity: '30',
        priceInr: String(DEFAULT_COHORT_FEE_INR),
        visibility: 'public',
        enrollmentStart: '',
        enrollmentEnd: '',
        startDate: '',
        endDate: '',
        durationDays: '15',
        reviewFeedback: '',
      });
    }
  };

  const openModuleEditor = (cohortId: string, mod?: Module) => {
    setUploadFile(null);
    setUploadThumbnailFile(null);
    if (mod) {
      setEditor({
        type: 'module',
        id: mod.id,
        cohortId: mod.cohort_id || cohortId,
        courseId: mod.course_id ?? null,
        title: mod.title,
        description: mod.description ?? '',
        position: mod.position,
        status: isMentor ? 'draft' : (mod.status ?? 'published'),
      });
    } else {
      const cohortModules = modules.filter((m) => m.cohort_id === cohortId);
      setEditor({
        type: 'module',
        cohortId,
        title: '',
        description: '',
        position: cohortModules.length + 1,
        status: isMentor ? 'draft' : 'published',
      });
    }
  };

  const openLessonEditor = (moduleId: string, lesson?: Lesson) => {
    setUploadFile(null);
    setUploadThumbnailFile(null);
    if (lesson) {
      setEditor({
        type: 'lesson',
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        description: lesson.description ?? '',
        videoUrl: lesson.video_url ?? '',
        thumbnailUrl: lesson.thumbnail_url ?? '',
        durationMinutes: lesson.duration_minutes ? String(lesson.duration_minutes) : '',
        position: lesson.position,
        status: isMentor ? 'draft' : (lesson.status ?? 'draft'),
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
        thumbnailUrl: '',
        durationMinutes: '10',
        position: nextPos,
        status: 'draft',
      });
    }
  };

  const openAssignmentEditor = (lessonId: string, assignment?: Assignment, cohortId?: string) => {
    setUploadFile(null);
    if (assignment) {
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
        cohortId: cohortId || assignment.cohort_id || undefined,
        title: assignment.title,
        instructions: assignment.instructions ?? assignment.description ?? '',
        deadline: deadlineFormatted,
      });
    } else {
      const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      setEditor({
        type: 'assignment',
        lessonId,
        cohortId,
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

  const loadChallengesForCohort = async (cohortId: string) => {
    try {
      setLoadingChallengesCohortId(cohortId);
      const list = await listDailyChallenges(cohortId);
      setChallengesByCohort((prev) => ({ ...prev, [cohortId]: list }));
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to load challenges');
    } finally {
      setLoadingChallengesCohortId(null);
    }
  };

  const loadCourseChallengesForCohort = async (cohortId: string, cohortTitle?: string) => {
    try {
      setLoadingCourseChallengesCohortId(cohortId);
      const list = await fetchCourseChallenges(cohortId, cohortTitle);
      setCourseChallengesByCohort((prev) => ({ ...prev, [cohortId]: list }));
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to load course challenges');
    } finally {
      setLoadingCourseChallengesCohortId(null);
    }
  };

  const handleDeleteCourseChallenge = async (cohortId: string, challengeId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete course challenge "${title}"?`)) return;
    try {
      await deleteCourseChallenge(challengeId);
      setCourseChallengesByCohort((prev) => ({
        ...prev,
        [cohortId]: (prev[cohortId] || []).filter((c) => c.id !== challengeId),
      }));
      toast.success(`Challenge "${title}" deleted successfully.`);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to delete challenge');
    }
  };

  const handleSwitchCohortTab = (
    cohortId: string,
    tab: 'curriculum' | 'challenges' | 'sprint',
    cohortTitle?: string
  ) => {
    setCohortActiveTab((prev) => ({ ...prev, [cohortId]: tab }));
    if (tab === 'challenges' && !courseChallengesByCohort[cohortId]) {
      void loadCourseChallengesForCohort(cohortId, cohortTitle);
    } else if (tab === 'sprint' && !challengesByCohort[cohortId]) {
      void loadChallengesForCohort(cohortId);
    }
  };

  const openChallengeEditor = (cohortId: string, challenge?: DailyChallenge) => {
    setUploadFile(null);
    if (challenge) {
      setEditor({
        type: 'challenge',
        id: challenge.id,
        cohortId: challenge.cohort_id || cohortId,
        dayNumber: challenge.day_number,
        title: challenge.title,
        trackType: challenge.track_type || 'general',
        submissionType: challenge.submission_type || 'drive_link',
        deadlineHours: challenge.deadline_hours ?? 24,
        description: challenge.description || '',
        instructions: challenge.instructions || '',
        starterFilesUrl: challenge.starter_files_url || '',
        starterSourceMode: 'url',
        isPublished: challenge.is_published ?? true,
      });
    } else {
      const existing = challengesByCohort[cohortId] || [];
      const maxDay = existing.reduce((m, c) => Math.max(m, c.day_number), 0);
      setEditor({
        type: 'challenge',
        cohortId,
        dayNumber: maxDay + 1,
        title: '',
        trackType: 'general',
        submissionType: 'drive_link',
        deadlineHours: 24,
        description: '',
        instructions: '',
        starterFilesUrl: '',
        starterSourceMode: 'url',
        isPublished: true,
      });
    }
  };

  const handleDeleteChallenge = async (cohortId: string, challengeId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete challenge "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDailyChallenge(challengeId);
      setChallengesByCohort((prev) => ({
        ...prev,
        [cohortId]: (prev[cohortId] || []).filter((c) => c.id !== challengeId),
      }));
      void logAuditEvent({
        actor_id: user?.id,
        action: 'challenge.deleted',
        entity_type: 'challenge',
        entity_id: challengeId,
        metadata: { title },
      });
      const msg = `Deleted challenge "${title}" successfully.`;
      setSuccess(msg);
      toast.info(msg);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Failed to delete challenge');
    }
  };

  const handleClearCohortChallenges = async (cohortId: string, cohortTitle: string) => {
    if (!isAdmin) {
      toast.error('Wiping entire sprint tracks is restricted to platform administrators.');
      return;
    }
    const currentCount = challengesByCohort[cohortId]?.length || 0;
    if (!window.confirm(`Are you sure you want to delete ALL ${currentCount} challenges for "${cohortTitle}"? This will wipe the entire sprint track for this cohort and cannot be undone.`)) {
      return;
    }
    try {
      await clearCohortDailyChallenges(cohortId);
      setChallengesByCohort((prev) => ({
        ...prev,
        [cohortId]: [],
      }));
      void logAuditEvent({
        actor_id: user?.id,
        action: 'cohort.challenges_cleared',
        entity_type: 'cohort',
        entity_id: cohortId,
        metadata: { cohortTitle, deletedCount: currentCount },
      });
      const msg = `All ${currentCount} challenges for "${cohortTitle}" cleared successfully.`;
      setSuccess(msg);
      toast.success(msg);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Failed to clear challenges');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editor.type === 'cohort') {
        if (!editor.name.trim()) throw new Error('Cohort name is required.');
        if (editor.priceInr !== undefined && editor.priceInr !== '' && Number(editor.priceInr) <= 0) {
          throw new Error('Cohort price must be greater than zero. Free enrollment is prohibited under the platform paid-only policy.');
        }
        if (editor.startDate && editor.endDate && new Date(editor.endDate) < new Date(editor.startDate)) {
          throw new Error('Course end date cannot be earlier than course start date.');
        }

        // Mentor permission checks on cohort
        if (isMentor) {
          if (editor.id) {
            const existingCohort = cohorts.find((c) => c.id === editor.id);
            if (editor.status === 'published' && existingCohort?.status !== 'approved' && existingCohort?.status !== 'published') {
              throw new Error('Cohorts must be approved by an administrator before publishing.');
            }
          }
        }

        const cohortPayload = {
          name: editor.name.trim(),
          description: editor.description.trim() || null,
          course_id: editor.courseId || null,
          status: isMentor && !editor.id ? 'draft' : editor.status,
          capacity: Number(editor.capacity) || 30,
          price_inr: Math.max(1, Number(editor.priceInr) || DEFAULT_COHORT_FEE_INR),
          currency: DEFAULT_CURRENCY,
          visibility: editor.visibility,
          enrollment_start: editor.enrollmentStart ? new Date(editor.enrollmentStart).toISOString() : null,
          enrollment_end: editor.enrollmentEnd ? new Date(editor.enrollmentEnd).toISOString() : null,
          start_date: editor.startDate ? new Date(`${editor.startDate}T00:00:00Z`).toISOString() : null,
          end_date: editor.endDate ? new Date(`${editor.endDate}T23:59:59Z`).toISOString() : null,
          duration_days: Math.max(1, Number(editor.durationDays) || 15),
          review_feedback: isAdmin ? (editor.reviewFeedback?.trim() || null) : undefined,
          created_by: isMentor ? user?.id : undefined,
        };
        if (editor.id) {
          await updateCohort(editor.id, cohortPayload);
          void logAuditEvent({
            actor_id: user?.id,
            action: 'cohort.updated',
            entity_type: 'cohort',
            entity_id: editor.id,
            metadata: { name: editor.name, status: editor.status },
          });
          setSuccess('Cohort updated successfully.');
        } else {
          const created = await createCohort(cohortPayload);
          setExpandedCohortId(created.id);
          void logAuditEvent({
            actor_id: user?.id,
            action: 'cohort.created',
            entity_type: 'cohort',
            entity_id: created.id,
            metadata: { name: editor.name, status: isMentor ? 'draft' : editor.status },
          });
          setSuccess(isMentor ? 'Cohort proposal created in draft status.' : 'Cohort created successfully.');
        }
      } else if (editor.type === 'module') {
        if (!editor.title.trim()) throw new Error('Module title is required.');
        const moduleStatus = isMentor ? 'draft' : editor.status;
        if (editor.id) {
          await updateModule(editor.id, {
            title: editor.title.trim(),
            description: editor.description.trim() || null,
            position: Number(editor.position) || 1,
            status: moduleStatus,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'module.updated',
            entity_type: 'module',
            entity_id: editor.id,
            metadata: { title: editor.title, status: moduleStatus },
          });
          setSuccess('Module updated successfully.');
        } else {
          const createdMod = await createModule({
            cohort_id: editor.cohortId,
            course_id: editor.courseId,
            title: editor.title.trim(),
            description: editor.description.trim() || null,
            position: Number(editor.position) || 1,
            status: moduleStatus,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'module.created',
            entity_type: 'module',
            entity_id: createdMod.id,
            metadata: { title: editor.title, cohort_id: editor.cohortId, status: moduleStatus },
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

        let finalThumbnailUrl: string | null = editor.thumbnailUrl?.trim() || null;

        if (uploadThumbnailFile) {
          setUploadingStatus(`Uploading thumbnail ${uploadThumbnailFile.name}...`);
          finalThumbnailUrl = await uploadCourseAsset(uploadThumbnailFile, 'thumbnails');
          setUploadingStatus(null);
        } else if (!finalThumbnailUrl && finalVideoUrl) {
          finalThumbnailUrl = getVideoThumbnailUrl(finalVideoUrl);
        }

        const lessonStatus = isMentor ? 'draft' : editor.status;

        const payload = {
          title: editor.title.trim(),
          description: editor.description.trim() || null,
          video_url: finalVideoUrl,
          thumbnail_url: finalThumbnailUrl,
          duration_minutes: editor.durationMinutes ? Number(editor.durationMinutes) : null,
          position: Number(editor.position) || 1,
          status: lessonStatus,
        };

        if (editor.id) {
          await updateLesson(editor.id, payload);
          void logAuditEvent({
            actor_id: user?.id,
            action: 'lesson.updated',
            entity_type: 'lesson',
            entity_id: editor.id,
            metadata: { title: editor.title, status: lessonStatus },
          });
          setSuccess('Lesson updated successfully.');
        } else {
          const createdLesson = await createLesson({
            module_id: editor.moduleId,
            ...payload,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'lesson.created',
            entity_type: 'lesson',
            entity_id: createdLesson.id,
            metadata: { title: editor.title, status: lessonStatus, module_id: editor.moduleId },
          });
          setSuccess('Lesson created successfully.');
        }
      } else if (editor.type === 'assignment') {
        if (!editor.title.trim()) throw new Error('Assignment title is required.');
        const deadlineIso = editor.deadline ? new Date(editor.deadline).toISOString() : null;
        const textContent = editor.instructions.trim() || null;

        if (editor.id) {
          await updateAssignment(editor.id, {
            cohort_id: editor.cohortId,
            title: editor.title.trim(),
            instructions: textContent,
            description: textContent,
            deadline: deadlineIso,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'assignment.updated',
            entity_type: 'assignment',
            entity_id: editor.id,
            metadata: { title: editor.title, cohort_id: editor.cohortId },
          });
          setSuccess('Assignment updated successfully.');
        } else {
          const createdAssign = await createAssignment({
            lesson_id: editor.lessonId,
            cohort_id: editor.cohortId,
            title: editor.title.trim(),
            instructions: textContent,
            description: textContent,
            deadline: deadlineIso,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'assignment.created',
            entity_type: 'assignment',
            entity_id: createdAssign.id,
            metadata: { title: editor.title, lesson_id: editor.lessonId, cohort_id: editor.cohortId },
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
          void logAuditEvent({
            actor_id: user?.id,
            action: 'resource.updated',
            entity_type: 'resource',
            entity_id: editor.id,
            metadata: { name: resourceName },
          });
          setSuccess('Resource updated successfully.');
        } else {
          const createdRes = await createLessonResource({
            lesson_id: editor.lessonId,
            name: resourceName,
            url: finalUrl,
            visibility: editor.visibility,
            resource_type: resourceType,
            file_size: fileSize,
          });
          void logAuditEvent({
            actor_id: user?.id,
            action: 'resource.created',
            entity_type: 'resource',
            entity_id: createdRes.id,
            metadata: { name: resourceName, lesson_id: editor.lessonId },
          });
          setSuccess('Resource added successfully.');
        }
      } else if (editor.type === 'challenge') {
        if (!editor.title.trim()) throw new Error('Challenge title is required.');
        if (!editor.cohortId) throw new Error('Cohort ID is required.');
        if (!editor.dayNumber || editor.dayNumber < 1) throw new Error('Day number must be at least 1.');

        let finalStarterUrl = editor.starterFilesUrl.trim() || null;
        if (editor.starterSourceMode === 'upload' && uploadFile) {
          setUploadingStatus(`Uploading starter file ${uploadFile.name}...`);
          finalStarterUrl = await uploadCourseAsset(uploadFile, 'sprint-starters');
          setUploadingStatus(null);
        }

        const payload: DailyChallengeInput = {
          cohort_id: editor.cohortId,
          day_number: Number(editor.dayNumber),
          title: editor.title.trim(),
          track_type: editor.trackType,
          submission_type: editor.submissionType,
          deadline_hours: Number(editor.deadlineHours) || 24,
          description: editor.description.trim() || null,
          instructions: editor.instructions.trim() || null,
          starter_files_url: finalStarterUrl,
          is_published: editor.isPublished,
        };

        if (editor.id) {
          const updated = await updateDailyChallenge(editor.id, payload);
          setChallengesByCohort((prev) => ({
            ...prev,
            [editor.cohortId]: (prev[editor.cohortId] || [])
              .map((c) => (c.id === updated.id ? updated : c))
              .sort((a, b) => a.day_number - b.day_number),
          }));
          void logAuditEvent({
            actor_id: user?.id,
            action: 'challenge.updated',
            entity_type: 'challenge',
            entity_id: editor.id,
            metadata: { title: editor.title, day_number: editor.dayNumber },
          });
          setSuccess('Daily challenge updated successfully.');
        } else {
          const created = await createDailyChallenge(payload);
          setChallengesByCohort((prev) => ({
            ...prev,
            [editor.cohortId]: [...(prev[editor.cohortId] || []), created].sort((a, b) => a.day_number - b.day_number),
          }));
          void logAuditEvent({
            actor_id: user?.id,
            action: 'challenge.created',
            entity_type: 'challenge',
            entity_id: created.id,
            metadata: { title: editor.title, day_number: editor.dayNumber, cohort_id: editor.cohortId },
          });
          setSuccess('Daily challenge created successfully.');
        }
      }

      setEditor(null);
      setUploadFile(null);
      setUploadThumbnailFile(null);
      toast.success('Curriculum item saved successfully.');
      await loadData();
    } catch (saveError) {
      const parsed = parseDatabaseError(saveError);
      setError(parsed.message);
      toast.error(parsed.message, 'Save Failed');
    } finally {
      setSaving(false);
      setUploadingStatus(null);
    }
  };

  const handleDelete = async (type: EditorModalType, id: string, name: string) => {
    if (type === 'cohort' && !isAdmin) {
      toast.error('Deleting cohorts is restricted to platform administrators.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (type === 'cohort') await deleteCohort(id);
      if (type === 'module') await deleteModule(id);
      if (type === 'lesson') await deleteLesson(id);
      if (type === 'assignment') await deleteAssignment(id);
      if (type === 'resource') await deleteLessonResource(id);

      void logAuditEvent({
        actor_id: user?.id,
        action: `${type}.deleted`,
        entity_type: type,
        entity_id: id,
        metadata: { name },
      });

      const msg = `Deleted ${type} "${name}" successfully.`;
      setSuccess(msg);
      toast.info(msg);
      await loadData();
    } catch (deleteError) {
      const parsed = parseDatabaseError(deleteError);
      setError(parsed.message);
      toast.error(parsed.message, 'Delete Failed');
    }
  };

  const handleReorderModule = async (cohortId: string, currentMod: Module, direction: 'up' | 'down') => {
    const cohortModules = modules
      .filter((m) => m.cohort_id === cohortId)
      .sort((a, b) => a.position - b.position);
    const index = cohortModules.findIndex((m) => m.id === currentMod.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cohortModules.length) return;

    const reordered = [...cohortModules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await reorderModules({ cohortId }, reordered.map((m) => m.id));
      void logAuditEvent({
        actor_id: user?.id,
        action: 'module.reordered',
        entity_type: 'module',
        entity_id: currentMod.id,
        metadata: { title: currentMod.title, direction, new_position: targetIndex + 1 },
      });
      const msg = `Moved module "${currentMod.title}" ${direction}.`;
      setSuccess(msg);
      toast.success(msg);
      await loadData();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Reorder Failed');
    }
  };

  const handleReorderLesson = async (currentModule: Module, currentLesson: Lesson, direction: 'up' | 'down') => {
    const sortedLessons = [...currentModule.lessons].sort((a, b) => a.position - b.position);
    const index = sortedLessons.findIndex((l) => l.id === currentLesson.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedLessons.length) return;

    const reordered = [...sortedLessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await reorderLessons(currentModule.id, reordered.map((l) => l.id));
      void logAuditEvent({
        actor_id: user?.id,
        action: 'lesson.reordered',
        entity_type: 'lesson',
        entity_id: currentLesson.id,
        metadata: { title: currentLesson.title, direction, new_position: targetIndex + 1 },
      });
      const msg = `Moved lesson "${currentLesson.title}" ${direction}.`;
      setSuccess(msg);
      toast.success(msg);
      await loadData();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Reorder Failed');
    }
  };

  const handleDuplicateLesson = async (lessonId: string, title: string) => {
    try {
      await duplicateLesson(lessonId);
      void logAuditEvent({
        actor_id: user?.id,
        action: 'lesson.duplicated',
        entity_type: 'lesson',
        entity_id: lessonId,
        metadata: { title },
      });
      const msg = `Duplicated "${title}". Created copy in draft status.`;
      setSuccess(msg);
      toast.success(msg);
      await loadData();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Duplication Failed');
    }
  };

  const handleDuplicateModule = async (moduleId: string, title: string) => {
    try {
      await duplicateModule(moduleId);
      void logAuditEvent({
        actor_id: user?.id,
        action: 'module.duplicated',
        entity_type: 'module',
        entity_id: moduleId,
        metadata: { title },
      });
      const msg = `Duplicated module "${title}" and all its lessons.`;
      setSuccess(msg);
      toast.success(msg);
      await loadData();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Duplication Failed');
    }
  };

  const handleUpdateLessonStatus = async (
    lessonId: string,
    newStatus: 'draft' | 'review' | 'published' | 'archived',
    lessonTitle?: string
  ) => {
    if (isMentor && (newStatus === 'published' || newStatus === 'archived')) {
      toast.error('Only administrators can approve and publish lessons.');
      return;
    }
    try {
      await updateLessonStatus(lessonId, newStatus);
      void logAuditEvent({
        actor_id: user?.id,
        action: 'lesson.status_changed',
        entity_type: 'lesson',
        entity_id: lessonId,
        metadata: { title: lessonTitle, new_status: newStatus },
      });
      setSuccess(`Lesson status updated to "${newStatus}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lesson status.');
    }
  };

  const handleUpdateCohortStatus = async (
    cohortId: string,
    newStatus: CohortStatus,
    cohortName?: string,
    reviewFeedback?: string
  ) => {
    try {
      if (isMentor) {
        const cohort = cohorts.find((c) => c.id === cohortId);
        // Mentors can only submit draft for review, publish approved cohort, or reset rejected to draft
        if (cohort?.status === 'draft' && (newStatus === 'review' || newStatus === 'reviewing')) {
          // OK: Submitting for review
        } else if (cohort?.status === 'approved' && newStatus === 'published') {
          // OK: Publishing approved cohort
        } else if (cohort?.status === 'rejected' && newStatus === 'draft') {
          // OK: Revising draft
        } else {
          throw new Error('Mentors cannot perform this status transition. Contact Parent Super Admin or Child Super Admin.');
        }
      }

      if (isAdmin && ['reviewing', 'approved', 'rejected'].includes(newStatus)) {
        await adminReviewCohort(cohortId, newStatus as 'reviewing' | 'approved' | 'rejected', reviewFeedback);
      } else {
        await updateCohort(cohortId, { status: newStatus });
      }
      void logAuditEvent({
        actor_id: user?.id,
        action: 'cohort.status_changed',
        entity_type: 'cohort',
        entity_id: cohortId,
        metadata: { name: cohortName, new_status: newStatus, reviewFeedback },
      });
      setSuccess(`Cohort status updated to "${newStatus}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cohort status.');
    }
  };

  const handleBulkModulePublish = async (
    mod: Module,
    newStatus: 'draft' | 'review' | 'published' | 'archived'
  ) => {
    const ids = mod.lessons.map((l) => l.id);
    try {
      await Promise.all([
        updateModuleStatus(mod.id, newStatus),
        ids.length > 0 ? bulkUpdateLessonStatus(ids, newStatus) : Promise.resolve(),
      ]);
      void logAuditEvent({
        actor_id: user?.id,
        action: 'module.bulk_status_changed',
        entity_type: 'module',
        entity_id: mod.id,
        metadata: { module_title: mod.title, new_status: newStatus, lesson_count: ids.length },
      });
      setSuccess(`Module "${mod.title}" and ${ids.length} lesson(s) marked as "${newStatus}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk update module and lesson statuses.');
    }
  };

  const value = {
    user,
    profile,
    cohorts,
    courses,
    modules,
    assignments,
    resources,
    loading,
    retrying,
    saving,
    uploadingStatus,
    error,
    appError,
    success,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedCohortId,
    setExpandedCohortId,
    expandedLessonId,
    setExpandedLessonId,
    editor,
    setEditor,
    uploadFile,
    setUploadFile,
    uploadThumbnailFile,
    setUploadThumbnailFile,
    challengesByCohort,
    setChallengesByCohort,
    cohortActiveTab,
    loadingChallengesCohortId,
    showUploadChallengeModal,
    setShowUploadChallengeModal,
    uploadModalCohortId,
    setUploadModalCohortId,
    courseChallengesByCohort,
    setCourseChallengesByCohort,
    loadingCourseChallengesCohortId,
    bulkImportTargetCohort,
    setBulkImportTargetCohort,
    filteredCohorts,
    totalLessons,
    isAdmin,
    isMentor,
    assignmentsByLesson,
    resourcesByLesson,
    canManageCurriculum,
    canPublish,
    canManageCohorts,
    loadData,
    handleRetry,
    loadChallengesForCohort,
    loadCourseChallengesForCohort,
    handleDeleteCourseChallenge,
    handleSwitchCohortTab,
    openCohortEditor,
    openModuleEditor,
    openLessonEditor,
    openAssignmentEditor,
    openResourceEditor,
    openChallengeEditor,
    handleDeleteChallenge,
    handleClearCohortChallenges,
    handleSave,
    handleDelete,
    handleReorderModule,
    handleReorderLesson,
    handleDuplicateLesson,
    handleDuplicateModule,
    handleUpdateLessonStatus,
    handleUpdateCohortStatus,
    handleBulkModulePublish,
    setError,
    setSuccess,
  };

  return <AdminCoursesContext.Provider value={value}>{children}</AdminCoursesContext.Provider>;
}
