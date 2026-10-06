import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  HardDrive,
  Lock,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import type { Cohort } from '../../../lib/courseService';
import type { SystemHealthReport } from '../../../lib/observability/healthCheck';
import type { OperationalAlert } from '../../../lib/observability/alerts';
import type {
  CohortReportingBaseline,
  PlatformAnalytics,
} from '../../../lib/observability/analytics';
import type {
  DeploymentCheckItem,
  DeploymentReport,
} from '../../../lib/observability/deploymentCheck';
import type { LaunchGateReport } from '../../../lib/observability/launchReadinessGate';
import type {
  DurableErrorTelemetryStats,
  ErrorLogEntry,
  SentryVerificationResult,
} from '../../../lib/observability/errorTracking';

export interface SystemHealthTabProps {
  healthReport: SystemHealthReport | null;
  healthChecking: boolean;
  onRunHealthCheck: () => Promise<void>;
  onRefreshOperations: () => Promise<void>;
  launchGateReport: LaunchGateReport | null;
  auditingGate: boolean;
  onRunLaunchGateAudit: () => Promise<void>;
  alerts: OperationalAlert[];
  onDismissAlert: (id: string) => void;
  onClearAlerts: () => void;
  cohorts: Cohort[];
  analyticsCohortFilter: string;
  onAnalyticsCohortChange: (cohortId: string) => Promise<void>;
  analyticsLoading: boolean;
  cohortBaseline: CohortReportingBaseline | null;
  platformAnalytics: PlatformAnalytics | null;
  deploymentReport: DeploymentReport | null;
  sentryTesting: boolean;
  sentryProbeResult: SentryVerificationResult | null;
  onTestSentry: () => Promise<void>;
  onClearSentryProbeResult: () => void;
  errorStats: DurableErrorTelemetryStats | null;
  errorLogs: ErrorLogEntry[];
  errorLogsLoading: boolean;
  errorSearch: string;
  onErrorSearchChange: (val: string) => void;
  errorLevelFilter: 'all' | 'error' | 'fatal' | 'warning' | 'info';
  onErrorLevelFilterChange: (val: 'all' | 'error' | 'fatal' | 'warning' | 'info') => void;
  onLoadErrorTelemetry: () => Promise<void>;
  onResolveError: (id: string, currentResolved: boolean) => Promise<void>;
}

