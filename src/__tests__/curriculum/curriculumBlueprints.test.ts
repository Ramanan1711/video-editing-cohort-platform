import { describe, it, expect } from 'vitest';
import {
  VIDEO_EDITING_15_DAY_CURRICULUM,
  CODING_FULLSTACK_15_DAY_CURRICULUM,
  MOTION_GRAPHICS_15_DAY_CURRICULUM,
  DEFAULT_15_DAY_CURRICULUM,
  getCurriculumBlueprintForCohort,
  getCurriculumForCohort,
} from '../../lib/curriculum';

describe('Domain-Driven 15-Day Curriculum Blueprints', () => {
  describe('Video Editing Curriculum Blueprint', () => {
    it('has 15 production-ready days in sequence with day 1 published', () => {
      expect(VIDEO_EDITING_15_DAY_CURRICULUM).toHaveLength(15);
      expect(VIDEO_EDITING_15_DAY_CURRICULUM[0].day_number).toBe(1);
      expect(VIDEO_EDITING_15_DAY_CURRICULUM[0].is_published).toBe(true);
      expect(VIDEO_EDITING_15_DAY_CURRICULUM[1].is_published).toBe(false);
      expect(VIDEO_EDITING_15_DAY_CURRICULUM[14].day_number).toBe(15);

      for (let day = 1; day <= 15; day++) {
        const item = VIDEO_EDITING_15_DAY_CURRICULUM.find((d) => d.day_number === day);
        expect(item).toBeDefined();
        expect(item?.title).toContain(`Day ${day.toString().padStart(2, '0')}`);
        expect(item?.track_type).toBe('non_coding');
      }
    });

    it('covers cuts, sound design stems, typography, color grading and client capstone', () => {
      const titles = VIDEO_EDITING_15_DAY_CURRICULUM.map((d) => d.title.toLowerCase());
      expect(titles.some((t) => t.includes('kinetic cut'))).toBe(true);
      expect(titles.some((t) => t.includes('pacing'))).toBe(true);
      expect(titles.some((t) => t.includes('sound design') || t.includes('sfx'))).toBe(true);
      expect(titles.some((t) => t.includes('color grading'))).toBe(true);
      expect(titles.some((t) => t.includes('typography'))).toBe(true);
      expect(titles.some((t) => t.includes('capstone'))).toBe(true);
      expect(titles.some((t) => t.includes('graduation'))).toBe(true);
    });
  });

  describe('Full-Stack Coding Curriculum Blueprint', () => {
    it('has 15 production-ready days in sequence with day 1 published and github_pr submissions', () => {
      expect(CODING_FULLSTACK_15_DAY_CURRICULUM).toHaveLength(15);
      expect(CODING_FULLSTACK_15_DAY_CURRICULUM[0].day_number).toBe(1);
      expect(CODING_FULLSTACK_15_DAY_CURRICULUM[0].is_published).toBe(true);
      expect(CODING_FULLSTACK_15_DAY_CURRICULUM[1].is_published).toBe(false);
      expect(CODING_FULLSTACK_15_DAY_CURRICULUM[14].day_number).toBe(15);

      for (let day = 1; day <= 15; day++) {
        const item = CODING_FULLSTACK_15_DAY_CURRICULUM.find((d) => d.day_number === day);
        expect(item).toBeDefined();
        expect(item?.title).toContain(`Day ${day.toString().padStart(2, '0')}`);
        expect(item?.track_type).toBe('coding');
      }
    });

    it('covers Git, RLS Schema, REST APIs, State Management, Webhooks, CI/CD, and Deployment', () => {
      const titles = CODING_FULLSTACK_15_DAY_CURRICULUM.map((d) => d.title.toLowerCase());
      expect(titles.some((t) => t.includes('git'))).toBe(true);
      expect(titles.some((t) => t.includes('relational') || t.includes('rls'))).toBe(true);
      expect(titles.some((t) => t.includes('rest api'))).toBe(true);
      expect(titles.some((t) => t.includes('state'))).toBe(true);
      expect(titles.some((t) => t.includes('authentication') || t.includes('rbac'))).toBe(true);
      expect(titles.some((t) => t.includes('webhook'))).toBe(true);
      expect(titles.some((t) => t.includes('ci/cd'))).toBe(true);
      expect(titles.some((t) => t.includes('deployment'))).toBe(true);
      expect(titles.some((t) => t.includes('capstone'))).toBe(true);
    });
  });

  describe('Motion Graphics Curriculum Blueprint', () => {
    it('has 15 production-ready days in sequence with day 1 published', () => {
      expect(MOTION_GRAPHICS_15_DAY_CURRICULUM).toHaveLength(15);
      expect(MOTION_GRAPHICS_15_DAY_CURRICULUM[0].day_number).toBe(1);
      expect(MOTION_GRAPHICS_15_DAY_CURRICULUM[0].is_published).toBe(true);
      expect(MOTION_GRAPHICS_15_DAY_CURRICULUM[1].is_published).toBe(false);
      expect(MOTION_GRAPHICS_15_DAY_CURRICULUM[14].day_number).toBe(15);

      for (let day = 1; day <= 15; day++) {
        const item = MOTION_GRAPHICS_15_DAY_CURRICULUM.find((d) => d.day_number === day);
        expect(item).toBeDefined();
        expect(item?.title).toContain(`Day ${day.toString().padStart(2, '0')}`);
        expect(item?.track_type).toBe('non_coding');
      }
    });

    it('covers Cinema 4D/Blender, After Effects, Kinetic Typography, 3D Tracking, and Render Passes', () => {
      const titles = MOTION_GRAPHICS_15_DAY_CURRICULUM.map((d) => d.title.toLowerCase());
      expect(titles.some((t) => t.includes('keyframe') || t.includes('velocity'))).toBe(true);
      expect(titles.some((t) => t.includes('kinetic typography'))).toBe(true);
      expect(titles.some((t) => t.includes('vector') || t.includes('shape'))).toBe(true);
      expect(titles.some((t) => t.includes('cinema 4d') || t.includes('blender') || t.includes('camera tracking'))).toBe(true);
      expect(titles.some((t) => t.includes('pbr') || t.includes('lighting'))).toBe(true);
      expect(titles.some((t) => t.includes('simulation') || t.includes('particle'))).toBe(true);
      expect(titles.some((t) => t.includes('capstone'))).toBe(true);
    });
  });

  describe('Curriculum Blueprint Resolver (getCurriculumBlueprintForCohort)', () => {
    it('resolves Coding Blueprint for Python, Java, Web, or Coding cohorts', () => {
      // By track_type
      expect(getCurriculumBlueprintForCohort({ track_type: 'coding' })).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );

      // By cohort title keywords
      expect(getCurriculumBlueprintForCohort({ title: 'Fullstack Python Engineering' })).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ name: 'Java Backend Development' })).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ title: 'Modern Web Development with Next.js' })).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ title: 'React & TypeScript Bootcamp' })).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );

      // By parent course category
      expect(
        getCurriculumBlueprintForCohort({
          title: 'Fall 2026 Batch',
          course: { category: 'Software Development', track_type: 'coding' },
        })
      ).toBe(CODING_FULLSTACK_15_DAY_CURRICULUM);

      // By direct string argument
      expect(getCurriculumBlueprintForCohort('Python Data & Web Backend')).toBe(
        CODING_FULLSTACK_15_DAY_CURRICULUM
      );
    });

    it('resolves Motion Graphics Blueprint for 3D, Motion, Blender, or Animation cohorts', () => {
      expect(getCurriculumBlueprintForCohort({ title: 'Motion Graphics Masterclass' })).toBe(
        MOTION_GRAPHICS_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ name: 'Cinema 4D & 3D Spatial Animation' })).toBe(
        MOTION_GRAPHICS_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ title: 'Blender Stylized Animation' })).toBe(
        MOTION_GRAPHICS_15_DAY_CURRICULUM
      );
      expect(
        getCurriculumBlueprintForCohort({
          title: 'Studio Cohort Alpha',
          course: { category: '3D Animation' },
        })
      ).toBe(MOTION_GRAPHICS_15_DAY_CURRICULUM);
      expect(getCurriculumBlueprintForCohort('After Effects Kinetic Motion')).toBe(
        MOTION_GRAPHICS_15_DAY_CURRICULUM
      );
    });

    it('defaults to Video Editing Blueprint for video editing or unspecified cohorts', () => {
      expect(getCurriculumBlueprintForCohort({ track_type: 'non_coding', title: 'Video Editing Cohort' })).toBe(
        VIDEO_EDITING_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort({ title: 'Premiere Pro Kinetic Cut' })).toBe(
        VIDEO_EDITING_15_DAY_CURRICULUM
      );
      expect(getCurriculumBlueprintForCohort(null)).toBe(VIDEO_EDITING_15_DAY_CURRICULUM);
      expect(getCurriculumBlueprintForCohort(undefined)).toBe(VIDEO_EDITING_15_DAY_CURRICULUM);
      expect(getCurriculumBlueprintForCohort('')).toBe(VIDEO_EDITING_15_DAY_CURRICULUM);
    });

    it('provides getCurriculumForCohort alias and backward-compatible DEFAULT_15_DAY_CURRICULUM', () => {
      expect(getCurriculumForCohort).toBe(getCurriculumBlueprintForCohort);
      expect(DEFAULT_15_DAY_CURRICULUM).toBe(VIDEO_EDITING_15_DAY_CURRICULUM);
    });
  });
});

