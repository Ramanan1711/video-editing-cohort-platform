import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Megaphone,
  Radio,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import type { AdminExecutiveMetrics, AdminStats, AuditLog } from '../../../lib/adminService';

export interface OverviewTabProps {
  stats: AdminStats;
  execMetrics: AdminExecutiveMetrics | null;
  auditLogs: AuditLog[];
  canViewAuditLogs: boolean;
  onNavigateTab: (tab: string) => void;
  onSelectCohort: (cohortId: string) => void;
  onOpenEnrollModal: () => void;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card className="p-5 shadow-2xs">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
    </Card>
  );
}

export function OverviewTab({
  stats,
  execMetrics,
  auditLogs,
  canViewAuditLogs,
  onNavigateTab,
  onSelectCohort,
  onOpenEnrollModal,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users size={18} className="text-orange-600" />}
          label="Total Registered Users"
          value={stats.users}
          sub={`${stats.students} Students · ${stats.mentors} Mentors · ${stats.admins} Admins`}
        />
        <StatCard
          icon={<CalendarDays size={18} className="text-blue-600" />}
          label="Active Cohorts"
          value={stats.cohorts}
          sub={`${stats.enrollments} total student enrollments`}
        />
        <StatCard
          icon={<Award size={18} className="text-purple-600" />}
          label="Submissions Processed"
          value={stats.pendingSubmissions + stats.reviewedSubmissions}
          sub={`${stats.pendingSubmissions} pending mentor evaluation`}
        />
        <StatCard
          icon={<Radio size={18} className="text-emerald-600" />}
          label="Live Mentorship & Events"
          value={stats.sessions}
          sub={`${stats.announcements} broadcasts published`}
        />
      </div>

      {/* Actionable Executive Intelligence */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Activity size={16} className="text-orange-500" /> Executive Analytics &amp; Academy Health
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time conversion, completion velocity, and operational bottlenecks.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Enrollment Conversion</span>
              <TrendingUp size={15} className="text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950 dark:text-white">
                {execMetrics ? `${execMetrics.enrollmentConversionRate}%` : '—'}
              </span>
              <span className="text-[11px] text-slate-400">of registered</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, execMetrics?.enrollmentConversionRate ?? 0)}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Course Completion</span>
              <CheckCircle2 size={15} className="text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950 dark:text-white">
                {execMetrics ? `${execMetrics.courseCompletionRate}%` : '—'}
              </span>
              <span className="text-[11px] text-slate-400">graduation rate</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, execMetrics?.courseCompletionRate ?? 0)}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Avg Review Turnaround</span>
              <Clock size={15} className="text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950 dark:text-white">
                {execMetrics?.avgMentorReviewHours != null ? `${execMetrics.avgMentorReviewHours}h` : '—'}
              </span>
              <span className="text-[11px] text-slate-400">submission to review</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {execMetrics?.avgMentorReviewHours && execMetrics.avgMentorReviewHours < 24
                ? '⚡ Rapid mentor turnaround'
                : 'Target SLA: under 24 hours'}
            </p>
          </Card>

          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Dropout Risk Flags</span>
              <AlertTriangle size={15} className={(execMetrics?.dropoutRiskCount ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${(execMetrics?.dropoutRiskCount ?? 0) > 0 ? 'text-amber-600' : 'text-slate-950 dark:text-white'}`}>
                {execMetrics ? execMetrics.dropoutRiskCount : '0'}
              </span>
              <span className="text-[11px] text-slate-400">students flagged</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {(execMetrics?.dropoutRiskCount ?? 0) > 0
                ? 'Stalled > 7 days or ≥ 2 revisions'
                : '✓ All learners pacing on schedule'}
            </p>
          </Card>
        </div>
      </div>

      {/* Review Aging & Active User Velocity Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Review Aging Distribution */}
        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                <Clock size={15} className="text-orange-500" /> Pending Review Aging
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Turnaround queue age for submitted student cuts.</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              {stats.pendingSubmissions} total queue
            </span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-400">&lt; 12h</span>
              <strong className="mt-1 block text-lg font-black text-emerald-700 dark:text-emerald-300">
                {execMetrics?.reviewAging.lessThan12h ?? 0}
              </strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Fresh</span>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 dark:border-blue-950 dark:bg-blue-950/20 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-blue-800 dark:text-blue-400">12 - 24h</span>
              <strong className="mt-1 block text-lg font-black text-blue-700 dark:text-blue-300">
                {execMetrics?.reviewAging.between12and24h ?? 0}
              </strong>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Normal</span>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 dark:border-amber-950 dark:bg-amber-950/20 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-amber-800 dark:text-amber-400">24 - 48h</span>
              <strong className="mt-1 block text-lg font-black text-amber-700 dark:text-amber-300">
                {execMetrics?.reviewAging.between24and48h ?? 0}
              </strong>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Warning</span>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/50 dark:border-red-950 dark:bg-red-950/20 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-red-800 dark:text-red-400">&gt; 48h</span>
              <strong className="mt-1 block text-lg font-black text-red-700 dark:text-red-300">
                {execMetrics?.reviewAging.over48h ?? 0}
              </strong>
              <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">Overdue</span>
            </div>
          </div>
        </Card>

        {/* Active Users Velocity */}
        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
              <Flame size={15} className="text-orange-500" /> Platform User Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Learners and mentors actively logging in or submitting.</p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">7 Days</span>
              <strong className="mt-1 block text-xl font-black text-slate-950 dark:text-white">
                {execMetrics?.activeUsers7d ?? 0}
              </strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Active members</span>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">30 Days</span>
              <strong className="mt-1 block text-xl font-black text-slate-950 dark:text-white">
                {execMetrics?.activeUsers30d ?? 0}
              </strong>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Monthly active</span>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">90 Days</span>
              <strong className="mt-1 block text-xl font-black text-slate-950 dark:text-white">
                {execMetrics?.activeUsers90d ?? 0}
              </strong>
              <span className="text-[10px] text-slate-500 font-semibold">Quarterly active</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cohort Comparison Matrix */}
      <Card className="p-5 border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
              <Layers size={15} className="text-orange-500" /> Cohort Performance Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Benchmarking capacity, fill rate, completion, and submission velocity.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onNavigateTab('enrollments')}
            className="text-xs font-bold"
          >
            Manage Rosters →
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Cohort</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Enrollment / Capacity</th>
                <th className="py-2.5 px-3">Fill Rate</th>
                <th className="py-2.5 px-3">Completion</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {execMetrics?.cohortComparisons?.length ? (
                execMetrics.cohortComparisons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <strong className="text-slate-950 dark:text-white font-bold block">{c.name}</strong>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          c.status === 'published'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                            : c.status === 'draft'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {c.enrolledCount} / {c.capacity} students
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              c.fillPct >= 90 ? 'bg-orange-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, c.fillPct)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{c.fillPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 dark:text-white">{c.completionPct}%</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          onSelectCohort(c.id);
                          onNavigateTab('enrollments');
                        }}
                        className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        View Roster →
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No cohorts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Actions Panel */}
      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950 dark:text-white">Quick Operations</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fast paths for routine academy workflows.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => {
              onNavigateTab('enrollments');
              onOpenEnrollModal();
            }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-3.5 text-left transition hover:border-orange-300 hover:bg-white dark:hover:bg-slate-800"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400">
              <UserPlus size={18} />
            </div>
            <div>
              <strong className="block text-xs font-bold text-slate-900 dark:text-white">Enroll Student</strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Assign student to cohort</span>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('announcements')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-3.5 text-left transition hover:border-orange-300 hover:bg-white dark:hover:bg-slate-800"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              <Megaphone size={18} />
            </div>
            <div>
              <strong className="block text-xs font-bold text-slate-900 dark:text-white">Post Announcement</strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Broadcast milestone or note</span>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('sessions')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-3.5 text-left transition hover:border-orange-300 hover:bg-white dark:hover:bg-slate-800"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              <Radio size={18} />
            </div>
            <div>
              <strong className="block text-xs font-bold text-slate-900 dark:text-white">Schedule Live Review</strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Add Zoom/Meet session</span>
            </div>
          </button>

          <Link
            to="/admin/courses"
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-3.5 text-left transition hover:border-orange-300 hover:bg-white dark:hover:bg-slate-800"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <BookOpen size={18} />
            </div>
            <div>
              <strong className="block text-xs font-bold text-slate-900 dark:text-white">Course Authoring</strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Modules, videos &amp; assets</span>
            </div>
          </Link>
        </div>
      </Card>

      {/* Live Operational Activity Stream */}
      <Card className="p-5 border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
              <Activity size={15} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">Live Operational Activity Stream</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real-time platform operations and system events across all cohorts.</p>
            </div>
          </div>
          {canViewAuditLogs && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-bold"
            >
              View Complete Audit Trail →
            </Button>
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-center justify-between py-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {log.action.startsWith('user') ? (
                    <UserCheck size={14} />
                  ) : log.action.startsWith('cohort') ? (
                    <Layers size={14} />
                  ) : log.action.startsWith('announcement') ? (
                    <Megaphone size={14} />
                  ) : (
                    <Activity size={14} />
                  )}
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{log.actor_name || 'System'}</span>:{' '}
                    <span className="capitalize">{log.action.replace(/\./g, ' › ').replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {log.entity_type} {log.entity_id ? `• ${log.entity_id.slice(0, 8)}...` : ''}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
          {!auditLogs.length && (
            <p className="py-6 text-center text-xs text-slate-400">No operational activities recorded recently.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
