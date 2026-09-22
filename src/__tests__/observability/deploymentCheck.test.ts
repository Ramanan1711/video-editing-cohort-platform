import { describe, it, expect } from 'vitest';
import { runDeploymentCheck } from '../../lib/observability/deploymentCheck';

describe('Deployment Preflight Check Suite', () => {
  it('runs preflight deployment checks and returns a structured audit report', () => {
    const report = runDeploymentCheck();

    expect(report).toBeDefined();
    expect(report.environment).toBeDefined();
    expect(['pass', 'warn', 'fail']).toContain(report.status);
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.totalChecks).toBe(report.items.length);
  });

  it('verifies essential categories: env, security, network, browser', () => {
    const report = runDeploymentCheck();
    const categories = new Set(report.items.map((i) => i.category));

    expect(categories.has('env')).toBe(true);
    expect(categories.has('browser')).toBe(true);
  });

  it('validates browser storage and crypto readiness in test runtime', () => {
    const report = runDeploymentCheck();
    const storageCheck = report.items.find((i) => i.id === 'browser_storage');
    expect(storageCheck).toBeDefined();
    expect(storageCheck?.status).toBe('pass');

    const cryptoCheck = report.items.find((i) => i.id === 'browser_crypto');
    expect(cryptoCheck).toBeDefined();
    expect(cryptoCheck?.status).toBe('pass');
  });
});

