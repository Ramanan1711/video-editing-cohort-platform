import { supabase } from './supabaseClient';
import { parseDatabaseError } from './errorHandling';
import type { StudentNotification } from './courseService';

export interface SendCohortNotificationParams {
  cohortId: string;
  title: string;
  body: string;
  category?: 'system' | 'review' | 'deadline' | 'community' | 'announcement';
  actionUrl?: string;
  targetRole?: 'students' | 'mentors' | 'all';
}

/**
 * Dispatch an individual notification via authoritative server-side RPC
 * with direct table insert fallback.
 */
export async function dispatchNotification(
  userId: string,
  title: string,
  body: string,
  category: 'system' | 'review' | 'deadline' | 'community' | 'announcement' = 'system',
  actionUrl?: string
): Promise<string> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('dispatch_notification', {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_category: category,
    p_action_url: actionUrl || null,
  });

  if (!rpcError && rpcData) {
    return rpcData as string;
  }

  // Direct table insert fallback if RPC is unmigrated or fails
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      category,
      action_url: actionUrl || null,
    })
    .select('id')
    .single();

  if (error) {
    throw parseDatabaseError(error);
  }

  return data.id as string;
}

/**
 * Broadcast notifications to students, mentors, or all users in a specific cohort
 * with mentor targeting strictly scoped to mentor_cohorts.
 */
export async function sendCohortNotification(
  params: SendCohortNotificationParams
): Promise<number> {
  const { cohortId, title, body, category = 'system', actionUrl, targetRole = 'all' } = params;

  const { data: rpcCount, error: rpcError } = await supabase.rpc('send_cohort_notification', {
    p_cohort_id: cohortId,
    p_title: title,
    p_body: body,
    p_category: category,
    p_action_url: actionUrl || null,
    p_target_role: targetRole,
  });

  if (!rpcError && typeof rpcCount === 'number') {
    return rpcCount;
  }

  // Fallback: Query cohort recipients client-side
  let targetUserIds: string[] = [];

  if (targetRole === 'students' || targetRole === 'all') {
    const { data: students } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('cohort_id', cohortId)
      .in('status', ['enrolled', 'active', 'completed']);
    if (students) {
      targetUserIds.push(...students.map((s) => s.user_id));
    }
  }

  if (targetRole === 'mentors' || targetRole === 'all') {
    const { data: mentors } = await supabase
      .from('mentor_cohorts')
      .select('mentor_id')
      .eq('cohort_id', cohortId);
    if (mentors) {
      targetUserIds.push(...mentors.map((m) => m.mentor_id));
    }
  }

  targetUserIds = Array.from(new Set(targetUserIds));
  if (targetUserIds.length === 0) return 0;

  const rows = targetUserIds.map((uid) => ({
    user_id: uid,
    title,
    body,
    category,
    action_url: actionUrl || null,
  }));

  const { error: insertErr } = await supabase.from('notifications').insert(rows);
  if (insertErr) throw parseDatabaseError(insertErr);

  return targetUserIds.length;
}

/**
 * Fetch notifications for a user, sorted descending by created_at.
 */
export async function listUserNotifications(userId: string): Promise<StudentNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, read_at, created_at, category, action_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01' || error.message.includes('notifications')) {
      return [];
    }
    throw parseDatabaseError(error);
  }

  return (data ?? []) as StudentNotification[];
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw parseDatabaseError(error);
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw parseDatabaseError(error);
}
