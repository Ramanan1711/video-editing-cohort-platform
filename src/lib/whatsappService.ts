import { supabase } from './supabaseClient';

export type WhatsAppEventType =
  | 'welcome'
  | 'daily_challenge'
  | 'workshop_alert'
  | 'inactivity_nudge'
  | 'feedback'
  | 'graduation'
  | 'custom';

export type WhatsAppProviderType = 'meta' | 'twilio' | 'webhook' | 'mock' | 'manual';

export type WhatsAppDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface WhatsAppLog {
  id: string;
  user_id: string | null;
  cohort_id?: string | null;
  recipient_phone: string;
  event_type: WhatsAppEventType;
  message_body: string;
  provider: WhatsAppProviderType;
  provider_message_id?: string | null;
  status: WhatsAppDeliveryStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
  error_details?: string | null;
  created_at: string;
  // Joined fields
  student_name?: string;
  student_email?: string;
}

export interface WhatsAppDispatchOptions {
  userId?: string | null;
  cohortId?: string | null;
  phone: string;
  eventType: WhatsAppEventType;
  message: string;
  provider?: WhatsAppProviderType;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  maxRetries?: number;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  log: WhatsAppLog;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppCohortStats {
  cohort_id: string;
  total_messages: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  queued_count: number;
  delivery_rate_pct: number;
}

export interface WhatsAppProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  status: WhatsAppDeliveryStatus;
  error?: string;
  statusCode?: number;
}

export interface IWhatsAppProvider {
  name: WhatsAppProviderType;
  send(to: string, message: string, metadata?: Record<string, unknown>): Promise<WhatsAppProviderSendResult>;
}

// ---------------------------------------------------------------------------
// 1. Direct Click-to-Chat & Message Formatters
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 2. Automated Provider Adapters (Meta, Twilio, Webhook, Mock)
// ---------------------------------------------------------------------------

/**
 * Meta WhatsApp Cloud API Provider
 */
export class MetaWhatsAppProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType = 'meta';
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;

  constructor(phoneNumberId: string, accessToken: string, apiVersion = 'v18.0') {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  async send(to: string, message: string, metadata?: Record<string, unknown>): Promise<WhatsAppProviderSendResult> {
    const cleanPhone = to.replace(/[^0-9]/g, '');
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const payload = metadata?.templateName
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: metadata.templateName,
            language: { code: metadata.templateLang || 'en_US' },
            components: metadata.templateComponents || [],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: message },
        };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          statusCode: response.status,
          error: data?.error?.message || `Meta API HTTP ${response.status}`,
        };
      }

      const providerMessageId = data?.messages?.[0]?.id || `wamid.meta_${Date.now()}`;
      return {
        success: true,
        status: 'sent',
        providerMessageId,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'failed',
        error: `Meta network failure: ${errMsg}`,
      };
    }
  }
}

/**
 * Twilio WhatsApp API Provider
 */
export class TwilioWhatsAppProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType = 'twilio';
  accountSid: string;
  authToken: string;
  fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(to: string, message: string): Promise<WhatsAppProviderSendResult> {
    const cleanPhone = to.replace(/[^0-9]/g, '');
    const cleanFrom = this.fromNumber.startsWith('whatsapp:')
      ? this.fromNumber
      : `whatsapp:+${this.fromNumber.replace(/[^0-9]/g, '')}`;
    const cleanTo = `whatsapp:+${cleanPhone}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('From', cleanFrom);
    bodyParams.append('To', cleanTo);
    bodyParams.append('Body', message);

    try {
      const authHeader = 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          statusCode: response.status,
          error: data?.message || `Twilio HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        status: 'sent',
        providerMessageId: data?.sid || `SM_${Date.now()}`,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'failed',
        error: `Twilio network failure: ${errMsg}`,
      };
    }
  }
}

/**
 * Generic HTTP Webhook WhatsApp Gateway
 */
