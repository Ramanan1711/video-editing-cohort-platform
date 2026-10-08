import { supabase } from './supabaseClient';

export interface ChallengeAsset {
  title: string;
  size: string;
  type: string;
  url?: string;
}

export interface CourseChallengeItem {
  id: string;
  cohortId?: string | null;
  courseId?: string | null;
  cohortTitle?: string;
  type: 'PROJECT' | 'TASK';
  week: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  status: 'active' | 'upcoming' | 'completed';
  participantsJoined: number;
  proReward: number;
  isJoined?: boolean;
  hasSubmitted?: boolean;
  assets?: ChallengeAsset[];
  createdAt?: string;
}

export interface CreateChallengeInput {
  cohortId: string;
  cohortTitle?: string;
  title: string;
  type: 'PROJECT' | 'TASK';
  week: string;
  startDate: string;
  endDate: string;
  durationLabel?: string;
  status?: 'active' | 'upcoming' | 'completed';
  proReward?: number;
  description?: string;
  assetUrl?: string;
  assetFile?: File;
  assetName?: string;
  assetSize?: string;
}

const LOCAL_STORAGE_CHALLENGES_KEY = 'cutcraft_dynamic_course_challenges';
const LOCAL_STORAGE_JOINED_KEY = 'cutcraft_joined_challenges';
const LOCAL_STORAGE_SUBMISSIONS_KEY = 'cutcraft_submitted_challenges';

// Domain-aware default challenges by course track
const VIDEO_DEFAULT_CHALLENGES: CourseChallengeItem[] = [
  {
    id: 'ch-w3-proj',
    type: 'PROJECT',
    week: 'WEEK 3',
    title: 'B15 W3 Project - 3 Remix the emotion',
    description:
      'Remix the provided documentary sequence using advanced pacing, dynamic sound beds, and three-point color grading to heighten the emotional arc.',
    startDate: '7 Sep',
    endDate: '13 Sep 2026',
    durationLabel: '7 days',
    status: 'active',
    participantsJoined: 24,
    proReward: 50,
    isJoined: false,
    assets: [
      { title: 'Documentary Footage Pack', size: '1.4 GB', type: '.zip / ProRes 422' },
      { title: 'Sound Design & Foley FX Bed', size: '320 MB', type: '.zip / 24-bit WAV' },
      { title: 'NLE Starter Project Templates', size: '45 MB', type: '.drp & .prproj' },
    ],
  },
  {
    id: 'ch-w3-task',
    type: 'TASK',
    week: 'WEEK 3',
    title: 'B15 W3 Task 3 - Design sounds for the video',
    description:
      'Build a comprehensive 8-track audio stem layer including whooshes, risers, ambient room tone, and dialogue cleanup.',
    startDate: '7 Sep',
    endDate: '10 Sep 2026',
    durationLabel: '4 days',
    status: 'active',
    participantsJoined: 18,
    proReward: 50,
    isJoined: true,
    assets: [
      { title: 'Audio Stems & Foley Bed', size: '210 MB', type: '.zip / 24-bit WAV' },
      { title: 'Sound Design Reference Guide', size: '12 MB', type: '.pdf' },
    ],
  },
  {
    id: 'ch-w2-proj',
    type: 'PROJECT',
    week: 'WEEK 2',
    title: 'B15 W2 Project - Color Grading & Polish',
    description:
      'Apply primary balance and secondary qualifiers across 5 distinct lighting scenarios using DaVinci Resolve color management.',
    startDate: '31 Aug',
    endDate: '6 Sep 2026',
    durationLabel: '7 days',
    status: 'completed',
    participantsJoined: 38,
    proReward: 100,
    isJoined: true,
    assets: [
      { title: 'RAW Log Footage Clips', size: '2.1 GB', type: '.zip / BRAW' },
      { title: 'Show Look LUTs Collection', size: '5 MB', type: '.cube' },
    ],
  },
  {
    id: 'ch-w4-proj',
    type: 'PROJECT',
    week: 'WEEK 4',
    title: 'B15 W4 Project - Final Narrative Capstone',
    description:
      'Edit, color grade, and master the full 3-minute brand commercial short film ready for theatrical client delivery.',
    startDate: '14 Sep',
    endDate: '21 Sep 2026',
    durationLabel: '7 days',
    status: 'upcoming',
    participantsJoined: 12,
    proReward: 150,
    isJoined: false,
    assets: [
      { title: 'Master Footage Reel', size: '3.8 GB', type: '.zip' },
      { title: 'Commercial Director Brief', size: '8 MB', type: '.pdf' },
    ],
  },
];

