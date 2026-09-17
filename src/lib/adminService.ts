import { supabase } from './supabaseClient';

export interface AdminStats { users: number; cohorts: number; posts: number; pendingSubmissions: number; }
export interface AdminAnnouncement { id: string; title: string; body: string; published: boolean; created_at: string; }
export interface LiveSession { id: string; title: string; description: string | null; starts_at: string; meeting_url: string; }
export interface CommunityPost { id: string; author_id: string; body: string; created_at: string; }
export interface UserProfile { id: string; full_name: string; email: string; role: string; }

export async function getAdminStats(): Promise<AdminStats> {
  const [users, cohorts, posts, submissions] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('cohorts').select('id', { count: 'exact', head: true }),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const error = users.error || cohorts.error || posts.error || submissions.error;
  if (error) throw error;
  return { users: users.count ?? 0, cohorts: cohorts.count ?? 0, posts: posts.count ?? 0, pendingSubmissions: submissions.count ?? 0 };
}

export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name');
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function updateUserRole(userId: string, role: 'student' | 'mentor' | 'admin'): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, full_name, email, role')
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function listAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data, error } = await supabase.from('announcements').select('id, title, body, published, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminAnnouncement[];
}

export async function createAnnouncement(authorId: string, title: string, body: string): Promise<AdminAnnouncement> {
  const { data, error } = await supabase.from('announcements').insert({ author_id: authorId, title, body, published: true }).select('id, title, body, published, created_at').single();
  if (error) throw error;
  return data as AdminAnnouncement;
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase.from('live_sessions').select('id, title, description, starts_at, meeting_url').order('starts_at');
  if (error) throw error;
  return (data ?? []) as LiveSession[];
}

export async function createLiveSession(createdBy: string, input: Omit<LiveSession, 'id'>): Promise<LiveSession> {
  const { data, error } = await supabase.from('live_sessions').insert({ ...input, created_by: createdBy }).select('id, title, description, starts_at, meeting_url').single();
  if (error) throw error;
  return data as LiveSession;
}

export async function listCommunityPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase.from('community_posts').select('id, author_id, body, created_at').order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}