export class WebhookWhatsAppProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType = 'webhook';
  webhookUrl: string;
  apiKey?: string;

  constructor(webhookUrl: string, apiKey?: string) {
    this.webhookUrl = webhookUrl;
    this.apiKey = apiKey;
  }

  async send(to: string, message: string, metadata?: Record<string, unknown>): Promise<WhatsAppProviderSendResult> {
    const cleanPhone = to.replace(/[^0-9]/g, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
      } catch {
        // Proceed without auth header if session retrieval fails
      }
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient_phone: cleanPhone,
          message_body: message,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          statusCode: response.status,
          error: data?.error || `Webhook Gateway HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        status: 'sent',
        providerMessageId: data?.message_id || data?.id || `wh_${Date.now()}`,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'failed',
        error: `Webhook Gateway network failure: ${errMsg}`,
      };
    }
  }
}

/**
 * Manual Click-to-Chat WhatsApp Provider
 * Generates direct wa.me URLs for mentors/admins with zero API credentials
 */
export class ManualClickToChatProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType = 'manual';

  async send(to: string, message: string): Promise<WhatsAppProviderSendResult> {
    generateWhatsAppClickToChatUrl(to, message);
    return {
      success: true,
      status: 'queued',
      providerMessageId: `manual_${Date.now()}`,
      statusCode: 200,
    };
  }
}

/**
 * Server-Queued WhatsApp Provider (Meta & Twilio Client Gateway)
 * Enforces zero client-side secret exposure:
 * Third-party vendor tokens (Meta System User Access Token, Twilio Auth Token) are NOT bundled
 * into the client application. Messages are recorded into the database queue
 * (whatsapp_notifications_log) with status 'queued' for backend Edge Function or worker execution.
 */
export class ServerQueuedWhatsAppProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType;

  constructor(providerName: WhatsAppProviderType = 'meta') {
    this.name = providerName;
  }

  async send(_to: string, _message: string): Promise<WhatsAppProviderSendResult> {
    return {
      success: true,
      status: 'queued',
      providerMessageId: `queued_${this.name}_${Date.now()}`,
      statusCode: 202,
    };
  }
}

/**
 * Production-Ready Sandbox / Mock Provider with Simulated Network & Lifecycle
 */
export class MockWhatsAppProvider implements IWhatsAppProvider {
  name: WhatsAppProviderType = 'mock';
  shouldFail: boolean;

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  async send(_to: string, _message: string, metadata?: Record<string, unknown>): Promise<WhatsAppProviderSendResult> {
    // Allow metadata override for testing error handling and retries
    const forceFailure = metadata?.forceFailure === true || this.shouldFail;
    if (forceFailure) {
      return {
        success: false,
        status: 'failed',
        statusCode: 503,
        error: 'Simulated WhatsApp Gateway Service Unavailable (503)',
      };
    }

    const pseudoId = `wamid.mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      success: true,
      status: 'sent',
      providerMessageId: pseudoId,
      statusCode: 200,
    };
  }
}

/**
 * Resolves the configured WhatsApp provider.
 * SECURITY ARCHITECTURE:
 * Third-party vendor tokens (Meta Graph API Access Tokens, Twilio Auth Tokens) MUST NEVER
 * be read from client-side `import.meta.env` (e.g. `VITE_WHATSAPP_*`). Doing so causes Vite
 * to bundle live messaging credentials into public JavaScript assets.
 *
 * Direct third-party dispatches ('meta', 'twilio') from the client are routed to:
 * 1) A secure backend proxy webhook (`VITE_WHATSAPP_WEBHOOK_URL`) if configured, or
 * 2) `ServerQueuedWhatsAppProvider` which marks the log as 'queued' in Supabase,
 *    where a secure server-side Supabase Edge Function executes delivery with private secrets.
 */
export function getWhatsAppProvider(providerOverride?: WhatsAppProviderType): IWhatsAppProvider {
  const metaEnv = ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}) as Record<string, string | undefined>;
  const providerType = providerOverride || (metaEnv.VITE_WHATSAPP_PROVIDER as WhatsAppProviderType) || 'mock';

  if (providerType === 'manual') {
    return new ManualClickToChatProvider();
  }

  if (providerType === 'meta' || providerType === 'twilio') {
    const webhookUrl = metaEnv.VITE_WHATSAPP_WEBHOOK_URL;
    if (webhookUrl) {
      return new WebhookWhatsAppProvider(webhookUrl);
    }
    return new ServerQueuedWhatsAppProvider(providerType);
  }

  if (providerType === 'webhook') {
    const url = metaEnv.VITE_WHATSAPP_WEBHOOK_URL || '';
    if (url) {
      return new WebhookWhatsAppProvider(url);
    }
    console.warn('WhatsApp Webhook URL missing; falling back to Mock provider');
    return new MockWhatsAppProvider();
  }

  return new MockWhatsAppProvider();
}