const CODING_DEFAULT_CHALLENGES: CourseChallengeItem[] = [
  {
    id: 'ch-code-w1-proj',
    type: 'PROJECT',
    week: 'WEEK 1',
    title: 'Sprint 1 - Clean UI Architecture & State Machine',
    description:
      'Architect a modular React + TypeScript state management flow with fail-closed boundary error recovery and optimistic updates.',
    startDate: '1 Sep',
    endDate: '7 Sep 2026',
    durationLabel: '7 days',
    status: 'completed',
    participantsJoined: 32,
    proReward: 100,
    isJoined: true,
    assets: [
      { title: 'Starter Repo Template & Schema', size: '15 MB', type: '.zip / Vite + TS' },
      { title: 'Architecture Specification Doc', size: '4 MB', type: '.pdf' },
    ],
  },
  {
    id: 'ch-code-w2-proj',
    type: 'PROJECT',
    week: 'WEEK 2',
    title: 'Sprint 2 - Production Database Schema & Auth Guards',
    description:
      'Design high-performance PostgreSQL relations, RLS security policies, and idempotent RPC migrations with zero data leakage.',
    startDate: '8 Sep',
    endDate: '14 Sep 2026',
    durationLabel: '7 days',
    status: 'active',
    participantsJoined: 29,
    proReward: 100,
    isJoined: true,
    assets: [
      { title: 'Database Seed & Migration Suite', size: '8 MB', type: '.sql / .ts' },
      { title: 'Security RLS Checklist', size: '2 MB', type: '.pdf' },
    ],
  },
  {
    id: 'ch-code-w3-task',
    type: 'TASK',
    week: 'WEEK 3',
    title: 'Sprint 3 Task - Implement Edge Rate Limiting & Caching',
    description:
      'Build Redis-backed sliding window rate limiters and memory cache invalidation for real-time WebSocket endpoints.',
    startDate: '15 Sep',
    endDate: '18 Sep 2026',
    durationLabel: '4 days',
    status: 'active',
    participantsJoined: 15,
    proReward: 50,
    isJoined: false,
    assets: [
      { title: 'Benchmark Test Suite', size: '5 MB', type: '.zip / Vitest' },
    ],
  },
  {
    id: 'ch-code-w4-proj',
    type: 'PROJECT',
    week: 'WEEK 4',
    title: 'Sprint 4 - Production Cloud Deployment & CI/CD Gate',
    description:
      'Deploy the fullstack application to serverless edge containers with automated GitHub Actions testing and rollout verification.',
    startDate: '22 Sep',
    endDate: '29 Sep 2026',
    durationLabel: '7 days',
    status: 'upcoming',
    participantsJoined: 8,
    proReward: 200,
    isJoined: false,
    assets: [
      { title: 'Docker & CI Workflow Templates', size: '3 MB', type: '.zip / YAML' },
    ],
  },
];

