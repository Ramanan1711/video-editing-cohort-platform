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
  participants?: ChallengeParticipantProfile[];
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

export interface ChallengeParticipantProfile {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface ChallengeSubmissionDetail {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl?: string;
  submissionUrl: string;
  notes?: string;
  status: string;
  score?: number;
  submittedAt: string;
}

interface CourseChallengeDbParticipant {
  user_id: string;
  joined_at?: string;
  profile?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
}

interface CourseChallengeDbSubmission {
  id: string;
  user_id: string;
  status: string;
  submission_url: string;
  score?: number | null;
  notes?: string | null;
  submitted_at: string;
  profile?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
}

interface CourseChallengeDbRow {
  id: string;
  cohort_id?: string | null;
  course_id?: string | null;
  type?: 'PROJECT' | 'TASK';
  week?: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  duration_label?: string;
  status?: 'active' | 'upcoming' | 'completed';
  participants_joined?: number;
  pro_reward?: number;
  asset_url?: string | null;
  asset_name?: string | null;
  asset_size?: string | null;
  created_by?: string | null;
  created_at?: string;
  participants?: CourseChallengeDbParticipant[];
  submissions?: CourseChallengeDbSubmission[];
}

/**
 * Empty challenges list for type compatibility when database has no records
 */
export function getDefaultChallengesForCohort(_cohortId?: string, _cohortTitle?: string): CourseChallengeItem[] {
  return [];
}

/**
 * Calculates remaining time string (e.g. "Ends in 4d 10h 15m") from end date
 */
export function formatChallengeCountdown(endDateStr?: string | null): string {
  if (!endDateStr) return 'Active';
  try {
    const end = new Date(endDateStr);
    let targetMs = end.getTime();
    if (isNaN(targetMs)) {
      const parsed = Date.parse(endDateStr);
      if (isNaN(parsed)) return 'Active';
      targetMs = parsed;
    }
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return 'Ended';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `Ends in ${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `Ends in ${hours}h ${mins}m`;
    return `Ends in ${mins}m`;
  } catch {
    return 'Active';
  }
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
 * Fetches dynamic challenges for a given cohort or all cohorts from live database
 */
export async function fetchCourseChallenges(
  cohortId?: string | string[] | null,
  cohortTitle?: string,
  currentUserId?: string,
  cohortTitleMap?: Record<string, string>
): Promise<CourseChallengeItem[]> {
  if (Array.isArray(cohortId) && cohortId.length === 0) {
    return [];
  }

  try {
    let effectiveUserId = currentUserId;
    if (!effectiveUserId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    let query = supabase
      .from('course_challenges')
      .select(`
        *,
        participants:course_challenge_participants(
          user_id,
          joined_at,
          profile:profiles(id, full_name, avatar_url, email)
        ),
        submissions:course_challenge_submissions(id, user_id, status, submission_url, score, submitted_at)
      `)
      .order('created_at', { ascending: false });

    if (Array.isArray(cohortId)) {
      query = query.in('cohort_id', cohortId);
    } else if (cohortId && cohortId !== 'all') {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching course challenges from database:', error);
      return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return (data as unknown as CourseChallengeDbRow[]).map((row) => {
      const participants = Array.isArray(row.participants) ? row.participants : [];
      const submissions = Array.isArray(row.submissions) ? row.submissions : [];

      const participantsJoined = participants.length;
      const isJoined = effectiveUserId
        ? participants.some((p) => p.user_id === effectiveUserId)
        : false;
      const hasSubmitted = effectiveUserId
        ? submissions.some((s) => s.user_id === effectiveUserId)
        : false;

      const participantProfiles: ChallengeParticipantProfile[] = participants.map((p) => ({
        userId: p.user_id,
        fullName: p.profile?.full_name || p.profile?.email?.split('@')[0] || 'Enrolled Student',
        avatarUrl: p.profile?.avatar_url || undefined,
        joinedAt: p.joined_at || new Date().toISOString(),
      }));

      const assets: ChallengeAsset[] = [];
      if (row.asset_url) {
        assets.push({
          title: row.asset_name || 'Attached Project Asset',
          size: row.asset_size || 'Download',
          type: row.asset_name ? `.${row.asset_name.split('.').pop()}` : 'Asset',
          url: row.asset_url,
        });
      }

      const resolvedCohortTitle =
        (row.cohort_id && cohortTitleMap?.[row.cohort_id]) || cohortTitle || 'Course';

      return {
        id: row.id,
        cohortId: row.cohort_id,
        courseId: row.course_id,
        cohortTitle: resolvedCohortTitle,
        type: row.type || 'PROJECT',
        week: row.week || 'WEEK 1',
        title: row.title,
        description: row.description || '',
        startDate: row.start_date,
        endDate: row.end_date,
        durationLabel: row.duration_label || '7 days',
        status: row.status || 'active',
        participantsJoined,
        proReward: Number(row.pro_reward || 50),
        isJoined,
        hasSubmitted,
        assets: assets.length > 0 ? assets : undefined,
        participants: participantProfiles.length > 0 ? participantProfiles : undefined,
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    console.warn('Failed to fetch course challenges:', err);
    return [];
  }
}

/**
 * Creates / uploads a new challenge dynamically for a specific course directly to live database
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

  const newRow = {
    id: newChallengeId,
    cohort_id: input.cohortId,
    type: input.type,
    week: input.week.toUpperCase(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    start_date: input.startDate,
    end_date: input.endDate,
    duration_label: duration,
    status: input.status || 'active',
    participants_joined: 0,
    pro_reward: input.proReward ?? 50,
    asset_url: assetInfo.url || null,
    asset_name: assetInfo.name || null,
    asset_size: assetInfo.size || null,
    created_by: currentUser?.id || null,
  };

  const { error } = await supabase.from('course_challenges').insert(newRow);
  if (error) {
    console.error('Database insert into course_challenges failed:', error);
    throw error;
  }

  return {
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
    participantsJoined: 0,
    proReward: input.proReward ?? 50,
    isJoined: false,
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
}

/**
 * Removes a student from a challenge in the database
 */
export async function leaveCourseChallenge(
  challengeId: string,
  userId?: string
): Promise<void> {
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: authData } = await supabase.auth.getUser();
    targetUserId = authData?.user?.id;
  }
  if (!targetUserId) return;

  const { error } = await supabase
    .from('course_challenge_participants')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', targetUserId);

  if (error) {
    console.error('Database delete from course_challenge_participants failed:', error);
    throw error;
  }
}

/**
 * Records that a student joined a challenge in the database
 */
export async function joinCourseChallenge(
  challengeId: string,
  userId?: string
): Promise<void> {
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: authData } = await supabase.auth.getUser();
    targetUserId = authData?.user?.id;
  }
  if (!targetUserId) return;

  const { error } = await supabase.from('course_challenge_participants').insert({
    challenge_id: challengeId,
    user_id: targetUserId,
  });

  if (error && error.code !== '23505') {
    console.error('Failed to join challenge in database:', error);
    throw error;
  }
}

/**
 * Records a student deliverable submission for a challenge
 */
export async function submitCourseChallenge(
  challengeId: string,
  userId: string,
  submissionUrl: string,
  notes?: string
): Promise<void> {
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: authData } = await supabase.auth.getUser();
    targetUserId = authData?.user?.id || '';
  }
  if (!targetUserId) {
    throw new Error('Authentication required to submit challenge');
  }

  const { error } = await supabase.from('course_challenge_submissions').upsert(
    {
      challenge_id: challengeId,
      user_id: targetUserId,
      submission_url: submissionUrl,
      notes: notes || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'challenge_id,user_id' }
  );

  if (error) {
    console.error('Failed to submit challenge into database:', error);
    throw error;
  }
}

/**
 * Deletes a course challenge by ID from Supabase
 */
export async function deleteCourseChallenge(challengeId: string): Promise<boolean> {
  const { error } = await supabase.from('course_challenges').delete().eq('id', challengeId);
  if (error) {
    console.error('Database delete from course_challenges failed:', error);
    return false;
  }
  return true;
}

/**
 * Fetches real joined participants with user profile details
 */
export async function fetchChallengeParticipants(
  challengeId: string
): Promise<ChallengeParticipantProfile[]> {
  const { data, error } = await supabase
    .from('course_challenge_participants')
    .select(`
      user_id,
      joined_at,
      profile:profiles(id, full_name, avatar_url, email)
    `)
    .eq('challenge_id', challengeId)
    .order('joined_at', { ascending: true });

  if (error || !data) return [];

  const rawParticipants = (data as unknown as CourseChallengeDbParticipant[]) || [];

  // Fallback to public_profiles view if private profiles were suppressed by RLS for peer students
  const missingUserIds = rawParticipants
    .filter((row) => !row.profile?.full_name)
    .map((row) => row.user_id);

  let publicProfileMap = new Map<string, { full_name?: string; avatar_url?: string }>();
  if (missingUserIds.length > 0) {
    try {
      const { data: pubData } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', missingUserIds);
      if (pubData) {
        publicProfileMap = new Map(pubData.map((p) => [p.id, p]));
      }
    } catch {
      // Ignore public profile lookup failure
    }
  }

  return rawParticipants.map((row) => {
    const pub = publicProfileMap.get(row.user_id);
    return {
      userId: row.user_id,
      fullName: row.profile?.full_name || pub?.full_name || row.profile?.email?.split('@')[0] || 'Enrolled Student',
      avatarUrl: row.profile?.avatar_url || pub?.avatar_url || undefined,
      joinedAt: row.joined_at || new Date().toISOString(),
    };
  });
}

/**
 * Fetches real student submissions with reviewer score and feedback
 */
export async function fetchChallengeSubmissions(
  challengeId: string
): Promise<ChallengeSubmissionDetail[]> {
  const { data, error } = await supabase
    .from('course_challenge_submissions')
    .select(`
      id,
      user_id,
      submission_url,
      notes,
      status,
      score,
      submitted_at,
      profile:profiles(id, full_name, avatar_url, email)
    `)
    .eq('challenge_id', challengeId)
    .order('submitted_at', { ascending: false });

  if (error || !data) return [];

  const rawSubmissions = (data as unknown as CourseChallengeDbSubmission[]) || [];

  // Fallback to public_profiles view if private profiles were suppressed by RLS
  const missingUserIds = rawSubmissions
    .filter((row) => !row.profile?.full_name)
    .map((row) => row.user_id);

  let publicProfileMap = new Map<string, { full_name?: string; avatar_url?: string }>();
  if (missingUserIds.length > 0) {
    try {
      const { data: pubData } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', missingUserIds);
      if (pubData) {
        publicProfileMap = new Map(pubData.map((p) => [p.id, p]));
      }
    } catch {
      // Ignore public profile lookup failure
    }
  }

  return rawSubmissions.map((row) => {
    const pub = publicProfileMap.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.profile?.full_name || pub?.full_name || row.profile?.email?.split('@')[0] || 'Enrolled Student',
      avatarUrl: row.profile?.avatar_url || pub?.avatar_url || undefined,
      submissionUrl: row.submission_url,
      notes: row.notes || undefined,
      status: row.status,
      score: row.score || undefined,
      submittedAt: row.submitted_at,
    };
  });
}
