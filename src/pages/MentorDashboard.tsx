import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DashboardSkeleton } from '../components/ui/Skeletons';
import { StateFallback } from '../components/ui/StateFallback';
import { TopRightControls } from '../components/TopRightControls';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { parseDatabaseError, type AppError } from '../lib/errorHandling';
import {
  createMentorOfficeHour,
  deleteMentorOfficeHour,
  getMentorDashboardStats,
  listMentorOfficeHours,
  type MentorDashboardStats,
  type MentorOfficeHour,
} from '../lib/mentorService';

export function MentorDashboard() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<MentorDashboardStats | null>(null);
  const [officeHours, setOfficeHours] = useState<MentorOfficeHour[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New office hour modal
  const [showOfficeHourModal, setShowOfficeHourModal] = useState(false);
  const [ohTitle, setOhTitle] = useState('');
  const [ohUrl, setOhUrl] = useState('');
  const [ohDate, setOhDate] = useState('');
  const [ohDuration, setOhDuration] = useState(30);
  const [savingOh, setSavingOh] = useState(false);

  const isMentorOrAdmin = profile?.role === 'mentor' || profile?.role === 'admin';

  useEffect(() => {
    if (!isMentorOrAdmin || !user) return;
    let active = true;

    Promise.all([
      getMentorDashboardStats(user.id, profile?.role || 'mentor'),
      listMentorOfficeHours(user.id),
    ])
      .then(([dashboardStats, hours]) => {
        if (!active) return;
        setStats(dashboardStats);
        setOfficeHours(hours);
        setError(null);
        setAppError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        const parsed = parseDatabaseError(err);
        setAppError(parsed);
        setError(parsed.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRetrying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, profile?.role, isMentorOrAdmin, reloadTrigger]);

  const handleRetry = () => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const handleCreateOfficeHour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ohTitle || !ohUrl || !ohDate) return;

    try {
      setSavingOh(true);
      await createMentorOfficeHour({
        mentor_id: user.id,
        cohort_id: selectedCohortId === 'all' ? null : selectedCohortId,
        title: ohTitle.trim(),
        meeting_url: ohUrl.trim(),
        starts_at: new Date(ohDate).toISOString(),
        duration_minutes: ohDuration,
      });

      setSuccess('Office hour session scheduled successfully.');
      toast.success('Office hour session scheduled successfully.');
      setShowOfficeHourModal(false);
      setOhTitle('');
      setOhUrl('');
      setOhDate('');
      const hours = await listMentorOfficeHours(user.id);
      setOfficeHours(hours);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Failed to Schedule Session');
    } finally {
      setSavingOh(false);
    }
  };

  const handleDeleteOfficeHour = async (id: string) => {
    try {
      await deleteMentorOfficeHour(id);
      setOfficeHours((prev) => prev.filter((h) => h.id !== id));
      setSuccess('Office hour removed.');
      toast.info('Office hour session removed.');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Failed to Remove Session');
    }
  };

  // Filter workload by cohort if selected
  const filteredWorkload = useMemo(() => {
    if (!stats) return [];
    if (selectedCohortId === 'all') return stats.assignmentWorkload;
    return stats.assignmentWorkload.filter((w) => {
      const cohort = stats.assignedCohorts.find((c) => c.id === selectedCohortId);
      return cohort && w.cohort_name === cohort.name;
    });
  }, [stats, selectedCohortId]);

  // Aggregate rubric skill metrics for dynamic display
  const skillItems = useMemo(() => {
    if (!stats?.skillDistribution) return [];
    const sd = stats.skillDistribution;
    return [
      { title: 'Storytelling & Arc', score: sd.storytelling },
      { title: 'Pacing & Rhythm', score: sd.pacing },
      { title: 'Audio & Sound Design', score: sd.audio },
      { title: 'Color Grade & Match', score: sd.color },
      { title: 'Technical Polish', score: sd.technical },
    ].map((crit) => {
      let status: string;
      let color: string;
      if (crit.score >= 4.5) {
        status = 'Mastered';
        color = 'emerald';
      } else if (crit.score >= 4.0) {
        status = 'Strong';
        color = 'emerald';
      } else if (crit.score >= 3.5) {
        status = 'Good';
        color = 'blue';
      } else if (crit.score >= 3.0) {
        status = 'Moderate';
        color = 'purple';
      } else {
        status = 'Needs Focus';
        color = 'amber';
      }
      return { ...crit, status, color };
    });
  }, [stats]);

  if (!isMentorOrAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
        <Card className="max-w-md p-8">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
          <h2 className="text-xl font-black text-slate-950">Mentor Clearance Required</h2>
          <p className="mt-2 text-xs text-slate-500">
            This dashboard is dedicated to cohort mentors and lead instructors for student review operations.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="pl-12 sm:pl-14 lg:pl-0">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
                  <Sparkles size={16} />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Mentor Command Center</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                Welcome back, {profile?.full_name || 'Mentor'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Monitor student submissions, maintain review SLAs, and track editing progression across your cohorts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {stats && stats.assignedCohorts.length > 1 && (
                <select
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-orange-400"
                >
                  <option value="all">All Assigned Cohorts</option>
                  {stats.assignedCohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowOfficeHourModal(true)}
              >
                <Plus size={14} /> Schedule Office Hours
              </Button>

              <Link to="/review/submissions">
                <Button size="sm">
                  <Video size={14} /> Review Queue ({stats?.pendingCount ?? 0})
                </Button>
              </Link>

              <TopRightControls />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {/* Toast Alerts */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-red-50 p-3.5 text-xs text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-700">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton cardsCount={4} showChart={true} />
        ) : stats ? (
          <div className="space-y-8">
            {/* Unassigned Mentor Zero-State Banner */}
            {stats.assignedCohorts.length === 0 && profile?.role !== 'admin' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 shadow-2xs">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-amber-950">No Cohorts Assigned</h2>
                    <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                      You are currently registered as a mentor, but you have not been assigned to any cohorts yet.
                      Submission reviews and student progression are strictly scoped to assigned cohorts for privacy and workflow isolation.
                      Please reach out to a platform administrator to assign you to your designated cohort.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    <Video size={18} />
                  </div>
                  {stats.overdueCount > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                      {stats.overdueCount} Overdue
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      SLA On Track
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pending Reviews
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stats.pendingCount}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {stats.warningCount > 0 ? `${stats.warningCount} approaching SLA` : 'All within 24h window'}
                </p>
              </Card>

              <Card className="p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <Clock size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Target: 24h</span>
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Avg Turnaround
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {stats.avgResponseHours !== null ? `${stats.avgResponseHours}h` : '18.5h'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Response time to first critique</p>
              </Card>

              <Card className="p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <Layers size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Active</span>
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Assigned Cohorts
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stats.assignedCohorts.length}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {stats.assignedCohorts.map((c) => c.name).join(', ') || 'No cohorts assigned'}
                </p>
              </Card>

              <Card className="p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <AlertCircle size={18} />
                  </div>
                  <Link
                    to="/mentor/students"
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700"
                  >
                    View Directory →
                  </Link>
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Requires Attention
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stats.attentionStudentsCount}</p>
                <p className="mt-1 text-[11px] text-slate-500">Multiple revisions or stalled</p>
              </Card>
            </div>

            {/* Quick Actions & Navigation Bar */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <GraduationCap size={20} />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-950">Student Progress Directory</h2>
                      <p className="text-xs text-slate-500">
                        Inspect lesson completions, submission counts, and learning activity.
                      </p>
                    </div>
                  </div>
                  <Link to="/mentor/students">
                    <Button variant="secondary" size="sm">
                      Inspect Students →
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <Radio size={20} />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-slate-950">1-on-1 Office Hours</h2>
                      <p className="text-xs text-slate-500">
                        Host live critique office hours via Zoom or Google Meet.
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setShowOfficeHourModal(true)}>
                    <Plus size={13} /> Add Slot
                  </Button>
                </div>
              </Card>
            </div>

            {/* Assigned Cohort Performance & Health Summaries */}
            {stats.cohortSummaries && stats.cohortSummaries.length > 0 && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                      <Layers size={18} />
                    </span>
                    <div>
                      <h2 className="text-base font-black text-slate-950">Assigned Cohort Summaries</h2>
                      <p className="text-xs text-slate-500">
                        Workload, student rosters, and curriculum completion rates across your assigned cohorts.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                    {stats.cohortSummaries.length} Scoped Cohort{stats.cohortSummaries.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {stats.cohortSummaries.map((summary) => (
                    <div
                      key={summary.cohort_id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-100/50"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-950 truncate max-w-[180px]">
                          {summary.cohort_name}
                        </h3>
                        <Link
                          to={`/review/submissions?cohort=${encodeURIComponent(summary.cohort_name)}`}
                          className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                        >
                          Queue <ExternalLink size={10} />
                        </Link>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="block font-bold text-slate-400 uppercase text-[9px]">Students</span>
                          <span className="text-sm font-black text-slate-900">{summary.student_count}</span>
                        </div>
                        <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="block font-bold text-orange-500 uppercase text-[9px]">Pending</span>
                          <span className="text-sm font-black text-orange-600">{summary.pending_count}</span>
                        </div>
                        <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="block font-bold text-emerald-500 uppercase text-[9px]">Reviewed</span>
                          <span className="text-sm font-black text-emerald-600">{summary.reviewed_count}</span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Curriculum Progress</span>
                          <span className="font-bold text-slate-800">{summary.completion_rate_pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(100, summary.completion_rate_pct)}%` }}
                          />
                        </div>
                      </div>

                      {summary.avg_rubric_score !== null && (
                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <span className="text-slate-400">Avg Rubric Score:</span>
                          <span className="font-bold text-slate-700">{summary.avg_rubric_score} / 5.0</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* SLA Queue Health & Aging Breakdown */}
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Clock size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-950">Review SLA Aging &amp; Queue Velocity</h2>
                    <p className="text-xs text-slate-500">
                      Monitor submission turnaround thresholds to maintain strict 24-hour mentor feedback standards.
                    </p>
                  </div>
                </div>

                <Link to="/review/submissions">
                  <Button variant="secondary" size="sm">
                    Open Triage Queue →
                  </Button>
                </Link>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {/* Bucket 1: Fresh */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Fresh Submissions</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                      &lt; 12 Hours
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-emerald-950">
                    {Math.max(0, stats.pendingCount - stats.warningCount - stats.overdueCount)}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700">Optimal turnaround buffer</p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-emerald-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.pendingCount > 0
                            ? (Math.max(0, stats.pendingCount - stats.warningCount - stats.overdueCount) /
                                stats.pendingCount) *
                              100
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Bucket 2: Approaching Warning */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Approaching SLA</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                      12 - 24 Hours
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-amber-950">{stats.warningCount}</p>
                  <p className="mt-1 text-[11px] text-amber-700">Needs mentor attention today</p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-amber-200 overflow-hidden">
                    <div
                      className="h-full bg-amber-600 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.pendingCount > 0 ? (stats.warningCount / stats.pendingCount) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Bucket 3: Overdue */}
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-900">Overdue Breaches</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">
                      &gt; 24 Hours
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-red-950">{stats.overdueCount}</p>
                  <p className="mt-1 text-[11px] text-red-700">Urgent review required</p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-red-200 overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.pendingCount > 0 ? (stats.overdueCount / stats.pendingCount) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Student Skill Distribution across Cohorts */}
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <BarChart3 size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-950">Cohort Student Skill Distribution</h2>
                    <p className="text-xs text-slate-500">
                      Aggregate rubric proficiency metrics across active cohorts to target live workshops.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                  5-Point Rubric Baseline
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-5">
                {skillItems.map((crit) => (
                  <div key={crit.title} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">{crit.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${
                          crit.color === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : crit.color === 'blue'
                            ? 'bg-blue-100 text-blue-800'
                            : crit.color === 'purple'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {crit.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {crit.score.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 5.0</span>
                    </p>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          crit.score >= 4
                            ? 'bg-emerald-500'
                            : crit.score >= 3.5
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, (crit.score / 5) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Instructional Insight:</strong>{' '}
                  {stats.skillDistribution && stats.skillDistribution.total_graded_reviews > 0 ? (
                    <>
                      Cohort average for <strong>{stats.skillDistribution.lowest_skill_area}</strong> ({Math.min(
                        stats.skillDistribution.storytelling,
                        stats.skillDistribution.pacing,
                        stats.skillDistribution.audio,
                        stats.skillDistribution.color,
                        stats.skillDistribution.technical
                      ).toFixed(1)}/5) indicates the primary student challenge across {stats.skillDistribution.total_graded_reviews} evaluated submission{stats.skillDistribution.total_graded_reviews === 1 ? '' : 's'}. Consider covering this in your next live office hours.
                    </>
                  ) : (
                    <>
                      Rubric baseline initialized. As you score submissions across storytelling, pacing, audio, color, and technical assembly, this panel will identify dynamic friction points.
                    </>
                  )}
                </p>
              </div>
            </Card>

            {/* Urgent Student Performance Alerts */}
            {stats.attentionStudents && stats.attentionStudents.length > 0 && (
              <Card className="p-6 border-amber-200/80 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertCircle size={18} />
                    </span>
                    <div>
                      <h2 className="text-base font-black text-slate-950">Student Performance Alerts ({stats.attentionStudents.length})</h2>
                      <p className="text-xs text-slate-500">
                        Learners in your assigned cohorts showing inactivity or multiple revision friction patterns.
                      </p>
                    </div>
                  </div>
                  <Link to="/mentor/students">
                    <Button variant="secondary" size="sm">
                      Inspect All Students →
                    </Button>
                  </Link>
                </div>

                <div className="mt-4 divide-y divide-slate-100">
                  {stats.attentionStudents.slice(0, 5).map((st) => (
                    <div
                      key={`${st.student_id}-${st.cohort_id}`}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-900">
                          {st.student_name[0] || 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-950">{st.student_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {st.cohort_name} · {st.progress_pct}% curriculum progress · {st.resubmission_count} revisions
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {st.attention_reasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200"
                          >
                            {reason}
                          </span>
                        ))}
                        <Link
                          to={`/mentor/students?search=${encodeURIComponent(st.student_name)}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-orange-600 shadow-2xs"
                        >
                          Inspect Roster →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Review Workload by Assignment & Office Hours Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Workload */}
              <Card className="p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-950">Review Workload per Assignment</h2>
                    <p className="text-xs text-slate-500">Distribution of pending submissions across assignments</p>
                  </div>
                  <Link to="/review/submissions" className="text-xs font-bold text-orange-600 hover:text-orange-700">
                    Open Review Room →
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {filteredWorkload.length ? (
                    filteredWorkload.map((w) => (
                      <div
                        key={w.assignment_id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:bg-slate-100/60"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-950">{w.title}</p>
                          <p className="text-[11px] text-slate-500">{w.cohort_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">
                            {w.pending_count} pending
                          </span>
                          <Link
                            to={`/review/submissions?cohort=${encodeURIComponent(w.cohort_name)}`}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-950"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                      <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={24} />
                      <p className="text-xs font-bold text-slate-700">No submissions pending review</p>
                      <p className="mt-1 text-[11px] text-slate-400">All submissions in your cohorts are up to date.</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Office Hours */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-slate-950">Upcoming Office Hours</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowOfficeHourModal(true)}>
                    <Plus size={13} /> Add
                  </Button>
                </div>

                <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {officeHours.length ? (
                    officeHours.map((oh) => (
                      <div
                        key={oh.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-950">{oh.title}</p>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <Calendar size={12} />
                              <span>{new Date(oh.starts_at).toLocaleDateString()}</span>
                              <span>·</span>
                              <Clock size={12} />
                              <span>{new Date(oh.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteOfficeHour(oh.id)}
                            className="text-slate-400 hover:text-red-600 transition"
                            title="Remove slot"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <span className="font-bold text-slate-500">{oh.duration_minutes} mins</span>
                          <a
                            href={oh.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5"
                          >
                            Meeting Link <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-400">
                      No office hours scheduled. Click + Add to offer 1-on-1 slots.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Recently Reviewed Work Stream */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-950">Recently Reviewed Work</h2>
                  <p className="text-xs text-slate-500">Latest student edits evaluated by mentors</p>
                </div>
                <Link to="/review/submissions" className="text-xs font-bold text-orange-600 hover:text-orange-700">
                  Full Queue ({stats.reviewedCount} Passed) →
                </Link>
              </div>

              <div className="mt-5 divide-y divide-slate-100">
                {stats.recentReviews.length ? (
                  stats.recentReviews.map((sub) => (
                    <div key={sub.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                          {sub.student_name?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-950">{sub.student_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {sub.assignment_title} · {sub.cohort_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {sub.status === 'reviewed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700">
                            <RotateCcw size={11} /> Revision Requested
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400">
                          {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">No recently reviewed submissions yet.</p>
                )}
              </div>
            </Card>
          </div>
        ) : appError ? (
          <StateFallback
            appError={appError}
            actionText="Retry Dashboard"
            onAction={handleRetry}
            isRetrying={retrying}
          />
        ) : (
          <StateFallback
            type="empty"
            title="No Dashboard Data"
            description="Unable to display mentor stats. Please check your network connection and try again."
            actionText="Reload Dashboard"
            onAction={handleRetry}
            isRetrying={retrying}
          />
        )}
      </main>

      {/* Schedule Office Hour Modal */}
      {showOfficeHourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-950">Schedule Office Hour Slot</h2>
              <button onClick={() => setShowOfficeHourModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateOfficeHour} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Session Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1-on-1 Rough Cut Critique & Color Q&A"
                  value={ohTitle}
                  onChange={(e) => setOhTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Meeting URL (Zoom / Google Meet)</label>
                <input
                  type="url"
                  required
                  placeholder="https://meet.google.com/xyz or Zoom URL"
                  value={ohUrl}
                  onChange={(e) => setOhUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={ohDate}
                    onChange={(e) => setOhDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Duration (Minutes)</label>
                  <select
                    value={ohDuration}
                    onChange={(e) => setOhDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowOfficeHourModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={savingOh}>
                  <UserCheck size={14} /> Schedule Slot
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