const MOTION_GRAPHICS_DEFAULT_CHALLENGES: CourseChallengeItem[] = [
  {
    id: 'ch-motion-w1-proj',
    type: 'PROJECT',
    week: 'WEEK 1',
    title: 'M1 Project - Kinetic Typography & Easing Rhythms',
    description:
      'Design a 15-second rhythm-synced kinetic typography reel leveraging custom velocity graphs, track mattes, and motion blur.',
    startDate: '1 Sep',
    endDate: '7 Sep 2026',
    durationLabel: '7 days',
    status: 'completed',
    participantsJoined: 26,
    proReward: 100,
    isJoined: true,
    assets: [
      { title: 'Typeface Pack & Audio Stems', size: '180 MB', type: '.zip' },
      { title: 'Animation Curve Principles Guide', size: '6 MB', type: '.pdf' },
    ],
  },
  {
    id: 'ch-motion-w2-proj',
    type: 'PROJECT',
    week: 'WEEK 2',
    title: 'M2 Project - 3D Logo Reveal & Volumetric Lighting',
    description:
      'Model and animate an optical logo reveal utilizing displacement maps, ray-traced reflections, and camera depth of field.',
    startDate: '8 Sep',
    endDate: '14 Sep 2026',
    durationLabel: '7 days',
    status: 'active',
    participantsJoined: 22,
    proReward: 120,
    isJoined: true,
    assets: [
      { title: 'Vector Brand Assets & Materials', size: '95 MB', type: '.zip / .ai' },
      { title: 'Lighting Setup Templates', size: '25 MB', type: '.aep' },
    ],
  },
  {
    id: 'ch-motion-w3-task',
    type: 'TASK',
    week: 'WEEK 3',
    title: 'M3 Task - Particle Simulation & Shockwaves',
    description:
      'Simulate high-velocity physics-based particle streams and shockwave distortion passes timed to impact audio.',
    startDate: '15 Sep',
    endDate: '18 Sep 2026',
    durationLabel: '4 days',
    status: 'active',
    participantsJoined: 14,
    proReward: 60,
    isJoined: false,
    assets: [
      { title: 'Sprite Textures & Impact Sounds', size: '140 MB', type: '.zip' },
    ],
  },
  {
    id: 'ch-motion-w4-proj',
    type: 'PROJECT',
    week: 'WEEK 4',
    title: 'M4 Project - Commercial Showreel Capstone',
    description:
      'Assemble and color grade a portfolio-ready 30-second broadcast commercial sequence featuring 3D elements and typography.',
    startDate: '22 Sep',
    endDate: '29 Sep 2026',
    durationLabel: '7 days',
    status: 'upcoming',
    participantsJoined: 7,
    proReward: 200,
    isJoined: false,
    assets: [
      { title: 'Broadcast Package Spec & Brief', size: '12 MB', type: '.pdf' },
    ],
  },
];

function getStoredLocalChallenges(): CourseChallengeItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore local parse issues
  }
  return [];
}

function saveStoredLocalChallenges(challenges: CourseChallengeItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CHALLENGES_KEY, JSON.stringify(challenges));
  } catch {
    // Ignore storage quota issues
  }
}

function getStoredJoinedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_JOINED_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch {
    // Ignore
  }
  return new Set(['ch-w3-task', 'ch-w2-proj', 'ch-code-w1-proj', 'ch-code-w2-proj', 'ch-motion-w1-proj', 'ch-motion-w2-proj']);
}

function saveStoredJoinedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_JOINED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore
  }
}

function getStoredSubmittedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUBMISSIONS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch {
    // Ignore
  }
  return new Set(['ch-w3-task', 'ch-code-w1-proj', 'ch-motion-w1-proj']);
}

function saveStoredSubmittedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SUBMISSIONS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore
  }
}

/**
 * Returns default challenges tailored to a course's track/title
 */
export function getDefaultChallengesForCohort(cohortId?: string, cohortTitle?: string): CourseChallengeItem[] {
  const normTitle = (cohortTitle || '').toLowerCase();
  let baseList: CourseChallengeItem[];

  if (normTitle.includes('motion') || normTitle.includes('animation')) {
    baseList = MOTION_GRAPHICS_DEFAULT_CHALLENGES;
  } else if (normTitle.includes('code') || normTitle.includes('coding') || normTitle.includes('fullstack') || normTitle.includes('developer')) {
    baseList = CODING_DEFAULT_CHALLENGES;
  } else {
    baseList = VIDEO_DEFAULT_CHALLENGES;
  }

  return baseList.map((c) => ({
    ...c,
    cohortId: cohortId || 'default',
    cohortTitle: cohortTitle || 'Course',
  }));
}

