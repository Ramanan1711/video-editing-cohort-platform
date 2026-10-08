import type { CurriculumDay, CurriculumCohortInput } from './types';
import { VIDEO_EDITING_15_DAY_CURRICULUM } from './videoEditingCurriculum';
import { CODING_FULLSTACK_15_DAY_CURRICULUM } from './fullStackCodingCurriculum';
import { MOTION_GRAPHICS_15_DAY_CURRICULUM } from './motionGraphicsCurriculum';

export type { CurriculumDay, CurriculumCohortInput };
export {
  VIDEO_EDITING_15_DAY_CURRICULUM,
  CODING_FULLSTACK_15_DAY_CURRICULUM,
  MOTION_GRAPHICS_15_DAY_CURRICULUM,
};

/**
 * Backward-compatible alias for the primary 15-day curriculum.
 */
export const DEFAULT_15_DAY_CURRICULUM: CurriculumDay[] = VIDEO_EDITING_15_DAY_CURRICULUM;

/**
 * Resolves the tailored 15-day internship curriculum blueprint for a cohort.
 * Dynamically detects track from:
 * 1. cohort.track_type / cohort.course.track_type
 * 2. cohort.title / cohort.name keywords
 * 3. course category / description
 */
export function getCurriculumBlueprintForCohort(
  cohort?: CurriculumCohortInput | null | string
): CurriculumDay[] {
  if (!cohort) {
    return VIDEO_EDITING_15_DAY_CURRICULUM;
  }

  // Handle direct string name/title passed in
  if (typeof cohort === 'string') {
    const norm = cohort.toLowerCase();
    if (
      norm.includes('code') ||
      norm.includes('python') ||
      norm.includes('java') ||
      norm.includes('web') ||
      norm.includes('react') ||
      norm.includes('fullstack') ||
      norm.includes('backend') ||
      norm.includes('frontend') ||
      norm.includes('software') ||
      norm.includes('typescript') ||
      norm.includes('dev')
    ) {
      return CODING_FULLSTACK_15_DAY_CURRICULUM;
    }
    if (
      norm.includes('motion') ||
      norm.includes('3d') ||
      norm.includes('animation') ||
      norm.includes('blender') ||
      norm.includes('cinema 4d') ||
      norm.includes('c4d') ||
      norm.includes('after effects') ||
      norm.includes('vfx') ||
      norm.includes('mograph')
    ) {
      return MOTION_GRAPHICS_15_DAY_CURRICULUM;
    }
    return VIDEO_EDITING_15_DAY_CURRICULUM;
  }

  // Check explicit track_type on cohort or associated parent course
  const track = (
    cohort.track_type ||
    cohort.course?.track_type ||
    cohort.courses?.track_type ||
    ''
  ).toLowerCase();

  if (track === 'coding') {
    return CODING_FULLSTACK_15_DAY_CURRICULUM;
  }

  // Aggregate title, name, category, and course details
  const searchCorpus = [
    cohort.title || '',
    cohort.name || '',
    cohort.category || '',
    cohort.course?.title || '',
    cohort.course?.category || '',
    cohort.courses?.title || '',
    cohort.courses?.category || '',
  ]
    .join(' ')
    .toLowerCase();

  // 1. Coding & Software Cohorts
  if (
    searchCorpus.includes('code') ||
    searchCorpus.includes('python') ||
    searchCorpus.includes('java') ||
    searchCorpus.includes('web') ||
    searchCorpus.includes('react') ||
    searchCorpus.includes('fullstack') ||
    searchCorpus.includes('backend') ||
    searchCorpus.includes('frontend') ||
    searchCorpus.includes('software') ||
    searchCorpus.includes('typescript') ||
    searchCorpus.includes('dev')
  ) {
    return CODING_FULLSTACK_15_DAY_CURRICULUM;
  }

  // 2. Motion Graphics & 3D Animation Cohorts
  if (
    searchCorpus.includes('motion') ||
    searchCorpus.includes('3d') ||
    searchCorpus.includes('animation') ||
    searchCorpus.includes('blender') ||
    searchCorpus.includes('cinema 4d') ||
    searchCorpus.includes('c4d') ||
    searchCorpus.includes('after effects') ||
    searchCorpus.includes('vfx') ||
    searchCorpus.includes('mograph')
  ) {
    return MOTION_GRAPHICS_15_DAY_CURRICULUM;
  }

  // 3. Video Editing & Post-Production (Default)
  return VIDEO_EDITING_15_DAY_CURRICULUM;
}

/**
 * Convenient alias for getCurriculumBlueprintForCohort
 */
export const getCurriculumForCohort = getCurriculumBlueprintForCohort;

