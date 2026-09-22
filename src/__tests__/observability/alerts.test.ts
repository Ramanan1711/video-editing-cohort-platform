import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertManager } from '../../lib/observability/alerts';

describe('Operational Alert System', () => {
  beforeEach(() => {
    alertManager.clearAlerts();
  });

  it('records an operational alert and notifies subscribers', () => {
    const subscriber = vi.fn();
    const unsubscribe = alertManager.subscribe(subscriber);

    const alert = alertManager.addAlert(
      'general',
      'warning',
      'High Latency',
      'Database query took 1800ms'
    );

    expect(alert).toBeDefined();
    expect(alert.title).toBe('High Latency');
    expect(alert.severity).toBe('warning');
    expect(alert.dismissed).toBe(false);

    expect(subscriber).toHaveBeenCalled();
    const activeAlerts = alertManager.getActiveAlerts();
    expect(activeAlerts.length).toBe(1);
    expect(activeAlerts[0].id).toBe(alert.id);

    unsubscribe();
  });

  it('triggers a critical alert upon repeated failed authentication attempts', () => {
    const testEmail = 'hacker@malicious.com';

    // 1st and 2nd failed attempts
    alertManager.recordFailedAuth(testEmail, 'Invalid password');
    alertManager.recordFailedAuth(testEmail, 'Invalid password');
    expect(alertManager.getActiveAlerts().length).toBe(0);

    // 3rd failed attempt within 5 minutes triggers alert
    alertManager.recordFailedAuth(testEmail, 'Invalid password');
    const alerts = alertManager.getActiveAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('failed_auth');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toBe('Repeated Authentication Failures');
    expect(alerts[0].message).toContain(testEmail);
  });

  it('records database query errors and marks appropriate severity', () => {
    alertManager.recordDatabaseError('SELECT * FROM submissions', 'Connection timeout');
    const alerts = alertManager.getActiveAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('failed_db');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].message).toContain('Connection timeout');
  });

  it('records storage upload errors', () => {
    alertManager.recordStorageError('submissions', 'video_cut_v1.mp4', 'Payload too large');
    const alerts = alertManager.getActiveAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('storage_error');
    expect(alerts[0].title).toBe('Storage Bucket Upload Failure');
    expect(alerts[0].message).toContain('video_cut_v1.mp4');
  });

  it('records permission violation attempts', () => {
    alertManager.recordPermissionViolation('delete_cohort', 'student');
    const alerts = alertManager.getActiveAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('permission_issue');
    expect(alerts[0].title).toBe('Authorization Policy Violation');
    expect(alerts[0].message).toContain('student');
  });

  it('detects high API error spikes using a sliding window', () => {
    // Fire 5 errors in rapid succession
    for (let i = 0; i < 5; i++) {
      alertManager.recordErrorSpike(new Error(`Spike error #${i + 1}`));
    }

    const alerts = alertManager.getActiveAlerts();
    const spikeAlert = alerts.find((a) => a.type === 'error_spike');
    expect(spikeAlert).toBeDefined();
    expect(spikeAlert?.severity).toBe('critical');
    expect(spikeAlert?.title).toBe('High API Error Spike Detected');
  });

  it('dismisses single alerts and clears all alerts', () => {
    const alert1 = alertManager.addAlert('general', 'info', 'Alert 1', 'Notice 1');
    const alert2 = alertManager.addAlert('general', 'info', 'Alert 2', 'Notice 2');

    expect(alertManager.getActiveAlerts().length).toBe(2);

    alertManager.dismissAlert(alert1.id);
    expect(alertManager.getActiveAlerts().length).toBe(1);
    expect(alertManager.getActiveAlerts()[0].id).toBe(alert2.id);

    alertManager.clearAlerts();
    expect(alertManager.getActiveAlerts().length).toBe(0);
  });
});