/**
 * Uploads an asset file to Supabase Storage in the course-assets bucket
 */
export async function uploadChallengeAsset(
  file: File,
  cohortId: string = 'general'
): Promise<{ url: string; name: string; size: string; type: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `challenges/${cohortId}/${Date.now()}-${safeName}`;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const sizeLabel = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${(file.size / 1024).toFixed(0)} KB`;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  try {
    const { error } = await supabase.storage.from('course-assets').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

    if (!error) {
      const { data: signed } = await supabase.storage
        .from('course-assets')
        .createSignedUrl(path, 86400 * 30); // 30-day link

      return {
        url: signed?.signedUrl || `course-assets/${path}`,
        name: file.name,
        size: sizeLabel,
        type: `.${ext}`,
      };
    }
  } catch (err) {
    console.warn('Storage upload fallback:', err);
  }

  // Local object URL fallback
  const objectUrl = URL.createObjectURL(file);
  return {
    url: objectUrl,
    name: file.name,
    size: sizeLabel,
    type: `.${ext}`,
  };
}

/**
 * Fetches dynamic challenges for a given cohort or all cohorts
 */
export async function fetchCourseChallenges(
  cohortId?: string | null,
  cohortTitle?: string
): Promise<CourseChallengeItem[]> {
  const joinedIds = getStoredJoinedIds();
  const submittedIds = getStoredSubmittedIds();
  let dbChallenges: CourseChallengeItem[] = [];

  try {
    let query = supabase.from('course_challenges').select('*').order('created_at', { ascending: false });

    if (cohortId && cohortId !== 'all') {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      dbChallenges = data.map((row: any) => ({
        id: row.id,
        cohortId: row.cohort_id,
        courseId: row.course_id,
        cohortTitle: row.cohort_title || cohortTitle || 'Course',
        type: row.type || 'PROJECT',
        week: row.week || 'WEEK 1',
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        durationLabel: row.duration_label || '7 days',
        status: row.status || 'active',
        participantsJoined: Number(row.participants_joined || 0),
        proReward: Number(row.pro_reward || 50),
        assets: row.asset_url
          ? [
              {
                title: row.asset_name || 'Attached Project Asset',
                size: row.asset_size || 'Download',
                type: row.asset_name ? `.${row.asset_name.split('.').pop()}` : 'Asset',
                url: row.asset_url,
              },
            ]
          : undefined,
        createdAt: row.created_at,
      }));
    }
  } catch {
    // Table may not yet be migrated, fallback to local/domain seeds
  }

  // Merge with locally stored uploaded challenges
  const localUploaded = getStoredLocalChallenges();
  const filteredLocal = cohortId && cohortId !== 'all'
    ? localUploaded.filter((c) => c.cohortId === cohortId)
    : localUploaded;

  const combined = [...dbChallenges];
  for (const item of filteredLocal) {
    if (!combined.some((c) => c.id === item.id)) {
      combined.unshift(item);
    }
  }

  // If no challenges found for this specific cohort, provide domain-aware defaults
  if (combined.length === 0) {
    const defaults = getDefaultChallengesForCohort(cohortId || undefined, cohortTitle);
    combined.push(...defaults);
  }

  // Annotate with live joined and submitted state
  return combined.map((c) => ({
    ...c,
    isJoined: joinedIds.has(c.id) || Boolean(c.isJoined),
    hasSubmitted: submittedIds.has(c.id) || Boolean(c.hasSubmitted),
  }));
}

/**
 * Creates / uploads a new challenge dynamically for a specific course
 */
export async function createCourseChallenge(
  input: CreateChallengeInput,
  currentUser?: { id?: string; name?: string }
): Promise<CourseChallengeItem> {
  let assetInfo: { url?: string; name?: string; size?: string; type?: string } = {};

  if (input.assetFile) {
    assetInfo = await uploadChallengeAsset(input.assetFile, input.cohortId);
  } else if (input.assetUrl) {
    assetInfo = {
      url: input.assetUrl,
      name: input.assetName || 'External Challenge Resources',
      size: input.assetSize || 'Cloud Asset',
      type: 'link',
    };
  }

  const newChallengeId = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const duration = input.durationLabel || '7 days';

  const newChallenge: CourseChallengeItem = {
    id: newChallengeId,
    cohortId: input.cohortId,
    cohortTitle: input.cohortTitle || 'Course',
    type: input.type,
    week: input.week.toUpperCase(),
    title: input.title.trim(),
    description: input.description?.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    durationLabel: duration,
    status: input.status || 'active',
    participantsJoined: 1, // Author is joined
    proReward: input.proReward ?? 50,
    isJoined: true,
    assets: assetInfo.url
      ? [
          {
            title: assetInfo.name || 'Challenge Starter Pack',
            size: assetInfo.size || 'Attached Asset',
            type: assetInfo.type || '.zip',
            url: assetInfo.url,
          },
        ]
      : undefined,
    createdAt: new Date().toISOString(),
  };

  // Attempt database insertion
  try {
    await supabase.from('course_challenges').insert({
      id: newChallenge.id,
      cohort_id: input.cohortId,
      type: input.type,
      week: input.week.toUpperCase(),
      title: input.title.trim(),
      description: input.description?.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      duration_label: duration,
      status: input.status || 'active',
      participants_joined: 1,
      pro_reward: input.proReward ?? 50,
      asset_url: assetInfo.url || null,
      asset_name: assetInfo.name || null,
      asset_size: assetInfo.size || null,
      created_by: currentUser?.id || null,
    });
  } catch (err) {
    console.warn('Database insert into course_challenges skipped or failed:', err);
  }

  // Always save locally to ensure instant persistence
  const existingLocal = getStoredLocalChallenges();
  saveStoredLocalChallenges([newChallenge, ...existingLocal]);

  // Mark author as joined
  const joinedIds = getStoredJoinedIds();
  joinedIds.add(newChallenge.id);
  saveStoredJoinedIds(joinedIds);

  return newChallenge;
}

/**
 * Records that a student joined a challenge
 */
export async function joinCourseChallenge(
  challengeId: string,
  userId?: string
): Promise<void> {
  const joinedIds = getStoredJoinedIds();
  joinedIds.add(challengeId);
  saveStoredJoinedIds(joinedIds);

  if (userId) {
    try {
      await supabase.from('course_challenge_participants').insert({
        challenge_id: challengeId,
        user_id: userId,
      });
    } catch {
      // Ignored if table not yet migrated
    }
  }
}

/**
 * Records a student submission for a challenge
 */
export async function submitCourseChallenge(
  challengeId: string,
  userId: string,
  submissionUrl: string,
  notes?: string
): Promise<void> {
  const submittedIds = getStoredSubmittedIds();
  submittedIds.add(challengeId);
  saveStoredSubmittedIds(submittedIds);

  try {
    await supabase.from('course_challenge_submissions').insert({
      challenge_id: challengeId,
      user_id: userId,
      submission_url: submissionUrl,
      notes: notes || null,
      status: 'pending',
    });
  } catch {
    // Ignored if table not yet migrated
  }
}

/**
 * Deletes a course challenge by ID from Supabase and local storage
 */
export async function deleteCourseChallenge(challengeId: string): Promise<boolean> {
  try {
    await supabase.from('course_challenges').delete().eq('id', challengeId);
  } catch (err) {
    console.warn('Database delete from course_challenges skipped or failed:', err);
  }

  const existingLocal = getStoredLocalChallenges();
  saveStoredLocalChallenges(existingLocal.filter((c) => c.id !== challengeId));
  return true;
}