export function SystemHealthTab({
  healthReport,
  healthChecking,
  onRunHealthCheck,
  onRefreshOperations,
  launchGateReport,
  auditingGate,
  onRunLaunchGateAudit,
  alerts,
  onDismissAlert,
  onClearAlerts,
  cohorts,
  analyticsCohortFilter,
  onAnalyticsCohortChange,
  analyticsLoading,
  cohortBaseline,
  platformAnalytics,
  deploymentReport,
  sentryTesting,
  sentryProbeResult,
  onTestSentry,
  onClearSentryProbeResult,
  errorStats,
  errorLogs,
  errorLogsLoading,
  errorSearch,
  onErrorSearchChange,
  errorLevelFilter,
  onErrorLevelFilterChange,
  onLoadErrorTelemetry,
  onResolveError,
}: SystemHealthTabProps) {
  const [selectedErrorEntry, setSelectedErrorEntry] = useState<ErrorLogEntry | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
            <Activity className="text-orange-500" size={22} /> System Operations &amp; Observability
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Real-time health probes, active operational alerts, application SaaS analytics, and deployment preflight validation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onRunHealthCheck()}
            disabled={healthChecking}
            className="gap-2"
          >
            <RefreshCw size={14} className={healthChecking ? 'animate-spin' : ''} />
            {healthChecking ? 'Probing Services...' : 'Run Diagnostics'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onRefreshOperations()}
            disabled={healthChecking || analyticsLoading}
            className="gap-2"
          >
            <RefreshCw size={14} className={analyticsLoading ? 'animate-spin' : ''} />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Launch Readiness Gate Certification Card */}
      <Card className="p-6 border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Checklist 8: Launch Readiness Gate
                  {launchGateReport && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        launchGateReport.overallStatus === 'READY_FOR_LAUNCH'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {launchGateReport.overallStatus === 'READY_FOR_LAUNCH'
                        ? 'READY FOR LAUNCH (100%)'
                        : 'ACTION REQUIRED'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mandatory security-first pre-launch gate certifying database RLS, upload privacy, route locks, data isolation, error resilience, automated QA, monitoring, and controlled RBAC.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Passed Gates</p>
              <p className="text-lg font-black text-emerald-400">
                {launchGateReport ? `${launchGateReport.passedCriteria} / ${launchGateReport.totalCriteria}` : '—'}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onRunLaunchGateAudit()}
              disabled={auditingGate}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold"
            >
              <RefreshCw size={14} className={auditingGate ? 'animate-spin' : ''} />
              {auditingGate ? 'Evaluating Gates...' : 'Audit Launch Readiness'}
            </Button>
          </div>
        </div>

        {/* 8 Gate Criteria Grid */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {launchGateReport?.criteria.map((gate) => (
            <div
              key={gate.id}
              className={`rounded-xl border p-3.5 transition-all ${
                gate.status === 'PASSED'
                  ? 'border-emerald-500/30 bg-slate-900/80 hover:border-emerald-500/50'
                  : 'border-red-500/40 bg-red-950/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black text-slate-400">
                  GATE 0{gate.number}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    gate.status === 'PASSED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {gate.status === 'PASSED' ? <Check size={10} /> : <AlertTriangle size={10} />}
                  {gate.status}
                </span>
              </div>
              <h4 className="mt-2 text-xs font-bold text-white line-clamp-1">{gate.title}</h4>
              <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
                {gate.requirement}
              </p>
              <p className="mt-2 text-[10px] font-mono text-emerald-400/90 border-t border-slate-800/80 pt-2 truncate">
                ✓ {gate.evidence}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Health Probes Banner */}
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Overall System Health</span>
              {healthReport ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    healthReport.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800'
                      : healthReport.status === 'degraded'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {healthReport.status === 'healthy' ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}
                  {healthReport.status.toUpperCase()}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Evaluating...</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Checked at: {healthReport ? new Date(healthReport.timestamp).toLocaleTimeString() : '—'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Database Probe */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Server size={14} className="text-slate-500" />
                  <span>Database</span>
                </div>
                <span
                  className={`inline-block size-2 rounded-full ${
                    healthReport?.services.database.status === 'healthy'
                      ? 'bg-emerald-500'
                      : healthReport?.services.database.status === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-mono font-bold text-slate-900">
                  {healthReport?.services.database.latencyMs != null
                    ? `${healthReport.services.database.latencyMs}ms`
                    : '—'}
                </span>
                <span className="capitalize text-[11px] text-slate-500">
                  {healthReport?.services.database.status || 'unknown'}
                </span>
              </div>
            </div>

            {/* Storage Probe */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <HardDrive size={14} className="text-slate-500" />
                  <span>Storage</span>
                </div>
                <span
                  className={`inline-block size-2 rounded-full ${
                    healthReport?.services.storage.status === 'healthy'
                      ? 'bg-emerald-500'
                      : healthReport?.services.storage.status === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-mono font-bold text-slate-900">
                  {healthReport?.services.storage.latencyMs != null
                    ? `${healthReport.services.storage.latencyMs}ms`
                    : '—'}
                </span>
                <span className="capitalize text-[11px] text-slate-500">
                  {healthReport?.services.storage.status || 'unknown'}
                </span>
              </div>
            </div>

            {/* Auth Probe */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Lock size={14} className="text-slate-500" />
                  <span>Auth Engine</span>
                </div>
                <span
                  className={`inline-block size-2 rounded-full ${
                    healthReport?.services.auth.status === 'healthy'
                      ? 'bg-emerald-500'
                      : healthReport?.services.auth.status === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-mono font-bold text-slate-900">
                  {healthReport?.services.auth.latencyMs != null
                    ? `${healthReport.services.auth.latencyMs}ms`
                    : '—'}
                </span>
                <span className="capitalize text-[11px] text-slate-500">
                  {healthReport?.services.auth.status || 'unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Active Operational Alerts Feed */}
      <Card className="p-5 border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-orange-500" />
            <h3 className="text-sm font-black text-slate-950">Active Operational Alerts</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
              {alerts.length}
            </span>
          </div>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAlerts}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          {alerts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={24} />
              All operational metrics and error thresholds are nominal. No active incident alerts.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start justify-between rounded-xl border p-3.5 transition-colors ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50/50'
                    : alert.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-blue-200 bg-blue-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex rounded-full p-1 ${
                      alert.severity === 'critical'
                        ? 'bg-red-100 text-red-600'
                        : alert.severity === 'warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    <AlertTriangle size={14} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                        {alert.type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{alert.message}</p>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onDismissAlert(alert.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                  title="Dismiss Alert"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Application SaaS Telemetry Analytics */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-orange-500" /> SaaS Telemetry &amp; Learning Analytics
            </h3>
            <p className="text-xs text-slate-500">
              Authoritative metrics covering user activation, completion velocities, assignment SLA, and cohort retention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Scope:</span>
            <select
              value={analyticsCohortFilter}
              onChange={(e) => void onAnalyticsCohortChange(e.target.value)}
              disabled={analyticsLoading}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-orange-500 focus:outline-hidden"
            >
              <option value="all">Platform-Wide (All Cohorts)</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name || 'Cohort'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Authoritative Cohort Reporting Baseline Card */}
        {cohortBaseline && (
          <Card className="p-4 mb-4 border-orange-200 bg-linear-to-r from-orange-50/50 to-amber-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-orange-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-orange-600 px-2 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                    Authoritative Baseline
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{cohortBaseline.cohortName}</h4>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {cohortBaseline.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Authoritative server-side reporting baseline with verified syllabus watch, assignment SLAs, and attendance.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <div>Capacity: <strong className="text-slate-900">{cohortBaseline.enrollment.totalEnrolled} / {cohortBaseline.capacity}</strong> ({cohortBaseline.enrollment.fillRatePct}%)</div>
                <div>At-Risk: <strong className="text-amber-700 font-bold">{cohortBaseline.atRiskStudentsCount}</strong></div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Retention</span>
                <strong className="text-base font-black text-emerald-600">{cohortBaseline.enrollment.retentionRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.enrollment.activeCount} active · {cohortBaseline.enrollment.droppedCount} dropped</span>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Curriculum Watch</span>
                <strong className="text-base font-black text-slate-900">{cohortBaseline.curriculum.completionRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.curriculum.completedLessons} done · {cohortBaseline.curriculum.avgWatchPercentage}% avg watch</span>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Submissions Rate</span>
                <strong className="text-base font-black text-slate-900">{cohortBaseline.submissions.submissionRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.submissions.actualSubmissions} of {cohortBaseline.submissions.expectedSubmissions} exp.</span>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">On-Time Rate</span>
                <strong className="text-base font-black text-purple-600">{cohortBaseline.submissions.onTimeRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.submissions.onTimeSubmissions} on-time · {cohortBaseline.submissions.lateSubmissions} late</span>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Review SLA &lt;24h</span>
                <strong className="text-base font-black text-orange-600">{cohortBaseline.reviewSla.slaComplianceRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.reviewSla.avgTurnaroundHours}h avg turnaround</span>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-3xs border border-orange-100">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Attendance</span>
                <strong className="text-base font-black text-blue-600">{cohortBaseline.attendance.attendanceRatePct}%</strong>
                <span className="block text-[10px] text-slate-400">{cohortBaseline.attendance.liveSessionsCount} workshops</span>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Active Users */}
          <Card className="p-4 border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Active Users &amp; Roles</span>
              <Users size={15} className="text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950">
                {platformAnalytics?.activeUsers.total ?? 0}
              </span>
              <span className="text-[11px] text-slate-400">total accounts</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Students: <strong className="text-slate-800">{platformAnalytics?.activeUsers.students ?? 0}</strong></span>
              <span>Mentors: <strong className="text-slate-800">{platformAnalytics?.activeUsers.mentors ?? 0}</strong></span>
              <span>Admins: <strong className="text-slate-800">{platformAnalytics?.activeUsers.admins ?? 0}</strong></span>
            </div>
          </Card>

          {/* Lesson Completion Rate */}
          <Card className="p-4 border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Curriculum Completion</span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950">
                {platformAnalytics ? `${platformAnalytics.lessonCompletion.completionRatePct}%` : '—'}
              </span>
              <span className="text-[11px] text-slate-400">completion rate</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, platformAnalytics?.lessonCompletion.completionRatePct ?? 0)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {platformAnalytics?.lessonCompletion.completedLessons ?? 0} completed across {platformAnalytics?.lessonCompletion.totalEnrollments ?? 0} enrollments ({platformAnalytics?.lessonCompletion.avgWatchPercentage ?? 0}% avg watch)
            </p>
          </Card>

          {/* Assignment Timeliness */}
          <Card className="p-4 border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Submission Timeliness</span>
              <Clock size={15} className="text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950">
                {platformAnalytics ? `${platformAnalytics.assignmentSubmissions.onTimeRatePct}%` : '—'}
              </span>
              <span className="text-[11px] text-slate-400">on-time rate</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(100, platformAnalytics?.assignmentSubmissions.onTimeRatePct ?? 0)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {platformAnalytics?.assignmentSubmissions.onTimeSubmissions ?? 0} on-time · {platformAnalytics?.assignmentSubmissions.lateSubmissions ?? 0} late · {platformAnalytics?.assignmentSubmissions.totalSubmissions ?? 0} total
            </p>
          </Card>

          {/* Review SLA Compliance */}
          <Card className="p-4 border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Mentor Review Turnaround</span>
              <ShieldCheck size={15} className="text-orange-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950">
                {platformAnalytics?.reviewTurnaround.avgTurnaroundHours != null
                  ? `${platformAnalytics.reviewTurnaround.avgTurnaroundHours}h`
                  : '—'}
              </span>
              <span className="text-[11px] text-slate-400">avg turnaround</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>SLA &lt;24h: <strong className="text-slate-800">{platformAnalytics ? `${platformAnalytics.reviewTurnaround.slaComplianceRatePct}%` : '—'}</strong></span>
              <span>Graded: <strong className="text-slate-800">{platformAnalytics?.reviewTurnaround.totalGraded ?? 0}</strong></span>
              <span>Queue: <strong className="text-slate-800">{platformAnalytics?.reviewTurnaround.pendingQueue ?? 0}</strong></span>
            </div>
          </Card>
        </div>
      </div>

      {/* Deployment & Environment Preflight Audit */}
      <Card className="p-5 border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
              <Shield size={16} className="text-blue-500" /> Deployment Preflight &amp; Security Validation
            </h3>
            <p className="text-xs text-slate-500">
              Verifies client configuration, environment integrity, and browser crypto capability.
            </p>
          </div>
          {deploymentReport && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                deploymentReport.status === 'pass'
                  ? 'bg-emerald-100 text-emerald-800'
                  : deploymentReport.status === 'warn'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {deploymentReport.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {deploymentReport?.items.map((check: DeploymentCheckItem, idx: number) => (
            <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex rounded-full p-1 ${
                    check.status === 'pass'
                      ? 'bg-emerald-50 text-emerald-600'
                      : check.status === 'warn'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {check.status === 'pass' ? (
                    <Check size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-900">{check.name}</p>
                  <p className="text-xs text-slate-600">{check.message}</p>
                  {check.details && (
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{check.details}</p>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  check.status === 'pass'
                    ? 'bg-emerald-50 text-emerald-700'
                    : check.status === 'warn'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Application Error Telemetry & Durable Logs */}
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <ShieldAlert size={16} />
              </span>
              <h3 className="text-sm font-black text-slate-950">Application Error Telemetry &amp; Durable Logs</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Durable Sync Active
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              PostgreSQL database-backed error monitoring, persistent local storage buffer, and verified RFC-compliant Sentry envelope dispatch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onTestSentry()}
              disabled={sentryTesting}
              className="gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={sentryTesting ? 'animate-spin' : ''} />
              {sentryTesting ? 'Probing Sentry...' : 'Test Sentry Probe'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onLoadErrorTelemetry()}
              disabled={errorLogsLoading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={errorLogsLoading ? 'animate-spin' : ''} />
              Refresh Logs
            </Button>
          </div>
        </div>

        {/* Sentry Probe Result Alert */}
        {sentryProbeResult && (
          <div
            className={`mt-4 flex items-start justify-between rounded-xl border p-3 text-xs ${
              sentryProbeResult.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {sentryProbeResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-bold">{sentryProbeResult.message}</p>
                {sentryProbeResult.endpoint && (
                  <p className="text-[11px] font-mono opacity-80 mt-0.5">
                    Target Endpoint: {sentryProbeResult.endpoint} ({sentryProbeResult.latencyMs}ms)
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClearSentryProbeResult}
              className="text-slate-400 hover:text-slate-700 ml-2"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Error KPI Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tracked</p>
            <p className="mt-1 text-xl font-black text-slate-900">{errorStats?.total ?? errorLogs.length}</p>
            <span className="text-[10px] text-slate-400">lifetime captured</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last 24 Hours</p>
            <p className="mt-1 text-xl font-black text-slate-900">{errorStats?.last24Hours ?? 0}</p>
            <span className="text-[10px] text-slate-400">recent incidents</span>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Fatal / Crashes</p>
            <p className="mt-1 text-xl font-black text-rose-600">{errorStats?.fatalCount ?? 0}</p>
            <span className="text-[10px] text-rose-400">critical failures</span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Unhandled</p>
            <p className="mt-1 text-xl font-black text-amber-700">{errorStats?.unhandledCount ?? 0}</p>
            <span className="text-[10px] text-amber-500">window.onerror</span>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Resolved</p>
            <p className="mt-1 text-xl font-black text-emerald-700">{errorStats?.resolvedCount ?? 0}</p>
            <span className="text-[10px] text-emerald-500">closed by ops</span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={errorSearch}
              onChange={(e) => onErrorSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onLoadErrorTelemetry();
              }}
              placeholder="Search errors by title, message, or user..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-orange-500 focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={errorLevelFilter}
              onChange={(e) => onErrorLevelFilterChange(e.target.value as 'all' | 'error' | 'fatal' | 'warning' | 'info')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-orange-500 focus:outline-hidden"
            >
              <option value="all">All Severities</option>
              <option value="fatal">Fatal Only</option>
              <option value="error">Error Only</option>
              <option value="warning">Warning Only</option>
              <option value="info">Info Only</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onLoadErrorTelemetry()}
              className="text-xs"
            >
              Filter
            </Button>
          </div>
        </div>

        {/* Error Log Entries List */}
        <div className="mt-4 space-y-2.5">
          {errorLogsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-slate-400" />
              Loading durable error telemetry...
            </div>
          ) : errorLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
              No application errors recorded matching current criteria. All systems nominal.
            </div>
          ) : (
            errorLogs.map((entry) => {
              const isResolved = Boolean(entry.extra?.resolved);
              return (
                <div
                  key={entry.id}
                  className={`flex flex-col gap-3 rounded-xl border p-3.5 transition sm:flex-row sm:items-start sm:justify-between ${
                    isResolved
                      ? 'border-slate-200 bg-slate-50/50 opacity-70'
                      : entry.level === 'fatal'
                      ? 'border-rose-200 bg-rose-50/40'
                      : entry.level === 'error'
                      ? 'border-orange-200 bg-orange-50/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        entry.level === 'fatal'
                          ? 'bg-red-100 text-red-700'
                          : entry.level === 'error'
                          ? 'bg-rose-100 text-rose-700'
                          : entry.level === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {entry.level}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{entry.title}</h4>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            entry.handled ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {entry.handled ? 'HANDLED' : 'UNHANDLED CRASH'}
                        </span>
                        {entry.persistedToServer ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                            DB PERSISTED
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                            QUEUED
                          </span>
                        )}
                        {isResolved && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-700 line-clamp-2">{entry.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        {entry.user?.email && <span>User: {entry.user.email}</span>}
                        {entry.url && <span className="truncate max-w-xs">URL: {entry.url}</span>}
                        {entry.breadcrumbs.length > 0 && (
                          <span>{entry.breadcrumbs.length} breadcrumbs recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => setSelectedErrorEntry(entry)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => void onResolveError(entry.id, isResolved)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                        isResolved
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {isResolved ? 'Reopen' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Error Detail Inspector Modal */}
      {selectedErrorEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-700 uppercase">
                    {selectedErrorEntry.level}
                  </span>
                  <h3 className="text-base font-black text-slate-950">{selectedErrorEntry.title}</h3>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  ID: {selectedErrorEntry.id} · {new Date(selectedErrorEntry.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedErrorEntry(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div>
                <h4 className="text-xs font-bold text-slate-700">Error Message</h4>
                <p className="mt-1 text-xs text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
                  {selectedErrorEntry.message}
                </p>
              </div>

              {selectedErrorEntry.stack && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Stack Trace</h4>
                  <pre className="mt-1 max-h-48 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] font-mono text-rose-300 leading-relaxed">
                    {selectedErrorEntry.stack}
                  </pre>
                </div>
              )}

              {selectedErrorEntry.breadcrumbs.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700">
                    Diagnostic Breadcrumbs ({selectedErrorEntry.breadcrumbs.length})
                  </h4>
                  <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                    {selectedErrorEntry.breadcrumbs.map((b, idx) => (
                      <div key={idx} className="py-1.5 text-[11px] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-700 uppercase">
                            {b.category}
                          </span>
                          <span className="text-slate-800">{b.message}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(b.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-700">User &amp; Environment Context</h4>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                  <p>
                    <strong>User:</strong> {selectedErrorEntry.user?.email || 'Anonymous'} (
                    {selectedErrorEntry.user?.role || 'none'})
                  </p>
                  <p>
                    <strong>URL:</strong> {selectedErrorEntry.url || 'N/A'}
                  </p>
                  <p>
                    <strong>Environment:</strong> {selectedErrorEntry.tags?.environment || 'development'}
                  </p>
                  <p>
                    <strong>Handled:</strong> {selectedErrorEntry.handled ? 'Yes' : 'No (Fatal Crash)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedErrorEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

