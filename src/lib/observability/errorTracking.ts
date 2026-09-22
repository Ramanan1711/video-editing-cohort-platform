// src/lib/observability/errorTracking.ts
// Sentry-compatible telemetry, breadcrumb recorder, and error tracking engine

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
}

class ErrorTracker {
  private dsn: string | null = null;
  private environment: string = 'development';
  private currentUser: TelemetryUser | null = null;
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxBreadcrumbs = 25;
  private errorBuffer: ErrorLogEntry[] = [];
  private readonly maxBuffer = 50;
  private initialized = false;

  init(options?: { dsn?: string; environment?: string }): void {
    if (options?.dsn !== undefined) {
      this.dsn = options.dsn;
    }
    if (options?.environment !== undefined) {
      this.environment = options.environment;
    }

    if (this.initialized) return;

    if (!this.dsn) {
      this.dsn = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) || null;
    }
    if (!this.environment) {
      this.environment = (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'development';
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), {
          handled: false,
          tags: { mechanism: 'window.onerror' },
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.captureException(reason, {
          handled: false,
          tags: { mechanism: 'window.onunhandledrejection' },
        });
      });
    }

    this.initialized = true;
    this.addBreadcrumb({
      category: 'ui',
      message: `Error tracking initialized in ${this.environment} mode`,
      level: 'info',
    });
  }

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

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const entry: Breadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString(),
    };
    this.breadcrumbs.push(entry);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

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
    };

    // Store in internal ring buffer
    this.errorBuffer.unshift(entry);
    if (this.errorBuffer.length > this.maxBuffer) {
      this.errorBuffer.pop();
    }

    // Add breadcrumb for this error
    this.addBreadcrumb({
      category: 'ui',
      message: `Exception: ${entry.message}`,
      level,
    });

    // If Sentry DSN is configured, dispatch telemetry
    if (this.dsn) {
      this.dispatchToSentry(entry);
    }

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
    };

    this.errorBuffer.unshift(entry);
    if (this.errorBuffer.length > this.maxBuffer) {
      this.errorBuffer.pop();
    }

    return entry;
  }

  getRecentErrors(): ErrorLogEntry[] {
    return [...this.errorBuffer];
  }

  clearRecentErrors(): void {
    this.errorBuffer = [];
  }

  clearErrorBuffer(): void {
    this.clearRecentErrors();
  }

  clearUser(): void {
    this.setUser(null);
  }

  private dispatchToSentry(entry: ErrorLogEntry): void {
    if (!this.dsn || typeof fetch === 'undefined') return;

    try {
      // Parse Sentry DSN: https://<key>@<host>/<project_id>
      const url = new URL(this.dsn);
      const key = url.username;
      const projectId = url.pathname.replace(/^\//, '');
      const sentryEndpoint = `https://${url.host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;

      const payload = {
        event_id: entry.id.replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32),
        timestamp: entry.timestamp,
        level: entry.level,
        logger: 'javascript',
        platform: 'javascript',
        environment: this.environment,
        message: entry.message,
        exception: {
          values: [
            {
              type: entry.title,
              value: entry.message,
              stacktrace: entry.stack ? { frames: [{ filename: entry.url, function: 'caller' }] } : undefined,
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
      };

      void fetch(sentryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silent swallow to prevent recursive logging
      });
    } catch {
      // Fallback silently
    }
  }
}

export const errorTracker = new ErrorTracker();

export function initErrorTracking(options?: { dsn?: string; environment?: string }): ErrorTracker {
  errorTracker.init(options);
  return errorTracker;
}
