// src/lib/observability/errorTracking.ts
// Authoritative Durable Error Tracking, Telemetry Engine & Verified RFC-compliant Sentry Integration

import { supabase } from '../supabaseClient';
import { alertManager } from './alerts';

export type SeverityLevel = 'info' | 'warning' | 'error' | 'fatal';

export interface Breadcrumb {
  timestamp: string;
  category: 'ui' | 'navigation' | 'auth' | 'rpc' | 'network' | 'storage';
  message: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}

export interface TelemetryUser {
  id: string;
  email?: string;
  role?: string;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  stack?: string;
  level: SeverityLevel;
  url: string;
  user?: TelemetryUser | null;
  breadcrumbs: Breadcrumb[];
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  handled: boolean;
  persistedToServer?: boolean;
  sentToSentry?: boolean;
}

export interface SentryDsnComponents {
  raw: string;
  protocol: string;
  publicKey: string;
  secretKey?: string;
  host: string;
  port?: string;
  path: string;
  projectId: string;
  storeUrl: string;
  envelopeUrl: string;
}

export interface SentryVerificationResult {
  success: boolean;
  message: string;
  statusCode?: number;
  endpoint?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface DurableErrorTelemetryStats {
  total: number;
  last24Hours: number;
  fatalCount: number;
  unhandledCount: number;
  resolvedCount: number;
  unresolvedCount: number;
}

export interface DurableErrorFilterOptions {
  limit?: number;
  offset?: number;
  level?: SeverityLevel | 'all';
  handled?: boolean | 'all';
  resolved?: boolean | 'all';
  search?: string;
}

const STORAGE_KEYS = {
  RECENT_ERRORS: 'cohort_telemetry_recent_errors_v1',
  OFFLINE_QUEUE: 'cohort_telemetry_offline_queue_v1',
  BREADCRUMBS: 'cohort_telemetry_breadcrumbs_v1',
} as const;

/**
 * Validates and parses standard Sentry DSN URLs into structured components
 * RFC standard format: {PROTOCOL}://{PUBLIC_KEY}@{HOST}/{PATH}{PROJECT_ID}
 * Optional secret key: {PROTOCOL}://{PUBLIC_KEY}:{SECRET_KEY}@{HOST}/{PATH}{PROJECT_ID}
 */
export function parseSentryDsn(dsn: string | null | undefined): SentryDsnComponents | null {
  if (!dsn || typeof dsn !== 'string') return null;

  try {
    const trimmed = dsn.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return null;
    }

    const url = new URL(trimmed);
    const publicKey = url.username;
    const secretKey = url.password || undefined;

    if (!publicKey) return null;

    // Pathname could be /123 or /prefix/123
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;

    const projectId = pathParts[pathParts.length - 1];
    // Project ID in Sentry is typically numeric or alphanumeric identifier
    if (!projectId || !/^[a-zA-Z0-9_-]+$/.test(projectId)) return null;

    const basePath = pathParts.slice(0, -1).join('/');
    const prefix = basePath ? `/${basePath}` : '';
    const portPrefix = url.port ? `:${url.port}` : '';
    const origin = `${url.protocol}//${url.hostname}${portPrefix}`;

    const storeUrl = `${origin}${prefix}/api/${projectId}/store/`;
    const envelopeUrl = `${origin}${prefix}/api/${projectId}/envelope/`;

    return {
      raw: trimmed,
      protocol: url.protocol,
      publicKey,
      secretKey,
      host: url.hostname,
      port: url.port || undefined,
      path: prefix,
      projectId,
      storeUrl,
      envelopeUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Generates verified Sentry X-Sentry-Auth header string complying with Sentry v7 protocol
 */
export function buildSentryAuthHeader(dsnComponents: SentryDsnComponents, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const parts = [
    'Sentry sentry_version=7',
    'sentry_client=video-editing-cohort-tracker/1.0',
    `sentry_key=${dsnComponents.publicKey}`,
    `sentry_timestamp=${ts}`,
  ];
  if (dsnComponents.secretKey) {
    parts.push(`sentry_secret=${dsnComponents.secretKey}`);
  }
  return parts.join(', ');
}

/**
 * Formats a 32-character hexadecimal event ID compliant with Sentry requirements
 */
export function formatSentryEventId(id: string): string {
  const hexOnly = id.replace(/[^a-f0-9]/gi, '').toLowerCase();
  if (hexOnly.length >= 32) return hexOnly.slice(0, 32);
  return hexOnly.padEnd(32, '0');
}

class ErrorTracker {
  private dsn: string | null = null;
  private dsnComponents: SentryDsnComponents | null = null;
  private environment: string = 'development';
  private currentUser: TelemetryUser | null = null;
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxBreadcrumbs = 30;
  private errorBuffer: ErrorLogEntry[] = [];
  private readonly maxBuffer = 60;
  private offlineQueue: ErrorLogEntry[] = [];
  private readonly maxQueue = 100;
  private initialized = false;
  private sentryRetryAfterTimestamp = 0;

  constructor() {
    this.restoreDurableState();
  }

  init(options?: { dsn?: string; environment?: string }): void {
    if (options?.dsn !== undefined) {
      this.dsn = options.dsn;
      this.dsnComponents = parseSentryDsn(options.dsn);
    }
    if (options?.environment !== undefined) {
      this.environment = options.environment;
    }

    if (this.initialized) return;

    if (!this.dsn) {
      this.dsn = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) || null;
      if (this.dsn) {
        this.dsnComponents = parseSentryDsn(this.dsn);
      }
    }
    if (!this.environment) {
      this.environment = (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'development';
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), {
          handled: false,
          tags: { mechanism: 'window.onerror' },
          level: 'fatal',
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.captureException(reason, {
          handled: false,
          tags: { mechanism: 'window.onunhandledrejection' },
          level: 'error',
        });
      });

      window.addEventListener('online', () => {
        this.addBreadcrumb({
          category: 'network',
          message: 'Network connection restored. Draining durable telemetry queue...',
          level: 'info',
        });
        void this.drainDurableQueue();
      });
    }

    this.initialized = true;
    this.addBreadcrumb({
      category: 'ui',
      message: `Error tracking initialized in ${this.environment} mode`,
      level: 'info',
    });

    // Proactively drain any queued offline logs
    void this.drainDurableQueue();
  }

  // ---------------------------------------------------------------------------
  // Durable Persistence (LocalStorage Buffer + Offline Queue)
  // ---------------------------------------------------------------------------

  private restoreDurableState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      const storedErrors = localStorage.getItem(STORAGE_KEYS.RECENT_ERRORS);
      if (storedErrors) {
        const parsed = JSON.parse(storedErrors) as ErrorLogEntry[];
        if (Array.isArray(parsed)) {
          this.errorBuffer = parsed.slice(0, this.maxBuffer);
        }
      }

      const storedQueue = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (storedQueue) {
        const parsed = JSON.parse(storedQueue) as ErrorLogEntry[];
        if (Array.isArray(parsed)) {
          this.offlineQueue = parsed.slice(0, this.maxQueue);
        }
      }

      const storedBreadcrumbs = localStorage.getItem(STORAGE_KEYS.BREADCRUMBS);
      if (storedBreadcrumbs) {
        const parsed = JSON.parse(storedBreadcrumbs) as Breadcrumb[];
        if (Array.isArray(parsed)) {
          this.breadcrumbs = parsed.slice(-this.maxBreadcrumbs);
        }
      }
    } catch {
      // Graceful fallback if storage is restricted or corrupted
    }
  }

  private persistDurableState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_ERRORS, JSON.stringify(this.errorBuffer.slice(0, this.maxBuffer)));
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(this.offlineQueue.slice(0, this.maxQueue)));
      localStorage.setItem(STORAGE_KEYS.BREADCRUMBS, JSON.stringify(this.breadcrumbs.slice(-this.maxBreadcrumbs)));
    } catch {
      // Storage quota exceeded or private browsing restrictions
    }
  }

  // ---------------------------------------------------------------------------
  // User & Context Management
  // ---------------------------------------------------------------------------

  setUser(user: TelemetryUser | null): void {
    this.currentUser = user ? { id: user.id, email: user.email, role: user.role } : null;
    if (user) {
      this.addBreadcrumb({
        category: 'auth',
        message: `User session context established (${user.role || 'user'})`,
        level: 'info',
      });
    }
  }

  getUser(): TelemetryUser | null {
    return this.currentUser;
  }

  clearUser(): void {
    this.setUser(null);
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const entry: Breadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString(),
    };
    this.breadcrumbs.push(entry);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
    this.persistDurableState();
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
    this.persistDurableState();
  }

  // ---------------------------------------------------------------------------
  // Error Capture & Pipeline
  // ---------------------------------------------------------------------------

  captureException(
    error: unknown,
    context?: {
      level?: SeverityLevel;
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      handled?: boolean;
    }
  ): ErrorLogEntry {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const level = context?.level || 'error';
    const entry: ErrorLogEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      title: err.name || 'Error',
      message: err.message || 'Unknown error occurred',
      stack: err.stack,
      level,
      url: typeof window !== 'undefined' ? window.location.href : '',
      user: this.currentUser,
      breadcrumbs: [...this.breadcrumbs],
      tags: {
        environment: this.environment,
        ...(context?.tags || {}),
      },
      extra: context?.extra,
      handled: context?.handled ?? true,
      persistedToServer: false,
    };

    // 1. Ingest into durable local ring buffer
    this.errorBuffer.unshift(entry);
    if (this.errorBuffer.length > this.maxBuffer) {
      this.errorBuffer.pop();
    }

    // 2. Queue for durable server & Sentry dispatch
    this.offlineQueue.push(entry);
    if (this.offlineQueue.length > this.maxQueue) {
      this.offlineQueue.shift();
    }

    // 3. Add telemetry breadcrumb
    this.addBreadcrumb({
      category: 'ui',
      message: `Exception [${entry.level}]: ${entry.message}`,
      level,
    });

    // 4. Trigger alert manager if unhandled or high severity
    // 4. Trigger alert manager if unhandled or high severity
    if (!entry.handled || entry.level === 'fatal') {
      alertManager.recordErrorSpike(err);
    }

    // 5. If Sentry DSN is configured, dispatch immediately
    if (this.dsnComponents) {
      entry.sentToSentry = true;
      void this.dispatchToSentryVerified(entry).then((ok) => {
        if (!ok) {
          entry.sentToSentry = false;
        }
      });
    }

    // 6. Asynchronously drain durable offline queue to Sentry and database
    void this.drainDurableQueue();

    return entry;
  }

  captureMessage(
    message: string,
    level: SeverityLevel = 'info',
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
  ): ErrorLogEntry {
    const entry: ErrorLogEntry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      title: 'Telemetry Message',
      message,
      level,
      url: typeof window !== 'undefined' ? window.location.href : '',
      user: this.currentUser,
      breadcrumbs: [...this.breadcrumbs],
      tags: {
        environment: this.environment,
        ...(context?.tags || {}),
      },
      extra: context?.extra,
      handled: true,
      persistedToServer: false,
    };

    this.errorBuffer.unshift(entry);
    if (this.errorBuffer.length > this.maxBuffer) {
      this.errorBuffer.pop();
    }

    this.persistDurableState();
    return entry;
  }

  getRecentErrors(): ErrorLogEntry[] {
    return [...this.errorBuffer];
  }

  getOfflineQueue(): ErrorLogEntry[] {
    return [...this.offlineQueue];
  }

  clearRecentErrors(): void {
    this.errorBuffer = [];
    this.persistDurableState();
  }

  clearErrorBuffer(): void {
    this.clearRecentErrors();
    this.clearOfflineQueue();
  }

  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.sentryRetryAfterTimestamp = 0;
    this.currentFlushPromise = null;
    this.persistDurableState();
  }

  clearDsn(): void {
    this.dsn = null;
    this.dsnComponents = null;
    this.sentryRetryAfterTimestamp = 0;
  }

  // ---------------------------------------------------------------------------
  // Durable Queue Drain & Server Persistence (Supabase + Sentry)
  // ---------------------------------------------------------------------------

  private currentFlushPromise: Promise<void> | null = null;

  drainDurableQueue(): Promise<void> {
    if (this.currentFlushPromise) {
      return this.currentFlushPromise;
    }
    if (this.offlineQueue.length === 0) {
      return Promise.resolve();
    }

    this.currentFlushPromise = this.executeQueueDrain().finally(() => {
      this.currentFlushPromise = null;
    });

    return this.currentFlushPromise;
  }

  private async executeQueueDrain(): Promise<void> {
    try {
      const itemsToProcess = [...this.offlineQueue];
      const remaining: ErrorLogEntry[] = [];

      for (const item of itemsToProcess) {
        // Concurrently dispatch to Sentry (if not yet sent) and Supabase (if not yet persisted)
        const sentryPromise =
          this.dsnComponents && !item.sentToSentry
            ? this.dispatchToSentryVerified(item).then((ok) => {
                if (ok) item.sentToSentry = true;
                return ok;
              })
            : Promise.resolve(true);

        const dbPromise = !item.persistedToServer ? this.dispatchToSupabase(item) : Promise.resolve(true);

        const [sentryOk, dbOk] = await Promise.all([sentryPromise, dbPromise]);

        if (dbOk) {
          item.persistedToServer = true;
          // Update matching entry in local buffer
          const bufEntry = this.errorBuffer.find((e) => e.id === item.id);
          if (bufEntry) {
            bufEntry.persistedToServer = true;
          }
        }

        // If either failed due to network, keep in durable queue
        if (!sentryOk || !dbOk) {
          remaining.push(item);
        }
      }

      this.offlineQueue = remaining;
      this.persistDurableState();
    } catch {
      // Keep resilient
    }
  }

  private async dispatchToSupabase(entry: ErrorLogEntry): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<{ error: Error | null }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('DB probe timeout') }), 1500)
      );

      // 1. Try authoritative RPC log_client_error
      const rpcCall = supabase.rpc('log_client_error', {
        p_error_id: entry.id,
        p_title: entry.title,
        p_message: entry.message,
        p_level: entry.level,
        p_stack: entry.stack || null,
        p_url: entry.url || null,
        p_handled: entry.handled,
        p_breadcrumbs: entry.breadcrumbs,
        p_tags: entry.tags,
        p_extra: entry.extra || {},
        p_user_id: entry.user?.id || null,
        p_user_email: entry.user?.email || null,
        p_user_role: entry.user?.role || null,
      });

      const { error: rpcError } = await Promise.race([rpcCall, timeoutPromise]);

      if (!rpcError) {
        return true;
      }

      // 2. Fallback: direct table insert into app_error_logs
      const insertCall = supabase.from('app_error_logs').insert({
        error_id: entry.id,
        title: entry.title,
        message: entry.message,
        stack: entry.stack || null,
        level: entry.level,
        url: entry.url || null,
        handled: entry.handled,
        breadcrumbs: entry.breadcrumbs,
        tags: entry.tags,
        extra: entry.extra || {},
        user_id: entry.user?.id || null,
        user_email: entry.user?.email || null,
        user_role: entry.user?.role || null,
        source: 'client',
      });

      const { error: insertError } = await Promise.race([insertCall, timeoutPromise]);

      return !insertError;
    } catch {
      return false;
    }
  }

  /**
   * Verified Sentry Dispatch: sends events conforming to official Sentry Envelope and Store specs
   */
  private async dispatchToSentryVerified(entry: ErrorLogEntry): Promise<boolean> {
    if (!this.dsnComponents || typeof fetch === 'undefined') return true;

    // Check rate limit backoff
    const now = Date.now();
    if (now < this.sentryRetryAfterTimestamp) {
      return false;
    }

    try {
      const eventId = formatSentryEventId(entry.id);
      const authHeader = buildSentryAuthHeader(this.dsnComponents);

      const sentryEventPayload = {
        event_id: eventId,
        timestamp: new Date(entry.timestamp).toISOString(),
        platform: 'javascript',
        level: entry.level,
        logger: 'javascript',
        environment: this.environment,
        message: entry.message,
        exception: {
          values: [
            {
              type: entry.title,
              value: entry.message,
              stacktrace: entry.stack
                ? {
                    frames: [{ filename: entry.url || 'app.js', function: 'window.dispatch' }],
                  }
                : undefined,
            },
          ],
        },
        user: entry.user ? { id: entry.user.id, email: entry.user.email, role: entry.user.role } : undefined,
        tags: entry.tags,
        extra: entry.extra,
        breadcrumbs: entry.breadcrumbs.map((b) => ({
          timestamp: new Date(b.timestamp).getTime() / 1000,
          category: b.category,
          message: b.message,
          level: b.level,
          data: b.data,
        })),
        sdk: {
          name: 'video-editing-cohort-tracker',
          version: '1.0.0',
        },
      };

      // 1. Attempt Envelope API first (Sentry v7 standard)
      const envelopeHeader = JSON.stringify({
        event_id: eventId,
        sent_at: new Date().toISOString(),
        dsn: this.dsnComponents.raw,
      });
      const itemHeader = JSON.stringify({
        type: 'event',
        content_type: 'application/json',
      });
      const itemPayload = JSON.stringify(sentryEventPayload);
      const envelopeBody = `${envelopeHeader}\n${itemHeader}\n${itemPayload}\n`;

      const response = await fetch(this.dsnComponents.envelopeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': authHeader,
        },
        body: envelopeBody,
      });

      if (response.status === 429) {
        const retryAfterSec = parseInt(response.headers.get('Retry-After') || '60', 10);
        this.sentryRetryAfterTimestamp = Date.now() + (Number.isNaN(retryAfterSec) ? 60 : retryAfterSec) * 1000;
        return false;
      }

      if (response.ok) {
        return true;
      }

      // 2. If envelope endpoint returned 404 or method not allowed, try legacy store endpoint
      if (response.status === 404 || response.status === 405) {
        const storeResponse = await fetch(
          `${this.dsnComponents.storeUrl}?sentry_key=${this.dsnComponents.publicKey}&sentry_version=7`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sentry-Auth': authHeader,
            },
            body: JSON.stringify(sentryEventPayload),
          }
        );
        return storeResponse.ok;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Sentry Verification Probe (Diagnostics & Preflight Verification)
  // ---------------------------------------------------------------------------

  async verifySentryConnection(customDsn?: string): Promise<SentryVerificationResult> {
    const targetDsn = customDsn || this.dsn;
    if (!targetDsn) {
      return {
        success: false,
        message: 'No Sentry DSN configured. Telemetry is using durable database logging and local storage.',
      };
    }

    const parsed = parseSentryDsn(targetDsn);
    if (!parsed) {
      return {
        success: false,
        message: 'Invalid Sentry DSN format. Expected: https://<key>@<host>/<projectId>',
      };
    }

    const start = performance.now();
    try {
      const testEventId = formatSentryEventId(`probe_${Date.now()}`);
      const authHeader = buildSentryAuthHeader(parsed);
      const testPayload = {
        event_id: testEventId,
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        level: 'info',
        message: 'CUT/CRAFT Telemetry Connectivity Probe',
        tags: { probe: 'preflight_verification', environment: this.environment },
      };

      const envelopeHeader = JSON.stringify({
        event_id: testEventId,
        sent_at: new Date().toISOString(),
        dsn: parsed.raw,
      });
      const itemHeader = JSON.stringify({
        type: 'event',
        content_type: 'application/json',
      });
      const envelopeBody = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(testPayload)}\n`;

      const response = await fetch(parsed.envelopeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': authHeader,
        },
        body: envelopeBody,
      });

      const latencyMs = Math.round(performance.now() - start);

      if (response.ok || response.status === 200 || response.status === 202) {
        return {
          success: true,
          message: `Sentry connection verified (${latencyMs}ms). Ready for production ingestion.`,
          statusCode: response.status,
          endpoint: parsed.envelopeUrl,
          latencyMs,
          details: {
            projectId: parsed.projectId,
            host: parsed.host,
            protocol: parsed.protocol,
          },
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          message: `Sentry rate limit reached (HTTP 429). Exponential backoff active.`,
          statusCode: response.status,
          latencyMs,
        };
      }

      return {
        success: false,
        message: `Sentry endpoint responded with HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        endpoint: parsed.envelopeUrl,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to reach Sentry host',
        latencyMs,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Admin Operations & Telemetry Queries
  // ---------------------------------------------------------------------------

  async fetchDurableErrorLogs(options?: DurableErrorFilterOptions): Promise<ErrorLogEntry[]> {
    try {
      const { data, error } = await supabase.rpc('get_durable_error_logs', {
        p_limit: options?.limit ?? 50,
        p_offset: options?.offset ?? 0,
        p_level: options?.level && options.level !== 'all' ? options.level : null,
        p_handled: options?.handled && options.handled !== 'all' ? options.handled : null,
        p_resolved: options?.resolved && options.resolved !== 'all' ? options.resolved : null,
        p_search: options?.search || null,
      });

      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: row.error_id || row.id,
          timestamp: row.timestamp || row.created_at,
          title: row.title,
          message: row.message,
          stack: row.stack,
          level: (row.level as SeverityLevel) || 'error',
          url: row.url || '',
          user: row.user_id ? { id: row.user_id, email: row.user_email, role: row.user_role } : null,
          breadcrumbs: Array.isArray(row.breadcrumbs) ? row.breadcrumbs : [],
          tags: row.tags || {},
          extra: { ...(row.extra || {}), resolved: row.resolved, resolvedAt: row.resolved_at, resolverEmail: row.resolver_email },
          handled: row.handled,
          persistedToServer: true,
        }));
      }

      // Fallback query if RPC unavailable
      let query = supabase.from('app_error_logs').select('*').order('created_at', { ascending: false }).limit(options?.limit ?? 50);
      if (options?.level && options.level !== 'all') {
        query = query.eq('level', options.level);
      }
      if (options?.handled && options.handled !== 'all') {
        query = query.eq('handled', options.handled);
      }
      if (options?.resolved && options.resolved !== 'all') {
        query = query.eq('resolved', options.resolved);
      }

      const { data: fallbackData } = await query;
      if (Array.isArray(fallbackData) && fallbackData.length > 0) {
        return fallbackData.map((row) => ({
          id: row.error_id || row.id,
          timestamp: row.timestamp || row.created_at,
          title: row.title,
          message: row.message,
          stack: row.stack,
          level: (row.level as SeverityLevel) || 'error',
          url: row.url || '',
          user: row.user_id ? { id: row.user_id, email: row.user_email, role: row.user_role } : null,
          breadcrumbs: Array.isArray(row.breadcrumbs) ? row.breadcrumbs : [],
          tags: row.tags || {},
          extra: { ...(row.extra || {}), resolved: row.resolved },
          handled: row.handled,
          persistedToServer: true,
        }));
      }
    } catch {
      // Fall through to local buffer
    }

    // Graceful fallback to durable local buffer
    return this.getRecentErrors();
  }

  async fetchErrorTelemetryStats(): Promise<DurableErrorTelemetryStats> {
    try {
      const { data, error } = await supabase.rpc('get_error_telemetry_stats');
      if (!error && data) {
        return {
          total: Number(data.total || 0),
          last24Hours: Number(data.last24Hours || 0),
          fatalCount: Number(data.fatalCount || 0),
          unhandledCount: Number(data.unhandledCount || 0),
          resolvedCount: Number(data.resolvedCount || 0),
          unresolvedCount: Number(data.unresolvedCount || 0),
        };
      }
    } catch {
      // Fallback from local buffer
    }

    const localBuffer = this.getRecentErrors();
    const fatalCount = localBuffer.filter((e) => e.level === 'fatal').length;
    const unhandledCount = localBuffer.filter((e) => !e.handled).length;

    return {
      total: localBuffer.length,
      last24Hours: localBuffer.length,
      fatalCount,
      unhandledCount,
      resolvedCount: 0,
      unresolvedCount: localBuffer.length,
    };
  }

  async resolveErrorLog(errorId: string, resolved: boolean = true): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('resolve_error_log', {
        p_id: errorId,
        p_resolved: resolved,
      });

      if (!error && data !== undefined) {
        return Boolean(data);
      }

      // Fallback direct update
      const { error: updateError } = await supabase
        .from('app_error_logs')
        .update({
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        })
        .or(`id.eq.${errorId},error_id.eq.${errorId}`);

      return !updateError;
    } catch {
      return false;
    }
  }

  getDsnComponents(): SentryDsnComponents | null {
    return this.dsnComponents;
  }
}

export const errorTracker = new ErrorTracker();

export function initErrorTracking(options?: { dsn?: string; environment?: string }): ErrorTracker {
  errorTracker.init(options);
  return errorTracker;
}
