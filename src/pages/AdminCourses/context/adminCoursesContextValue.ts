import { createContext } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { useAuth } from '../../../context/useAuth';
import type {
  Assignment,
  Cohort,
  CohortStatus,
  Course,
  Lesson,
  LessonResource,
  Module,
} from '../../../lib/courseService';
import type { DailyChallenge } from '../../../lib/internshipService';
import type { CourseChallengeItem } from '../../../lib/courseChallengeService';
import type { AppError } from '../../../lib/errorHandling';
import type { EditorModalType, EditorState } from '../types';

export interface AdminCoursesContextType {
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
  cohorts: Cohort[];
  courses: Course[];
  modules: Module[];
  assignments: Assignment[];
  resources: LessonResource[];
  loading: boolean;
  retrying: boolean;
  saving: boolean;
  uploadingStatus: string | null;
  error: string | null;
  appError: AppError | null;
  success: string | null;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: 'all' | 'draft' | 'review' | 'published' | 'archived';
  setStatusFilter: (s: 'all' | 'draft' | 'review' | 'published' | 'archived') => void;
  expandedCohortId: string | null;
  setExpandedCohortId: Dispatch<SetStateAction<string | null>>;
  expandedLessonId: string | null;
  setExpandedLessonId: Dispatch<SetStateAction<string | null>>;
  editor: EditorState | null;
  setEditor: Dispatch<SetStateAction<EditorState | null>>;
  uploadFile: File | null;
  setUploadFile: Dispatch<SetStateAction<File | null>>;
  challengesByCohort: Record<string, DailyChallenge[]>;
  setChallengesByCohort: Dispatch<SetStateAction<Record<string, DailyChallenge[]>>>;
  cohortActiveTab: Record<string, 'curriculum' | 'challenges' | 'sprint'>;
  loadingChallengesCohortId: string | null;
  showUploadChallengeModal: boolean;
  setShowUploadChallengeModal: (show: boolean) => void;
  uploadModalCohortId: string | undefined;
  setUploadModalCohortId: (id: string | undefined) => void;
  courseChallengesByCohort: Record<string, CourseChallengeItem[]>;
  setCourseChallengesByCohort: Dispatch<SetStateAction<Record<string, CourseChallengeItem[]>>>;
  loadingCourseChallengesCohortId: string | null;
  bulkImportTargetCohort: { id: string; title: string } | null;
  setBulkImportTargetCohort: (target: { id: string; title: string } | null) => void;
  filteredCohorts: Cohort[];
  totalLessons: number;
  assignmentsByLesson: Map<string, Assignment[]>;
  resourcesByLesson: Map<string, LessonResource[]>;
  canManageCurriculum: boolean;
  canPublish: boolean;
  canManageCohorts: boolean;
  loadData: () => Promise<void>;
  handleRetry: () => void;
  loadChallengesForCohort: (cohortId: string) => Promise<void>;
  loadCourseChallengesForCohort: (cohortId: string, cohortTitle?: string) => Promise<void>;
  handleDeleteCourseChallenge: (cohortId: string, challengeId: string, title: string) => Promise<void>;
  handleSwitchCohortTab: (cohortId: string, tab: 'curriculum' | 'challenges' | 'sprint', cohortTitle?: string) => void;
  openCohortEditor: (cohort?: Cohort) => void;
  openModuleEditor: (cohortId: string, mod?: Module) => void;
  openLessonEditor: (moduleId: string, lesson?: Lesson) => void;
  openAssignmentEditor: (lessonId: string, assignment?: Assignment, cohortId?: string) => void;
  openResourceEditor: (lessonId: string, resource?: LessonResource) => void;
  openChallengeEditor: (cohortId: string, challenge?: DailyChallenge) => void;
  handleDeleteChallenge: (cohortId: string, challengeId: string, title: string) => Promise<void>;
  handleClearCohortChallenges: (cohortId: string, cohortTitle: string) => Promise<void>;
  handleSave: (e: FormEvent) => Promise<void>;
  handleDelete: (type: EditorModalType, id: string, name: string) => Promise<void>;
  handleReorderModule: (cohortId: string, currentMod: Module, direction: 'up' | 'down') => Promise<void>;
  handleReorderLesson: (currentModule: Module, currentLesson: Lesson, direction: 'up' | 'down') => Promise<void>;
  handleDuplicateLesson: (lessonId: string, title: string) => Promise<void>;
  handleDuplicateModule: (moduleId: string, title: string) => Promise<void>;
  handleUpdateLessonStatus: (lessonId: string, newStatus: 'draft' | 'review' | 'published' | 'archived', lessonTitle?: string) => Promise<void>;
  handleUpdateCohortStatus: (
    cohortId: string,
    newStatus: CohortStatus,
    cohortName?: string,
    reviewFeedback?: string
  ) => Promise<void>;
  handleBulkModulePublish: (mod: Module, newStatus: 'draft' | 'review' | 'published' | 'archived') => Promise<void>;
  setError: (e: string | null) => void;
  setSuccess: (s: string | null) => void;
}

export const AdminCoursesContext = createContext<AdminCoursesContextType | undefined>(undefined);

