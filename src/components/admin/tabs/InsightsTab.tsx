import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Layers,
  RefreshCw,
  Search,
  Table,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import type { AdminExecutiveMetrics, CourseDemandMetric } from '../../../lib/adminService';

export interface InsightsTabProps {
  execMetrics: AdminExecutiveMetrics | null;
  selectedTimeframe: '7d' | '30d' | '90d' | 'all';
  updatingTimeframe: boolean;
  onTimeframeChange: (tf: '7d' | '30d' | '90d' | 'all') => void;
  exportingExecutiveReport: boolean;
  onExportExecutiveReport: () => void;
  exportingAtRiskReport: boolean;
  onExportAtRiskLearners: () => void;
  courseDemand: CourseDemandMetric[];
  courseDemandLoading: boolean;
  onRefreshCourseDemand: () => void;
  onCopyNoteSuccess?: (msg: string) => void;
}

export function InsightsTab({
  execMetrics,
  selectedTimeframe,
  updatingTimeframe,
  onTimeframeChange,
  exportingExecutiveReport,
  onExportExecutiveReport,
  exportingAtRiskReport,
  onExportAtRiskLearners,
  courseDemand,
  courseDemandLoading,
  onRefreshCourseDemand,
  onCopyNoteSuccess,
}: InsightsTabProps) {
  // Course Demand local controls
  const [courseDemandFilter, setCourseDemandFilter] = useState<'all' | 'coding' | 'non_coding'>('all');
  const [courseDemandSort, setCourseDemandSort] = useState<'desc' | 'asc' | 'alpha'>('desc');
  const [courseDemandSearch, setCourseDemandSearch] = useState('');
  const [courseDemandViewMode, setCourseDemandViewMode] = useState<'chart' | 'table'>('chart');

  const filteredAndSortedDemand = useMemo(() => {
    let list = [...courseDemand];
    if (courseDemandFilter === 'coding') {
      list = list.filter((c) => c.trackType === 'coding');
    } else if (courseDemandFilter === 'non_coding') {
      list = list.filter((c) => c.trackType === 'non_coding');
    }
    if (courseDemandSearch.trim()) {
      const q = courseDemandSearch.toLowerCase().trim();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    if (courseDemandSort === 'desc') {
      list.sort((a, b) => b.enrolledStudentsCount - a.enrolledStudentsCount || a.title.localeCompare(b.title));
    } else if (courseDemandSort === 'asc') {
      list.sort((a, b) => a.enrolledStudentsCount - b.enrolledStudentsCount || a.title.localeCompare(b.title));
    } else if (courseDemandSort === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [courseDemand, courseDemandFilter, courseDemandSearch, courseDemandSort]);

  const courseDemandKPIs = useMemo(() => {
    if (!courseDemand.length) {
      return {
        mostDemanded: null as CourseDemandMetric | null,
        leastDemanded: null as CourseDemandMetric | null,
        totalActiveStudents: 0,
        underEnrolledCount: 0,
        activeCoursesCount: 0,
        coveragePct: 0,
        maxEnrollment: 1,
        scaleTicks: [0, 25, 50, 75, 100],
      };
    }
    const sorted = [...courseDemand].sort((a, b) => b.enrolledStudentsCount - a.enrolledStudentsCount);
    const mostDemanded = sorted[0]?.enrolledStudentsCount > 0 ? sorted[0] : null;
    const leastDemanded = sorted[sorted.length - 1];
    const totalActiveStudents = sorted.reduce((sum, c) => sum + c.enrolledStudentsCount, 0);
    const underEnrolledCount = sorted.filter((c) => c.enrolledStudentsCount === 0).length;
    const activeCoursesCount = sorted.filter((c) => c.enrolledStudentsCount > 0).length;
    const coveragePct = Math.round((activeCoursesCount / sorted.length) * 100);
    const maxEnrollment = Math.max(1, ...sorted.map((c) => c.enrolledStudentsCount));
    const step = maxEnrollment >= 4 ? Math.ceil(maxEnrollment / 4) : 1;
    const scaleTicks = [0, step, step * 2, step * 3, Math.max(step * 4, maxEnrollment)];

    return {
      mostDemanded,
      leastDemanded,
      totalActiveStudents,
      underEnrolledCount,
      activeCoursesCount,
      coveragePct,
      maxEnrollment,
      scaleTicks,
    };
  }, [courseDemand]);

  return (
    <div className="space-y-8">
      {/* Executive Reporting Header & Controls */}
      <Card className="p-5 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs font-bold text-xs">
                <TrendingUp size={15} />
              </span>
              <h2 className="text-base font-black text-slate-950 dark:text-white">Executive Reporting &amp; Analytics System</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Comprehensive platform report tracking cohort attrition, mentor review SLAs, curriculum friction, and retention metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Switcher */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
              {(['7d', '30d', '90d', 'all'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onTimeframeChange(tf)}
                  disabled={updatingTimeframe}
                  className={`rounded-lg px-3 py-1.5 transition text-[11px] font-bold ${
                    selectedTimeframe === tf
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : 'All Time'}
                </button>
              ))}
            </div>

            {/* Export Executive Report CSV */}
            <Button
              size="sm"
              variant="secondary"
              onClick={onExportExecutiveReport}
              loading={exportingExecutiveReport}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Download size={13} />
              <span>Export Full Report (CSV)</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Insights KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Overall Cohort Churn</span>
            <AlertTriangle size={15} className="text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">
              {execMetrics?.overallChurnRatePct ?? 0}%
            </span>
            <span className="text-[11px] text-slate-400">drop rate</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Calculated across all dropped student enrollments.
          </p>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>At-Risk Learners</span>
            <Users size={15} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">
              {execMetrics?.atRiskLearners.length ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">students stalled</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Stalled &gt; 7 days or ≥ 2 revision requests.
          </p>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Curriculum Modules</span>
            <BookOpen size={15} className="text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-950 dark:text-white">
              {execMetrics?.curriculumDropOff.length ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">active modules</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Tracking milestone completion velocity.
          </p>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Active Mentors</span>
            <Award size={15} className="text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-950 dark:text-white">
              {execMetrics?.mentorLeaderboard.length ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">reviewers on staff</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Avg turnaround: {execMetrics?.avgMentorReviewHours != null ? `${execMetrics.avgMentorReviewHours}h` : '—'}
          </p>
        </Card>
      </div>

      {/* Section 1: At-Risk Learners Table (Dropout Risk Drilldown) */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
                <AlertTriangle size={15} />
              </span>
              <h2 className="text-base font-black text-slate-950 dark:text-white">
                At-Risk Student Intervention Roster ({execMetrics?.atRiskLearners.length ?? 0})
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Learners showing inactivity or friction patterns requiring mentor or administrative check-ins.
            </p>
          </div>

          {Boolean(execMetrics?.atRiskLearners.length) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onExportAtRiskLearners}
              loading={exportingAtRiskReport}
              className="flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              <Download size={13} />
              <span>Export At-Risk Roster (CSV)</span>
            </Button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Cohort</th>
                <th className="py-2.5 px-3">Inactivity</th>
                <th className="py-2.5 px-3">Revisions</th>
                <th className="py-2.5 px-3">Risk Factor</th>
                <th className="py-2.5 px-3 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {execMetrics?.atRiskLearners.length ? (
                execMetrics.atRiskLearners.map((student) => (
                  <tr key={student.studentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <strong className="text-slate-900 dark:text-white block">{student.studentName}</strong>
                      <span className="text-[11px] text-slate-400">{student.studentEmail}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {student.cohortName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-amber-700 dark:text-amber-400">{student.daysInactive} days</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          student.resubmissionsCount >= 2
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        {student.resubmissionsCount} pending revisions
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          student.riskReason === 'multiple_resubmissions'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : student.riskReason === 'stalled_inactivity'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {student.riskReason.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const message = `Hi ${student.studentName}, checking in from CUT / CRAFT! We noticed you haven't been active in ${student.cohortName} lately. Do you need help with your current timeline cut or feedback revisions?`;
                          navigator.clipboard.writeText(message);
                          onCopyNoteSuccess?.(`Check-in message copied to clipboard for ${student.studentName}!`);
                        }}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 hover:text-orange-600"
                      >
                        Copy Check-in Note
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    ✓ No learners currently flagged as at-risk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section: Course Demand & Enrollment Popularity Visual Report */}
      <Card className="p-6 border-slate-200 dark:border-slate-800" data-testid="course-demand-report-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs font-bold text-xs">
                <BarChart3 size={15} />
              </span>
              <h2 className="text-base font-black text-slate-950 dark:text-white">
                Course Demand &amp; Enrollment Distribution
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active student enrollment volume across master courses. Highlights high-traction curricula driving cohort capacity versus under-enrolled subjects.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshCourseDemand}
              loading={courseDemandLoading}
              className="flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              <RefreshCw size={13} className={courseDemandLoading ? 'animate-spin' : ''} />
              <span>Refresh Data</span>
            </Button>
            <Link
              to="/admin/courses"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <span>Manage Courses</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Course Demand KPI Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Most Demanded */}
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 dark:border-amber-900/50">
            <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-orange-500" /> Most Demanded Course
              </span>
              <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 border border-orange-500/20">
                Top Choice
              </span>
            </div>
            <div className="mt-2.5">
              <h4 className="text-sm font-black text-slate-950 dark:text-white truncate" title={courseDemandKPIs.mostDemanded?.title || 'None'}>
                {courseDemandKPIs.mostDemanded?.title || 'No active enrollments'}
              </h4>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono">
                  {courseDemandKPIs.mostDemanded?.enrolledStudentsCount ?? 0}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  students ({courseDemandKPIs.mostDemanded?.popularitySharePct ?? 0}% share)
                </span>
              </div>
            </div>
          </div>

          {/* Lowest Demand / Least Enrolled */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <TrendingDown size={14} className="text-amber-500" /> Lowest Enrollment Course
              </span>
              <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                Under-Enrolled
              </span>
            </div>
            <div className="mt-2.5">
              <h4 className="text-sm font-black text-slate-950 dark:text-white truncate" title={courseDemandKPIs.leastDemanded?.title || 'None'}>
                {courseDemandKPIs.leastDemanded?.title || 'No courses in catalog'}
              </h4>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">
                  {courseDemandKPIs.leastDemanded?.enrolledStudentsCount ?? 0}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  students ({courseDemandKPIs.leastDemanded?.cohortsCount ?? 0} cohorts)
                </span>
              </div>
            </div>
          </div>

          {/* Total Active Course Enrollments */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-3xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-blue-500" /> Total Active Enrollments
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                Active
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {courseDemandKPIs.totalActiveStudents}
                </span>
                <span className="text-xs text-slate-400">students across catalog</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Sum of active &amp; enrolled students across all master courses
              </p>
            </div>
          </div>

          {/* Zero Enrollment Courses Count */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-3xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-rose-500" /> Zero-Enrollment Courses
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                  courseDemandKPIs.underEnrolledCount > 0
                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                }`}
              >
                {courseDemandKPIs.underEnrolledCount > 0 ? 'Needs Attention' : 'All Enrolled'}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {courseDemandKPIs.underEnrolledCount}
                </span>
                <span className="text-xs text-slate-400">of {courseDemand.length} courses</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Courses with 0 active students (marketing or scheduling review recommended)
              </p>
            </div>
          </div>
        </div>

        {/* Filters, Controls & View Mode Switcher */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-3xs dark:border-slate-800 dark:bg-slate-950 sm:w-64">
            <Search size={14} className="text-slate-400" />
            <input
              value={courseDemandSearch}
              onChange={(e) => setCourseDemandSearch(e.target.value)}
              placeholder="Search courses by title..."
              aria-label="Search courses by title"
              className="w-full bg-transparent outline-none text-xs"
            />
            {courseDemandSearch && (
              <button
                onClick={() => setCourseDemandSearch('')}
                aria-label="Clear search"
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Track Type Filter */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
              {(['all', 'coding', 'non_coding'] as const).map((trk) => (
                <button
                  key={trk}
                  type="button"
                  onClick={() => setCourseDemandFilter(trk)}
                  className={`rounded px-2.5 py-1 font-bold text-[11px] transition ${
                    courseDemandFilter === trk
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {trk === 'all' ? 'All Tracks' : trk === 'coding' ? 'Coding' : 'Non-Coding'}
                </button>
              ))}
            </div>

            {/* Sort Order */}
            <select
              value={courseDemandSort}
              onChange={(e) => setCourseDemandSort(e.target.value as 'desc' | 'asc' | 'alpha')}
              aria-label="Sort courses by demand"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-bold text-[11px] text-slate-700 shadow-3xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="desc">Most Demanded First (High → Low)</option>
              <option value="asc">Least Demanded First (Low → High)</option>
              <option value="alpha">Alphabetical (A → Z)</option>
            </select>

            {/* View Mode Toggle Button Group */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-3xs dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setCourseDemandViewMode('chart')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold transition ${
                  courseDemandViewMode === 'chart'
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={13} />
                <span>Chart View</span>
              </button>
              <button
                type="button"
                onClick={() => setCourseDemandViewMode('table')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold transition ${
                  courseDemandViewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Table size={13} />
                <span>Data Matrix</span>
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Unified Comparative Horizontal Bar Chart */}
        {courseDemandViewMode === 'chart' && (
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white shadow-3xs dark:border-slate-800 dark:bg-slate-900/80 overflow-hidden">
            {/* Axis scale banner */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <span className="uppercase tracking-wider text-[10px]">Master Course Ranking &amp; Status</span>
              <div className="hidden sm:flex items-center gap-6 font-mono text-[10px] text-slate-400">
                <span>Scale Reference: 0 → {courseDemandKPIs.maxEnrollment} max learners</span>
              </div>
            </div>

            {/* List of courses */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredAndSortedDemand.length ? (
                filteredAndSortedDemand.map((course, idx) => {
                  const widthPct =
                    courseDemandKPIs.maxEnrollment > 0
                      ? Math.round((course.enrolledStudentsCount / courseDemandKPIs.maxEnrollment) * 100)
                      : 0;
                  const isTop = idx === 0 && courseDemandSort === 'desc' && course.enrolledStudentsCount > 0;
                  const isZero = course.enrolledStudentsCount === 0;

                  return (
                    <div
                      key={course.courseId}
                      className="p-4 sm:px-5 sm:py-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
                              isTop
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : isZero
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {course.title}
                          </strong>
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                              course.trackType === 'coding'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900'
                                : course.trackType === 'non_coding'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {course.trackType === 'coding' ? 'Coding' : course.trackType === 'non_coding' ? 'Non-Coding' : 'General'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {course.cohortsCount} {course.cohortsCount === 1 ? 'cohort' : 'cohorts'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                          {isTop && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <TrendingUp size={11} className="text-emerald-600" /> Leading Traction
                            </span>
                          )}
                          {isZero && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              ⚠️ Zero Enrollments
                            </span>
                          )}
                          {!isTop && !isZero && widthPct < 25 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <TrendingDown size={11} className="text-amber-600" /> Low Intake
                            </span>
                          )}
                          {!isTop && !isZero && widthPct >= 25 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <CheckCircle2 size={11} className="text-blue-600" /> Active Intake
                            </span>
                          )}
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                              {course.enrolledStudentsCount}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1">students</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {course.popularitySharePct}% share
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Bar with gridlines */}
                      <div className="mt-3 relative">
                        {/* Subtle vertical benchmark grid ticks */}
                        <div className="absolute inset-0 pointer-events-none flex justify-between z-0 px-0.5">
                          <div className="w-px h-full border-r border-dashed border-slate-200 dark:border-slate-800" />
                          <div className="w-px h-full border-r border-dashed border-slate-200 dark:border-slate-800" />
                          <div className="w-px h-full border-r border-dashed border-slate-200 dark:border-slate-800" />
                          <div className="w-px h-full border-r border-dashed border-slate-200 dark:border-slate-800" />
                        </div>

                        <div className="relative z-10 h-3.5 w-full overflow-hidden rounded-md bg-slate-100/90 dark:bg-slate-800/90 p-0.5 shadow-inner">
                          <div
                            className={`h-full rounded transition-all duration-500 ${
                              isTop
                                ? 'bg-gradient-to-r from-orange-500 to-amber-400 shadow-2xs'
                                : isZero
                                ? 'bg-slate-200 dark:bg-slate-700'
                                : widthPct >= 60
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : widthPct >= 30
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                : 'bg-gradient-to-r from-amber-500 to-amber-400'
                            }`}
                            style={{ width: `${isZero ? 0 : Math.max(3, widthPct)}%` }}
                            role="meter"
                            aria-label={`Enrollment for ${course.title}`}
                            aria-valuenow={course.enrolledStudentsCount}
                            aria-valuemin={0}
                            aria-valuemax={courseDemandKPIs.maxEnrollment}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  <p className="font-bold">No courses match the current filter or search query.</p>
                  <p className="mt-1">Try resetting the filter to All Tracks or clear the search field.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View 2: Enterprise Data Matrix Table */}
        {courseDemandViewMode === 'table' && (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-3xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Master Course</th>
                  <th className="py-3 px-4 w-28">Track</th>
                  <th className="py-3 px-4 w-24 text-right">Cohorts</th>
                  <th className="py-3 px-4 w-36 text-right">Active Students</th>
                  <th className="py-3 px-4 w-44">Catalog Share</th>
                  <th className="py-3 px-4 w-40 text-center">Intake Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAndSortedDemand.length ? (
                  filteredAndSortedDemand.map((course, idx) => {
                    const widthPct =
                      courseDemandKPIs.maxEnrollment > 0
                        ? Math.round((course.enrolledStudentsCount / courseDemandKPIs.maxEnrollment) * 100)
                        : 0;
                    const isTop = idx === 0 && courseDemandSort === 'desc' && course.enrolledStudentsCount > 0;
                    const isZero = course.enrolledStudentsCount === 0;

                    return (
                      <tr key={course.courseId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                          <span
                            className={`inline-flex items-center justify-center size-6 rounded-md text-[10px] font-black ${
                              isTop
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : isZero
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{course.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {course.slug || course.courseId}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              course.trackType === 'coding'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900'
                                : course.trackType === 'non_coding'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {course.trackType === 'coding' ? 'Coding' : course.trackType === 'non_coding' ? 'Non-Coding' : 'General'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {course.cohortsCount}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                            {course.enrolledStudentsCount}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">students</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isTop
                                    ? 'bg-amber-500'
                                    : isZero
                                    ? 'bg-slate-200 dark:bg-slate-700'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.max(0, course.popularitySharePct)}%` }}
                                role="meter"
                                aria-label={`Enrollment for ${course.title}`}
                                aria-valuenow={course.enrolledStudentsCount}
                                aria-valuemin={0}
                                aria-valuemax={courseDemandKPIs.maxEnrollment}
                              />
                            </div>
                            <span className="w-10 text-right font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {course.popularitySharePct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isTop && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <TrendingUp size={11} /> Leading Traction
                            </span>
                          )}
                          {isZero && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              ⚠️ Zero Enrollments
                            </span>
                          )}
                          {!isTop && !isZero && widthPct < 25 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <TrendingDown size={11} /> Low Intake
                            </span>
                          )}
                          {!isTop && !isZero && widthPct >= 25 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <CheckCircle2 size={11} /> Active Intake
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No courses match the current filter or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 2: Curriculum Drop-Off Funnel & Cohort Churn */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Curriculum Funnel */}
        <Card className="p-6">
          <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
            <Layers size={16} className="text-orange-500" /> Curriculum Drop-Off Funnel
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Module-by-module completion rates across all enrolled students to identify pedagogical bottlenecks.
          </p>

          <div className="mt-5 space-y-4">
            {execMetrics?.curriculumDropOff.length ? (
              execMetrics.curriculumDropOff.map((m) => (
                <div key={m.moduleId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-900 dark:text-white">
                      Module {m.position}: {m.moduleTitle}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono">{m.completionRatePct}% complete</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.completionRatePct >= 75
                          ? 'bg-emerald-500'
                          : m.completionRatePct >= 40
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(4, m.completionRatePct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{m.lessonCount} lessons</span>
                    <span>{m.stalledStudentCount} students yet to complete</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">No modules found.</p>
            )}
          </div>
        </Card>

        {/* Cohort Churn Breakdown */}
        <Card className="p-6">
          <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
            <Activity size={16} className="text-rose-500" /> Cohort Attrition &amp; Retention
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Active vs completed vs dropped student distribution by cohort.
          </p>

          <div className="mt-5 space-y-4">
            {execMetrics?.cohortChurn.length ? (
              execMetrics.cohortChurn.map((c) => (
                <div key={c.cohortId} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-slate-900 dark:text-white">{c.cohortName}</strong>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        c.churnRatePct >= 20
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {c.churnRatePct}% Churn
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
                    <div className="rounded bg-white dark:bg-slate-900 p-2 shadow-3xs">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Enrolled</span>
                      <strong className="text-slate-900 dark:text-white font-bold">{c.totalEnrolled}</strong>
                    </div>
                    <div className="rounded bg-white dark:bg-slate-900 p-2 shadow-3xs">
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Active</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-bold">{c.activeCount}</strong>
                    </div>
                    <div className="rounded bg-white dark:bg-slate-900 p-2 shadow-3xs">
                      <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Graduated</span>
                      <strong className="text-blue-700 dark:text-blue-300 font-bold">{c.completedCount}</strong>
                    </div>
                    <div className="rounded bg-white dark:bg-slate-900 p-2 shadow-3xs">
                      <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">Dropped</span>
                      <strong className="text-rose-700 dark:text-rose-300 font-bold">{c.droppedCount}</strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">No cohort data available.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Section 3: Mentor Performance & SLA Review Velocity */}
      <Card className="p-6">
        <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
          <Clock size={16} className="text-purple-500" /> Mentor Review Performance &amp; SLA Velocity
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Review turnaround velocity, critique output, and revision request ratios across mentoring staff.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Mentor</th>
                <th className="py-2.5 px-3">Total Reviews Completed</th>
                <th className="py-2.5 px-3">Avg Turnaround Time</th>
                <th className="py-2.5 px-3">SLA Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {execMetrics?.mentorLeaderboard.length ? (
                execMetrics.mentorLeaderboard.map((m) => (
                  <tr key={m.mentorId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <strong className="text-slate-900 dark:text-white block">{m.mentorName}</strong>
                      <span className="text-[11px] text-slate-400">{m.mentorEmail}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-slate-950 dark:text-white">{m.reviewsCount}</span> critiques
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {m.avgTurnaroundHours != null ? `${m.avgTurnaroundHours} hours` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {m.avgTurnaroundHours != null ? (
                        m.avgTurnaroundHours <= 24 ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                            ✓ Rapid SLA
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 uppercase">
                            SLA Warning (&gt;24h)
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-[10px]">No reviews yet</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No mentor performance recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