// ---------------------------------------------------------------------------
// 3. Automated Dispatch & Exponential Backoff Retries
// ---------------------------------------------------------------------------

/**
 * Dispatches message via provider with in-flight retry loop for transient network glitches
 */
async function dispatchWithInFlightRetries(
  provider: IWhatsAppProvider,
  phone: string,
  message: string,
  metadata?: Record<string, unknown>,
  maxRetries = 2
): Promise<WhatsAppProviderSendResult> {
  let attempt = 0;
  let lastResult: WhatsAppProviderSendResult = {
    success: false,
    status: 'failed',
    error: 'Uninitialized dispatch',
  };

  while (attempt <= maxRetries) {
    try {
      const result = await provider.send(phone, message, metadata);
      if (result.success) {
        return result;
      }

      lastResult = result;

      // Only retry transient 429/5xx errors
      const isTransient =
        !result.statusCode ||
        result.statusCode === 429 ||
        (result.statusCode >= 500 && result.statusCode < 600);

      if (!isTransient || attempt === maxRetries) {
        return result;
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      lastResult = {
        success: false,
        status: 'failed',
        error: errMsg,
      };
      if (attempt === maxRetries) {
        return lastResult;
      }
    }

    attempt++;
    // Exponential backoff with jitter: 100ms * 2^attempt + jitter
    const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 50, 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return lastResult;
}

/**
 * Primary Canonical WhatsApp Dispatch Engine
 * Enforces opt-in verification, idempotency, provider execution, and database state sync
 */
export async function dispatchWhatsAppMessage(
  options: WhatsAppDispatchOptions
): Promise<WhatsAppDispatchResult> {
  const cleanPhone = options.phone.replace(/[^0-9]/g, '');
  const providerInstance = getWhatsAppProvider(options.provider);
  const providerName = providerInstance.name;
  const idempotencyKey = options.idempotencyKey || null;

  let logRecord: WhatsAppLog | null = null;

  // 1. Database-Level Registration & Opt-in Check (RPC First)
  try {
    const { data, error } = await supabase.rpc('dispatch_whatsapp_message', {
      p_user_id: options.userId || null,
      p_cohort_id: options.cohortId || null,
      p_recipient_phone: cleanPhone,
      p_event_type: options.eventType,
      p_message_body: options.message,
      p_provider: providerName,
      p_metadata: options.metadata || {},
      p_idempotency_key: idempotencyKey,
    });

    if (!error && data) {
      logRecord = data as WhatsAppLog;

      // If user opted out, RPC returns cancelled
      if (logRecord.status === 'cancelled') {
        return {
          success: false,
          log: logRecord,
          error: 'Recipient has opted out of WhatsApp communications',
        };
      }
    }
  } catch (err) {
    console.warn('RPC dispatch_whatsapp_message unavailable, using table fallback:', err);
  }

  // 1b. Direct Table Fallback if RPC failed or not deployed
  if (!logRecord) {
    // Check opt-in
    if (options.userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_opt_in')
        .eq('id', options.userId)
        .maybeSingle();

      if (profile && profile.whatsapp_opt_in === false) {
        const cancelledLog: WhatsAppLog = {
          id: `optout-${Date.now()}`,
          user_id: options.userId,
          cohort_id: options.cohortId || null,
          recipient_phone: cleanPhone,
          event_type: options.eventType,
          message_body: options.message,
          provider: providerName,
          status: 'cancelled',
          retry_count: 0,
          max_retries: options.maxRetries || 3,
          created_at: new Date().toISOString(),
          error_details: 'Recipient has opted out of WhatsApp communications',
        };
        return { success: false, log: cancelledLog, error: cancelledLog.error_details || undefined };
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('whatsapp_notifications_log')
      .insert({
        user_id: options.userId || null,
        cohort_id: options.cohortId || null,
        recipient_phone: cleanPhone,
        event_type: options.eventType,
        message_body: options.message,
        provider: providerName,
        status: 'queued',
        retry_count: 0,
        max_retries: options.maxRetries || 3,
        idempotency_key: idempotencyKey,
        metadata: options.metadata || {},
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      logRecord = {
        id: `local-wa-${Date.now()}`,
        user_id: options.userId || null,
        cohort_id: options.cohortId || null,
        recipient_phone: cleanPhone,
        event_type: options.eventType,
        message_body: options.message,
        provider: providerName,
        status: 'queued',
        retry_count: 0,
        max_retries: options.maxRetries || 3,
        created_at: new Date().toISOString(),
      };
    } else {
      logRecord = inserted as WhatsAppLog;
    }
  }

  // 2. Automated Provider Dispatch
  const sendResult = await dispatchWithInFlightRetries(
    providerInstance,
    cleanPhone,
    options.message,
    options.metadata
  );

  // 3. Update Database Delivery Lifecycle
  const logId = logRecord.id;
  const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logId);

  if (isRealUuid) {
    if (sendResult.success) {
      if (sendResult.status === 'queued') {
        // Message remains queued for server-side worker or manual dispatch
        await supabase
          .from('whatsapp_notifications_log')
          .update({
            status: 'queued',
            provider_message_id: sendResult.providerMessageId || null,
            error_details: null,
          })
          .eq('id', logId);
        logRecord.status = 'queued';
        logRecord.provider_message_id = sendResult.providerMessageId || null;
      } else {
        // Mark as sent via RPC
        try {
          const { data: updated } = await supabase.rpc('record_whatsapp_retry_attempt', {
            p_log_id: logId,
            p_success: true,
            p_error_details: null,
            p_provider_message_id: sendResult.providerMessageId || null,
          });
          if (updated) {
            logRecord = updated as WhatsAppLog;
          }
        } catch {
          // Table fallback
          await supabase
            .from('whatsapp_notifications_log')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: sendResult.providerMessageId || null,
              error_details: null,
            })
            .eq('id', logId);
          logRecord.status = 'sent';
          logRecord.provider_message_id = sendResult.providerMessageId || null;
        }
      }
    } else {
      // Record failure & exponential backoff via RPC
      try {
        const { data: updated } = await supabase.rpc('record_whatsapp_retry_attempt', {
          p_log_id: logId,
          p_success: false,
          p_error_details: sendResult.error || 'Provider dispatch failed',
          p_provider_message_id: null,
        });
        if (updated) {
          logRecord = updated as WhatsAppLog;
        }
      } catch {
        // Table fallback
        const newRetryCount = (logRecord.retry_count || 0) + 1;
        const maxRetries = logRecord.max_retries || 3;
        const isFailed = newRetryCount >= maxRetries;
        const nextRetryAt = isFailed
          ? null
          : new Date(Date.now() + Math.pow(2, newRetryCount) * 60 * 1000).toISOString();

        await supabase
          .from('whatsapp_notifications_log')
          .update({
            status: isFailed ? 'failed' : 'queued',
            retry_count: newRetryCount,
            error_details: sendResult.error || 'Provider dispatch failed',
            next_retry_at: nextRetryAt,
          })
          .eq('id', logId);

        logRecord.status = isFailed ? 'failed' : 'queued';
        logRecord.retry_count = newRetryCount;
        logRecord.error_details = sendResult.error || 'Provider dispatch failed';
        logRecord.next_retry_at = nextRetryAt;
      }
    }
  } else {
    // In-memory update for mock/fallback
    logRecord.status = sendResult.status || (sendResult.success ? 'sent' : 'failed');
    logRecord.provider_message_id = sendResult.providerMessageId;
    logRecord.error_details = sendResult.error;
    if (logRecord.status === 'sent') {
      logRecord.sent_at = new Date().toISOString();
    }
  }

  return {
    success: sendResult.success,
    log: logRecord,
    providerMessageId: sendResult.providerMessageId,
    error: sendResult.error,
  };
}

/**
 * Backward compatible signature matching existing calls
 */
export async function sendWhatsAppNotification(
  userId: string | null,
  recipientPhone: string,
  eventType: WhatsAppEventType,
  messageBody: string,
  cohortId?: string | null
): Promise<WhatsAppLog> {
  const result = await dispatchWhatsAppMessage({
    userId,
    cohortId,
    phone: recipientPhone,
    eventType,
    message: messageBody,
  });
  return result.log;
}

// ---------------------------------------------------------------------------
// 4. Automated Retry Processor (Queue Worker / Scheduled Task)
// ---------------------------------------------------------------------------

export interface RetryBatchSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  processedIds: string[];
}

/**
 * Scans queued or retryable failed WhatsApp logs and executes automated re-dispatch
 */
export async function processPendingWhatsAppRetries(maxBatchSize = 20): Promise<RetryBatchSummary> {
  const summary: RetryBatchSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    processedIds: [],
  };

  // 1. Fetch retry candidates
  let candidates: WhatsAppLog[] = [];
  try {
    const { data, error } = await supabase.rpc('get_pending_whatsapp_retries', {
      p_max_batch_size: maxBatchSize,
    });
    if (!error && Array.isArray(data)) {
      candidates = data as WhatsAppLog[];
    }
  } catch (err) {
    console.warn('RPC get_pending_whatsapp_retries unavailable, using direct query:', err);
  }

  if (candidates.length === 0) {
    const { data } = await supabase
      .from('whatsapp_notifications_log')
      .select('*')
      .in('status', ['queued', 'failed'])
      .lt('retry_count', 3)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(maxBatchSize);

    candidates = (data ?? []) as WhatsAppLog[];
  }

  if (candidates.length === 0) {
    return summary;
  }

  // 2. Process each retry candidate
  for (const log of candidates) {
    summary.attempted++;
    summary.processedIds.push(log.id);

    const providerInstance = getWhatsAppProvider(log.provider);
    const sendResult = await dispatchWithInFlightRetries(
      providerInstance,
      log.recipient_phone,
      log.message_body,
      log.metadata
    );

    // Update database status
    if (sendResult.status === 'queued') {
      try {
        await supabase
          .from('whatsapp_notifications_log')
          .update({
            status: 'queued',
            provider_message_id: sendResult.providerMessageId || log.provider_message_id,
          })
          .eq('id', log.id);
      } catch {
        // ignore fallback errors
      }
    } else {
      try {
        await supabase.rpc('record_whatsapp_retry_attempt', {
          p_log_id: log.id,
          p_success: sendResult.success,
          p_error_details: sendResult.error || null,
          p_provider_message_id: sendResult.providerMessageId || null,
        });
      } catch {
        const newCount = log.retry_count + 1;
        const isFailed = newCount >= log.max_retries;
        await supabase
          .from('whatsapp_notifications_log')
          .update({
            status: sendResult.success ? 'sent' : isFailed ? 'failed' : 'queued',
            retry_count: newCount,
            sent_at: sendResult.success ? new Date().toISOString() : log.sent_at,
            error_details: sendResult.error || null,
            next_retry_at: isFailed ? null : new Date(Date.now() + Math.pow(2, newCount) * 60000).toISOString(),
            provider_message_id: sendResult.providerMessageId || log.provider_message_id,
          })
          .eq('id', log.id);
      }
    }

    if (sendResult.success) {
      summary.succeeded++;
    } else {
      summary.failed++;
    }
  }

  return summary;
}

