import { supabase } from './supabaseClient';

export type WhatsAppEventType =
  | 'welcome'
  | 'daily_challenge'
  | 'workshop_alert'
  | 'inactivity_nudge'
  | 'feedback'
  | 'graduation'
  | 'custom';

export interface WhatsAppLog {
  id: string;
  user_id: string | null;
  recipient_phone: string;
  event_type: WhatsAppEventType;
  message_body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  error_details?: string | null;
  created_at: string;
}

/**
 * Generate a direct click-to-chat WhatsApp link
 */
export function generateWhatsAppClickToChatUrl(phone: string, text: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Formats daily challenge drop message for WhatsApp
 */
export function formatWhatsAppChallengeMessage(
  studentName: string,
  dayNumber: number,
  title: string,
  trackType: string,
  challengeUrl: string
): string {
  const trackEmoji = trackType === 'coding' ? '💻' : '🎬';
  return (
    `🚀 *ProCut Hub 15-Day Internship — Day ${dayNumber} Challenge Drop*\n\n` +
    `Hey ${studentName}! ${trackEmoji} Today's production task is now LIVE:\n\n` +
    `📌 *Task:* ${title}\n` +
    `⏱️ *Deadline:* Tonight before 11:59 PM\n\n` +
    `👉 *Open Challenge:* ${challengeUrl}\n\n` +
    `Stay on track to maintain your streak and qualify for your verified internship certificate!`
  );
}

/**
 * Formats live workshop alert for WhatsApp
 */
export function formatWhatsAppWorkshopAlert(
  studentName: string,
  sessionTitle: string,
  time: string,
  joinUrl: string
): string {
  return (
    `🔴 *Live Masterclass Alert (Starting in 15 mins)*\n\n` +
    `Hey ${studentName},\n` +
    `Your live cohort workshop *${sessionTitle}* begins at ${time}.\n\n` +
    `🔗 *Join Live Stream:* ${joinUrl}\n\n` +
    `Have your project files ready for live review & feedback.`
  );
}

/**
 * Formats inactivity encouragement nudge for WhatsApp
 */
export function formatWhatsAppInactivityNudge(
  studentName: string,
  currentDay: number,
  resumeUrl: string
): string {
  return (
    `⚠️ *Don't lose your streak, ${studentName}!* \n\n` +
    `We noticed you haven't watched today's video lecture or submitted your Day ${currentDay} challenge.\n\n` +
    `Our 15-day sprint is fast-paced. Completing each day's task ensures you qualify for the Certificate of Completion and Mentor Letter of Recommendation.\n\n` +
    `👉 *Resume Day ${currentDay} Sprint:* ${resumeUrl}`
  );
}

/**
 * Formats mentor grading feedback alert
 */
export function formatWhatsAppFeedbackAlert(
  studentName: string,
  taskTitle: string,
  status: 'accepted' | 'resubmit' | 'reviewed',
  score: number | null,
  feedbackUrl: string
): string {
  const statusEmoji = status === 'accepted' ? '✅' : status === 'resubmit' ? '🔄' : '📝';
  const statusText = status === 'accepted' ? 'ACCEPTED' : status === 'resubmit' ? 'REVISIONS REQUESTED' : 'GRADED';
  return (
    `${statusEmoji} *Mentor Review: ${statusText}*\n\n` +
    `Hey ${studentName}, your submission for *${taskTitle}* has been evaluated.\n\n` +
    (score !== null ? `⭐ *Score:* ${score}/100\n` : '') +
    `👉 *Read Mentor Critique & Feedback:* ${feedbackUrl}`
  );
}

/**
 * Dispatches or records a WhatsApp notification log
 */
export async function sendWhatsAppNotification(
  userId: string | null,
  recipientPhone: string,
  eventType: WhatsAppEventType,
  messageBody: string
): Promise<WhatsAppLog> {
  const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');

  // Log message dispatch to Supabase
  const { data, error } = await supabase
    .from('whatsapp_notifications_log')
    .insert({
      user_id: userId,
      recipient_phone: cleanPhone,
      event_type: eventType,
      message_body: messageBody,
      status: 'sent',
    })
    .select('*')
    .single();

  if (error) {
    console.warn('WhatsApp log persistence fallback:', error.message);
    return {
      id: `local-wa-${Date.now()}`,
      user_id: userId,
      recipient_phone: cleanPhone,
      event_type: eventType,
      message_body: messageBody,
      status: 'sent',
      created_at: new Date().toISOString(),
    };
  }

  return data as WhatsAppLog;
}

/**
 * Fetch WhatsApp logs for a specific student
 */
export async function getStudentWhatsAppLogs(userId: string): Promise<WhatsAppLog[]> {
  const { data, error } = await supabase
    .from('whatsapp_notifications_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Failed to load WhatsApp logs:', error.message);
    return [];
  }
  return (data ?? []) as WhatsAppLog[];
}

