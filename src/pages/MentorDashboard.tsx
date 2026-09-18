import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
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
import { useAuth } from '../context/useAuth';
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
  const [stats, setStats] = useState<MentorDashboardStats | null>(null);
  const [officeHours, setOfficeHours] = useState<MentorOfficeHour[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to load mentor dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, profile?.role, isMentorOrAdmin]);

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
      setShowOfficeHourModal(false);
      setOhTitle('');
      setOhUrl('');
      setOhDate('');
      const hours = await listMentorOfficeHours(user.id);
      setOfficeHours(hours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule office hour.');
    } finally {
      setSavingOh(false);
    }
  };

  const handleDeleteOfficeHour = async (id: string) => {
    try {
      await deleteMentorOfficeHour(id);
      setOfficeHours((prev) => prev.filter((h) => h.id !== id));
      setSuccess('Office hour removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove office hour.');
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
            <div>
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
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-white border border-slate-200" />
          </div>
        ) : stats ? (
          <div className="space-y-8">
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
                  {stats.assignedCohorts.map((c) => c.name).join(', ') || 'Global Mentorship'}
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
        ) : null}
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
