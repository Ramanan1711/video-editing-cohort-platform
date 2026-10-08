import type { DailyChallenge } from '../internshipService';

/**
 * Standard representation of a single day in an internship curriculum blueprint.
 */
export type CurriculumDay = Omit<DailyChallenge, 'id' | 'cohort_id'>;

/**
 * Cohort input payload accepted by the curriculum resolver.
 * Supports partial cohort objects, database rows, or simple string names.
 */
export interface CurriculumCohortInput {
  id?: string;
  name?: string | null;
  title?: string | null;
  track_type?: 'coding' | 'non_coding' | 'general' | string | null;
  category?: string | null;
  course?: {
    category?: string | null;
    track_type?: 'coding' | 'non_coding' | 'general' | string | null;
    title?: string | null;
  } | null;
  courses?: {
    category?: string | null;
    track_type?: 'coding' | 'non_coding' | 'general' | string | null;
    title?: string | null;
  } | null;
}

