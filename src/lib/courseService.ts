/**
 * courseService.ts - Modularized Aggregator & Barrel Export
 *
 * This file maintains 100% backward compatibility with all existing imports
 * across consumers and test suites by re-exporting domain services from:
 * - src/lib/services/curriculumService.ts
 * - src/lib/services/lessonProgressService.ts
 * - src/lib/services/assignmentSubmissionService.ts
 * - src/lib/services/assetStorageService.ts
 * - src/lib/services/certificateService.ts
 * - src/lib/services/sprintMetricsService.ts
 */

export * from './services/curriculumService';
export * from './services/lessonProgressService';
export * from './services/assignmentSubmissionService';
export * from './services/assetStorageService';
export * from './services/certificateService';
export * from './services/sprintMetricsService';