import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemHealthTab } from '../../components/admin/tabs/SystemHealthTab';
import type { LaunchGateReport } from '../../lib/observability/launchReadinessGate';

describe('SystemHealthTab - Launch Readiness Gate Certification Card (Responsive Mobile Portrait)', () => {
  const mockReport: LaunchGateReport = {
    overallStatus: 'READY_FOR_LAUNCH',
    score: 100,
    totalCriteria: 8,
    passedCriteria: 8,
    warningCriteria: 0,
    failedCriteria: 0,
    timestamp: new Date().toISOString(),
    criteria: [
      {
        id: 'gate_1',
        number: 1,
        title: 'Database-Enforced Access Rules & RLS',
        category: 'security',
        status: 'PASSED',
        requirement: 'All access rules must be enforced by Postgres Row Level Security, not only client UI.',
        evidence: 'Database tables enforce row-level security and status checks.',
        technicalDetails: 'RLS policies active on all tables.',
      },
      {
        id: 'gate_2',
        number: 2,
        title: 'Private & Restricted Student Uploads',
        category: 'privacy',
        status: 'PASSED',
        requirement: 'Student video cuts and project files must be stored privately.',
        evidence: 'Submissions bucket public=false; folder-scoped RLS tokens enforced.',
        technicalDetails: 'getSecureSubmissionUrl with time-limited signed tokens.',
      },
      {
        id: 'gate_3',
        number: 3,
        title: 'Role-Based Route Protection & Suspended State Lockout',
        category: 'routing',
        status: 'PASSED',
        requirement: 'ProtectedRoute validated across all role tiers.',
        evidence: 'Session checks active.',
        technicalDetails: 'Role-based guardrails active.',
      },
    ],
  };

  const defaultProps = {
    healthReport: null,
    healthChecking: false,
    onRunHealthCheck: vi.fn().mockResolvedValue(undefined),
    platformAnalytics: null,
    analyticsLoading: false,
    analyticsCohortFilter: 'all',
    onAnalyticsCohortChange: vi.fn().mockResolvedValue(undefined),
    cohortBaseline: null,
    onRefreshOperations: vi.fn().mockResolvedValue(undefined),
    deploymentReport: null,
    launchGateReport: mockReport,
    auditingGate: false,
    onRunLaunchGateAudit: vi.fn().mockResolvedValue(undefined),
    alerts: [],
    onDismissAlert: vi.fn(),
    onClearAlerts: vi.fn(),
    cohorts: [],
    sentryTesting: false,
    sentryProbeResult: null,
    onTestSentry: vi.fn().mockResolvedValue(undefined),
    onClearSentryProbeResult: vi.fn(),
    errorStats: null,
    errorLogs: [],
    errorLogsLoading: false,
    errorSearch: '',
    onErrorSearchChange: vi.fn(),
    errorLevelFilter: 'all' as const,
    onErrorLevelFilterChange: vi.fn(),
    onLoadErrorTelemetry: vi.fn().mockResolvedValue(undefined),
    onResolveError: vi.fn().mockResolvedValue(undefined),
  };

  it('renders the Launch Readiness Gate card with heading, status badge, and Passed Gates metrics', () => {
    render(<SystemHealthTab {...defaultProps} />);

    expect(screen.getByText('Checklist 8: Launch Readiness Gate')).toBeInTheDocument();
    expect(screen.getByText('READY FOR LAUNCH (100%)')).toBeInTheDocument();
    expect(screen.getByText('8 / 8')).toBeInTheDocument();
    expect(screen.getByText('Score: 100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Audit Launch Readiness/i })).toBeInTheDocument();
  });

  it('renders full criteria titles and unclipped evidence text on all viewports', () => {
    render(<SystemHealthTab {...defaultProps} />);

    // Gate 1 full title & evidence
    expect(screen.getByText('Database-Enforced Access Rules & RLS')).toBeInTheDocument();
    expect(
      screen.getByText(/Database tables enforce row-level security and status checks/)
    ).toBeInTheDocument();

    // Gate 2 full title & evidence
    expect(screen.getByText('Private & Restricted Student Uploads')).toBeInTheDocument();
    expect(
      screen.getByText(/Submissions bucket public=false; folder-scoped RLS tokens enforced/)
    ).toBeInTheDocument();

    // Gate 3 full title
    expect(
      screen.getByText('Role-Based Route Protection & Suspended State Lockout')
    ).toBeInTheDocument();
  });

  it('triggers onRunLaunchGateAudit when the Audit button is clicked', () => {
    const onAudit = vi.fn().mockResolvedValue(undefined);
    render(<SystemHealthTab {...defaultProps} onRunLaunchGateAudit={onAudit} />);

    const auditBtn = screen.getByRole('button', { name: /Audit Launch Readiness/i });
    fireEvent.click(auditBtn);
    expect(onAudit).toHaveBeenCalledTimes(1);
  });

  it('renders loading state when auditingGate is true without existing report', () => {
    render(
      <SystemHealthTab
        {...defaultProps}
        launchGateReport={null}
        auditingGate={true}
      />
    );

    expect(screen.getByText(/Evaluating Gates.../i)).toBeInTheDocument();
  });

  it('renders friendly empty state with action button when launchGateReport is null', () => {
    const onAudit = vi.fn().mockResolvedValue(undefined);
    render(
      <SystemHealthTab
        {...defaultProps}
        launchGateReport={null}
        auditingGate={false}
        onRunLaunchGateAudit={onAudit}
      />
    );

    expect(
      screen.getByText('Launch readiness criteria have not been evaluated yet.')
    ).toBeInTheDocument();
    const runBtn = screen.getByRole('button', { name: 'Run Launch Readiness Audit' });
    expect(runBtn).toBeInTheDocument();
    fireEvent.click(runBtn);
    expect(onAudit).toHaveBeenCalledTimes(1);
  });
});