/**
 * Manually retry a specific WhatsApp message by log ID
 */
export async function retrySingleWhatsAppMessage(logId: string): Promise<WhatsAppDispatchResult> {
  const { data: log, error } = await supabase
    .from('whatsapp_notifications_log')
    .select('*')
    .eq('id', logId)
    .single();

  if (error || !log) {
    throw new Error(`WhatsApp log record ${logId} not found`);
  }

  const providerInstance = getWhatsAppProvider(log.provider);
  const sendResult = await dispatchWithInFlightRetries(
    providerInstance,
    log.recipient_phone,
    log.message_body,
    log.metadata
  );

  let updatedLog = log as WhatsAppLog;

  if (sendResult.status === 'queued') {
    await supabase
      .from('whatsapp_notifications_log')
      .update({
        status: 'queued',
        provider_message_id: sendResult.providerMessageId || null,
      })
      .eq('id', logId);
    updatedLog.status = 'queued';
    updatedLog.provider_message_id = sendResult.providerMessageId || null;
  } else {
    try {
      const { data: updated } = await supabase.rpc('record_whatsapp_retry_attempt', {
        p_log_id: logId,
        p_success: sendResult.success,
        p_error_details: sendResult.error || null,
        p_provider_message_id: sendResult.providerMessageId || null,
      });
      if (updated) {
        updatedLog = updated as WhatsAppLog;
      }
    } catch {
      const newCount = (log.retry_count || 0) + 1;
      await supabase
        .from('whatsapp_notifications_log')
        .update({
          status: sendResult.success ? 'sent' : 'failed',
          retry_count: newCount,
          sent_at: sendResult.success ? new Date().toISOString() : log.sent_at,
          error_details: sendResult.error || null,
          provider_message_id: sendResult.providerMessageId || log.provider_message_id,
        })
        .eq('id', logId);

      updatedLog.status = sendResult.success ? 'sent' : 'failed';
      updatedLog.retry_count = newCount;
      updatedLog.error_details = sendResult.error || null;
    }
  }

  return {
    success: sendResult.success,
    log: updatedLog,
    providerMessageId: sendResult.providerMessageId,
    error: sendResult.error,
  };
}

