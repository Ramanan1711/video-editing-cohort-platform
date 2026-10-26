import type { VisibilityRule, ResourceType } from '../../lib/courseService';
import type { CohortStatus } from '../../lib/services/curriculumService';

export type EditorModalType = 'cohort' | 'module' | 'lesson' | 'assignment' | 'resource' | 'challenge';

export interface CohortEditorState {
  type: 'cohort';
  id?: string;
  courseId?: string;
  name: string;
  description: string;
  status: CohortStatus;
  capacity: string;
  priceInr: string;
  visibility: 'public' | 'private' | 'unlisted';
  enrollmentStart: string;
  enrollmentEnd: string;
  reviewFeedback?: string;
}

export interface ModuleEditorState {
  type: 'module';
  id?: string;
  cohortId?: string | null;
  courseId?: string | null;
  title: string;
  description: string;
  position: number;
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface LessonEditorState {
  type: 'lesson';
  id?: string;
  moduleId: string;
  title: string;
  description: string;
  videoUrl: string;
  durationMinutes: string;
  position: number;
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface AssignmentEditorState {
  type: 'assignment';
  id?: string;
  lessonId: string;
  cohortId?: string;
  title: string;
  instructions: string;
  deadline: string;
}

export interface ResourceEditorState {
  type: 'resource';
  id?: string;
  lessonId: string;
  name: string;
  url: string;
  visibility: VisibilityRule;
  resourceType: ResourceType;
  fileSize: number | null;
  sourceMode: 'upload' | 'url';
}

export interface ChallengeEditorState {
  type: 'challenge';
  id?: string;
  cohortId: string;
  dayNumber: number;
  title: string;
  trackType: 'general' | 'coding' | 'non_coding';
  submissionType: 'drive_link' | 'loom_video' | 'github_pr' | 'text' | 'file';
  deadlineHours: number;
  description: string;
  instructions: string;
  starterFilesUrl: string;
  starterSourceMode: 'upload' | 'url';
  isPublished: boolean;
}

export type EditorState =
  | CohortEditorState
  | ModuleEditorState
  | LessonEditorState
  | AssignmentEditorState
  | ResourceEditorState
  | ChallengeEditorState;

