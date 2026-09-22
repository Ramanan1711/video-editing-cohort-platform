// src/lib/observability/alerts.ts
// Real-time operational alert system: failed auth, DB query drops, storage upload failures, permission rejections, and API error spikes

export type AlertType =
  | 'failed_auth'
  | 'failed_db'
  | 'storage_error'
  | 'permission_issue'
  | 'error_spike'
  | 'general';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface OperationalAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  metadata?: Record<string, unknown>;
}

type AlertListener = (alerts: OperationalAlert[]) => void;

class AlertManager {
  private alerts: OperationalAlert[] = [];
  private readonly maxAlerts = 50;
  private listeners: Set<AlertListener> = new Set();

  // Sliding window tracker for error spikes (timestamps in ms)
  private errorTimestamps: number[] = [];
  private readonly spikeThreshold = 5; // 5 errors
  private readonly spikeWindowMs = 60_000; // within 1 minute

  // Failed auth tracker by email
  private failedAuthCounts: Map<string, { count: number; lastTime: number }> = new Map();

  subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener(this.getActiveAlerts());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const active = this.getActiveAlerts();
    this.listeners.forEach((l) => l(active));
  }

  addAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): OperationalAlert {
    const alert: OperationalAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      dismissed: false,
      metadata,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    this.notify();
    return alert;
  }

  getActiveAlerts(): OperationalAlert[] {
    return this.alerts.filter((a) => !a.dismissed);
  }

  getAllAlerts(): OperationalAlert[] {
    return [...this.alerts];
  }

  dismissAlert(id: string): void {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.dismissed = true;
      this.notify();
    }
  }

  clearAll(): void {
    this.alerts = [];
    this.failedAuthCounts.clear();
    this.errorTimestamps = [];
    this.notify();
  }

  clearAlerts(): void {
    this.clearAll();
  }

  // 1. Alert Trigger: Failed Authentication
  recordFailedAuth(email?: string, reason?: string): void {
    const key = email?.toLowerCase().trim() || 'unknown';
    const now = Date.now();
    const entry = this.failedAuthCounts.get(key) || { count: 0, lastTime: now };

    // Reset count if last failure was > 5 minutes ago
    if (now - entry.lastTime > 300_000) {
      entry.count = 1;
    } else {
      entry.count++;
    }
    entry.lastTime = now;
    this.failedAuthCounts.set(key, entry);

    if (entry.count >= 3) {
      this.addAlert(
        'failed_auth',
        'critical',
        'Repeated Authentication Failures',
        `Sign-in attempt failed repeatedly for ${key} (${entry.count} attempts): ${reason || 'Invalid credentials'}`,
        { email: key, attempts: entry.count, reason }
      );
    }
  }

  // 2. Alert Trigger: Database Query Failures
  recordDatabaseError(error: unknown, queryContext?: string): void {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const errObj = error as { code?: string };
    const code = errObj?.code || '';

    const isFatal =
      code === '42P01' || // relation does not exist
      code === '42883' || // function does not exist
      rawMsg.toLowerCase().includes('connection refused') ||
      rawMsg.toLowerCase().includes('timeout');

    this.addAlert(
      'failed_db',
      isFatal ? 'critical' : 'warning',
      isFatal ? 'Database Connectivity or Migration Outage' : 'Database Query Execution Failed',
      `Error in ${queryContext || 'PostgREST query'}: ${rawMsg}`,
      { code, rawMsg, queryContext }
    );

    this.trackErrorSpike();
  }

  // 3. Alert Trigger: Storage Upload Failures
  recordStorageError(bucket: string, fileName: string, error: unknown): void {
    const rawMsg = error instanceof Error ? error.message : String(error);
    this.addAlert(
      'storage_error',
      'warning',
      'Storage Bucket Upload Failure',
      `Failed to upload ${fileName} to bucket "${bucket}": ${rawMsg}`,
      { bucket, fileName, rawMsg }
    );
    this.trackErrorSpike();
  }

  // 4. Alert Trigger: Permission / RLS Violations
  recordPermissionIssue(action: string, role?: string, resource?: string): void {
    this.addAlert(
      'permission_issue',
      'warning',
      'Authorization Policy Violation',
      `Access denied for role "${role || 'anonymous'}" attempting action "${action}" on ${resource || 'restricted resource'} (Postgres RLS 42501).`,
      { action, role, resource }
    );
    this.trackErrorSpike();
  }

  recordPermissionViolation(action: string, role?: string, resource?: string): void {
    this.recordPermissionIssue(action, role, resource);
  }

  recordErrorSpike(error?: unknown): void {
    if (error) {
      // Error trace recorded
    }
    this.trackErrorSpike();
  }

  // 5. Alert Trigger: Error Spike Detection (Sliding Window)
  private trackErrorSpike(): void {
    const now = Date.now();
    this.errorTimestamps.push(now);

    // Keep only timestamps within the rolling window
    this.errorTimestamps = this.errorTimestamps.filter((t) => now - t <= this.spikeWindowMs);

    if (this.errorTimestamps.length >= this.spikeThreshold) {
      // Check if an error spike alert was already fired recently (< 1 minute ago)
      const existingSpike = this.alerts.find(
        (a) => a.type === 'error_spike' && !a.dismissed && now - new Date(a.timestamp).getTime() < this.spikeWindowMs
      );

      if (!existingSpike) {
        this.addAlert(
          'error_spike',
          'critical',
          'High API Error Spike Detected',
          `Elevated error rate: ${this.errorTimestamps.length} failures recorded within the last 60 seconds. Inspect server connectivity immediately.`,
          { errorCount: this.errorTimestamps.length, windowMs: this.spikeWindowMs }
        );
      }
    }
  }
}

export const alertManager = new AlertManager();
