import { supabase } from './supabaseClient';

export interface AdminStats {
  users: number;
  students: number;
  mentors: number;
  admins: number;
  cohorts: number;
  enrollments: number;
  posts: number;
  pendingSubmissions: number;
  reviewedSubmissions: number;
  announcements: number;
  sessions: number;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  meeting_url: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface AdminCommunityPost extends CommunityPost {
  author_name: string;
  author_email: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status?: 'active' | 'suspended' | 'inactive';
  created_at?: string;
}

export interface AdminEnrollment {
  user_id: string;
  cohort_id: string;
  status: 'active' | 'completed' | 'dropped';
  created_at: string;
  student_name: string;
  student_email: string;
  cohort_name: string;
}

// 1. Platform Metrics & Stats
export async function getAdminStats(): Promise<AdminStats> {
  const [
    usersRes,
    studentsRes,
    mentorsRes,
    adminsRes,
    cohortsRes,
    enrollmentsRes,
    postsRes,
    pendingSubRes,
    reviewedSubRes,
    announcementsRes,
    sessionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'mentor'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('cohorts').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('user_id', { count: 'exact', head: true }),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
    supabase.from('announcements').select('id', { count: 'exact', head: true }),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true }),
  ]);

  return {
    users: usersRes.count ?? 0,
    students: studentsRes.count ?? 0,
    mentors: mentorsRes.count ?? 0,
    admins: adminsRes.count ?? 0,
    cohorts: cohortsRes.count ?? 0,
    enrollments: enrollmentsRes.count ?? 0,
    posts: postsRes.count ?? 0,
    pendingSubmissions: pendingSubRes.count ?? 0,
    reviewedSubmissions: reviewedSubRes.count ?? 0,
    announcements: announcementsRes.count ?? 0,
    sessions: sessionsRes.count ?? 0,
  };
}

// 2. User Directory & Role/Status Management
export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function updateUserRole(userId: string, role: 'student' | 'mentor' | 'admin'): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role, status, created_at')
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role, status, created_at')
    .single();
  if (error) throw error;
  return data as UserProfile;
}

// 3. Cohort Enrollment Management
export async function listCohortEnrollments(cohortId?: string): Promise<AdminEnrollment[]> {
  let query = supabase.from('enrollments').select('user_id, cohort_id, status, created_at').order('created_at', { ascending: false });
  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }

  const { data: enrollments, error } = await query;
  if (error) throw error;
  if (!enrollments || enrollments.length === 0) return [];

  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id)));
  const cohortIds = Array.from(new Set(enrollments.map((e) => e.cohort_id)));

  const [{ data: profiles }, { data: cohorts }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', userIds),
    supabase.from('cohorts').select('id, title').in('id', cohortIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const cohortMap = new Map((cohorts ?? []).map((c) => [c.id, c.title]));

  return enrollments.map((e) => {
    const student = profileMap.get(e.user_id);
    return {
      user_id: e.user_id,
      cohort_id: e.cohort_id,
      status: e.status,
      created_at: e.created_at,
      student_name: student?.full_name || 'Student',
      student_email: student?.email || '',
      cohort_name: cohortMap.get(e.cohort_id) || 'Cohort',
    };
  });
}

export async function enrollUserInCohort(userId: string, cohortId: string): Promise<void> {
  const { error } = await supabase.from('enrollments').upsert(
    { user_id: userId, cohort_id: cohortId, status: 'active', created_at: new Date().toISOString() },
    { onConflict: 'user_id,cohort_id' }
  );
  if (error) throw error;
}

export async function updateEnrollmentStatus(
  userId: string,
  cohortId: string,
  status: 'active' | 'completed' | 'dropped'
): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .update({ status })
    .eq('user_id', userId)
    .eq('cohort_id', cohortId);
  if (error) throw error;
}

export async function removeEnrollment(userId: string, cohortId: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('cohort_id', cohortId);
  if (error) throw error;
}

// 4. Announcements Management
export async function listAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, published, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminAnnouncement[];
}

export async function createAnnouncement(authorId: string, title: string, body: string): Promise<AdminAnnouncement> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ author_id: authorId, title, body, published: true })
    .select('id, title, body, published, created_at')
    .single();
  if (error) throw error;
  return data as AdminAnnouncement;
}

export async function updateAnnouncement(
  id: string,
  input: { title?: string; body?: string; published?: boolean }
): Promise<AdminAnnouncement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(input)
    .eq('id', id)
    .select('id, title, body, published, created_at')
    .single();
  if (error) throw error;
  return data as AdminAnnouncement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

// 5. Live Sessions Management
export async function listLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id, title, description, starts_at, meeting_url')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiveSession[];
}

export async function createLiveSession(createdBy: string, input: Omit<LiveSession, 'id'>): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({ ...input, created_by: createdBy })
    .select('id, title, description, starts_at, meeting_url')
    .single();
  if (error) throw error;
  return data as LiveSession;
}

export async function updateLiveSession(
  id: string,
  input: Partial<Omit<LiveSession, 'id'>>
): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .update(input)
    .eq('id', id)
    .select('id, title, description, starts_at, meeting_url')
    .single();
  if (error) throw error;
  return data as LiveSession;
}

export async function deleteLiveSession(id: string): Promise<void> {
  const { error } = await supabase.from('live_sessions').delete().eq('id', id);
  if (error) throw error;
}

// 6. Community Moderation
export async function listCommunityPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function listCommunityPostsWithAuthors(): Promise<AdminCommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', authorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return posts.map((p) => {
    const profile = profileMap.get(p.author_id);
    return {
      ...p,
      author_name: profile?.full_name || 'Community Member',
      author_email: profile?.email || '',
    };
  });
}

export async function deleteCommunityPost(id: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteCommunityComment(id: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', id);
  if (error) throw error;
}