// ---------------------------------------------------------------------------
// 5. Inbound Delivery Status Synchronization (Webhook Handler)
// ---------------------------------------------------------------------------

/**
 * Ingests inbound delivery status webhook callbacks (e.g. Meta Cloud or Twilio delivery receipts)
 */
export async function syncWhatsAppDeliveryStatus(
  providerMessageId: string,
  status: WhatsAppDeliveryStatus,
  errorDetails?: string | null,
  timestamp?: string
): Promise<boolean> {
  const eventTime = timestamp || new Date().toISOString();

  // Find record by provider_message_id
  const { data: log, error } = await supabase
    .from('whatsapp_notifications_log')
    .select('id')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle();

  if (error || !log) {
    console.warn(`WhatsApp message receipt for ${providerMessageId} not found in database`);
    return false;
  }

  try {
    const deliveredAt = status === 'delivered' || status === 'read' ? eventTime : null;
    const readAt = status === 'read' ? eventTime : null;

    const { error: rpcErr } = await supabase.rpc('update_whatsapp_delivery_status', {
      p_log_id: log.id,
      p_provider_message_id: providerMessageId,
      p_status: status,
      p_error_details: errorDetails || null,
      p_delivered_at: deliveredAt,
      p_read_at: readAt,
    });

    if (!rpcErr) return true;
  } catch (err) {
    console.warn('update_whatsapp_delivery_status RPC failed, using fallback:', err);
  }

  // Table fallback
  const updates: Record<string, unknown> = {
    status,
    error_details: errorDetails || null,
  };
  if (status === 'delivered' || status === 'read') {
    updates.delivered_at = eventTime;
  }
  if (status === 'read') {
    updates.read_at = eventTime;
  }

  const { error: updateErr } = await supabase
    .from('whatsapp_notifications_log')
    .update(updates)
    .eq('id', log.id);

  return !updateErr;
}

// ---------------------------------------------------------------------------
// 6. Query & Telemetry Reporting
// ---------------------------------------------------------------------------

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

/**
 * List all WhatsApp messages for a cohort with student info
 */
export async function listCohortWhatsAppLogs(
  cohortId: string,
  options?: { status?: WhatsAppDeliveryStatus; limit?: number }
): Promise<WhatsAppLog[]> {
  try {
    let query = supabase
      .from('whatsapp_notifications_log')
      .select('*, profiles:user_id(full_name, email)')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map((item) => {
      const p = item.profiles as { full_name?: string; email?: string } | null;
      return {
        ...item,
        student_name: p?.full_name || 'Intern',
        student_email: p?.email || '',
      };
    }) as WhatsAppLog[];
  } catch (err) {
    console.warn('listCohortWhatsAppLogs failed:', err);
    return [];
  }
}

/**
 * Get cohort executive delivery statistics
 */
export async function getCohortWhatsAppStats(cohortId: string): Promise<WhatsAppCohortStats> {
  // 1. Try authoritative RPC
  try {
    const { data, error } = await supabase.rpc('get_cohort_whatsapp_stats', {
      p_cohort_id: cohortId,
    });
    if (!error && data) {
      return data as WhatsAppCohortStats;
    }
  } catch (err) {
    console.warn('RPC get_cohort_whatsapp_stats failed, using table query fallback:', err);
  }

  // 2. Direct Query Fallback
  const { data } = await supabase
    .from('whatsapp_notifications_log')
    .select('status')
    .eq('cohort_id', cohortId);

  const logs = data ?? [];
  const total = logs.length;
  const sent = logs.filter((l) => ['sent', 'delivered', 'read'].includes(l.status)).length;
  const delivered = logs.filter((l) => ['delivered', 'read'].includes(l.status)).length;
  const read = logs.filter((l) => l.status === 'read').length;
  const failed = logs.filter((l) => l.status === 'failed').length;
  const queued = logs.filter((l) => ['queued', 'sending'].includes(l.status)).length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0;

  return {
    cohort_id: cohortId,
    total_messages: total,
    sent_count: sent,
    delivered_count: delivered,
    read_count: read,
    failed_count: failed,
    queued_count: queued,
    delivery_rate_pct: deliveryRate,
  };
}
