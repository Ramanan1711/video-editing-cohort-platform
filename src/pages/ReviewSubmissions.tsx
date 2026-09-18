import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Filter,
  Image as ImageIcon,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  detectResourceType,
  listMentorSubmissions,
  reviewSubmission,
  type MentorSubmission,
} from '../lib/courseService';
import { useAuth } from '../context/useAuth';

type StatusTab = 'pending' | 'resubmit' | 'reviewed' | 'all';

export function ReviewSubmissions() {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<MentorSubmission[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAuthorized = profile?.role === 'mentor' || profile?.role === 'admin';

  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    listMentorSubmissions('all')
      .then((data) => {
        if (active) setSubmissions(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load mentor review queue.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthorized]);

  // Unique cohorts for filtering
  const availableCohorts = useMemo(() => {
    const list = Array.from(
      new Set(submissions.map((s) => s.cohort_name).filter((c): c is string => Boolean(c)))
    );
    return list.sort();
  }, [submissions]);

  // Status counts
  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending: submissions.filter((s) => s.status === 'pending').length,
      resubmit: submissions.filter((s) => s.status === 'resubmit').length,
      reviewed: submissions.filter((s) => s.status === 'reviewed').length,
    };
  }, [submissions]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesStatus = statusTab === 'all' || s.status === statusTab;
      const matchesCohort = selectedCohort === 'all' || s.cohort_name === selectedCohort;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.student_name && s.student_name.toLowerCase().includes(q)) ||
        (s.student_email && s.student_email.toLowerCase().includes(q)) ||
        (s.assignment_title && s.assignment_title.toLowerCase().includes(q));

      return matchesStatus && matchesCohort && matchesSearch;
    });
  }, [submissions, statusTab, selectedCohort, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
        <Card className="max-w-md p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <X size={24} />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950">Mentor Access Required</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Only designated cohort mentors and platform administrators have clearance to evaluate student video submissions.
          </p>
        </Card>
      </div>
    );
  }

  const review = async (submission: MentorSubmission, status: 'reviewed' | 'resubmit') => {
    if (!user) return;
    const notes = feedback[submission.id]?.trim() || '';

    if (status === 'resubmit' && !notes) {
      setError('Please provide feedback notes explaining what revisions or adjustments are required.');
      return;
    }

    setSavingId(submission.id);
    setError(null);
    setSuccess(null);

    try {
      await reviewSubmission(submission.id, status, notes);
      setSuccess(
        status === 'reviewed'
          ? `Approved and marked reviewed for ${submission.student_name || 'student'}.`
          : `Requested revision from ${submission.student_name || 'student'}.`
      );

      // Optimistically update queue
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                status,
                feedback: notes || item.feedback,
                feedback_history: [
                  {
                    id: `temp-${Date.now()}`,
                    submission_id: item.id,
                    mentor_id: user.id,
                    comments: notes,
                    created_at: new Date().toISOString(),
                  },
                  ...(item.feedback_history || []),
                ],
              }
            : item
        )
      );

      // Clear input
      setFeedback((prev) => ({ ...prev, [submission.id]: '' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review submission.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <Sparkles size={16} />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Mentor Review Room</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Review Queue</h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                Inspect submitted video edits, technical timelines, and project files. Leave frame-accurate critique notes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                {counts.pending} pending evaluation
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {/* Toast Alerts */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-red-50 p-3.5 text-xs text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-700">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} aria-label="Dismiss success">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          {/* Status Tabs */}
          <div className="flex overflow-x-auto gap-1 border-b border-slate-200 pb-1 text-xs font-bold">
            <button
              onClick={() => setStatusTab('pending')}
              className={`rounded-lg px-3 py-2 transition ${
                statusTab === 'pending'
                  ? 'bg-orange-500 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              onClick={() => setStatusTab('resubmit')}
              className={`rounded-lg px-3 py-2 transition ${
                statusTab === 'resubmit'
                  ? 'bg-amber-500 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Revision Requested ({counts.resubmit})
            </button>
            <button
              onClick={() => setStatusTab('reviewed')}
              className={`rounded-lg px-3 py-2 transition ${
                statusTab === 'reviewed'
                  ? 'bg-emerald-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Reviewed &amp; Approved ({counts.reviewed})
            </button>
            <button
              onClick={() => setStatusTab('all')}
              className={`rounded-lg px-3 py-2 transition ${
                statusTab === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              All ({counts.all})
            </button>
          </div>

          {/* Search and Cohort Filter Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search student or assignment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 sm:w-56 bg-transparent text-xs outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {availableCohorts.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Cohorts</option>
                  {availableCohorts.map((cohort) => (
                    <option key={cohort} value={cohort}>
                      {cohort}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Queue Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl bg-white border border-slate-200 p-6" />
            ))}
          </div>
        ) : filteredSubmissions.length ? (
          <div className="space-y-6">
            {filteredSubmissions.map((submission) => {
              const fileType = detectResourceType(submission.file_url);
              const isResubmission = Boolean(submission.feedback_history?.length && submission.feedback_history.length > 1);

              return (
                <Card key={submission.id} className="overflow-hidden p-6 shadow-2xs hover:border-slate-300 transition">
                  {/* Top Metadata Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start">
                    <div className="flex items-start gap-3.5">
                      {/* Student Initials Avatar */}
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 text-sm font-black text-white shadow-2xs">
                        {submission.student_name?.charAt(0).toUpperCase() || 'S'}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-base font-black text-slate-950">
                            {submission.student_name || 'Student'}
                          </strong>
                          <span className="text-xs text-slate-400">({submission.student_email})</span>

                          {/* Cohort Pill */}
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {submission.cohort_name}
                          </span>
                        </div>

                        {/* Assignment Title */}
                        <h3 className="mt-1 text-sm font-bold text-orange-600">
                          Assignment: {submission.assignment_title}
                        </h3>

                        {/* Submission Time and Revision Badge */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Submitted {submission.created_at ? new Date(submission.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                          </span>

                          {submission.assignment_deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              Due: {new Date(submission.assignment_deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {submission.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          <Clock size={13} /> Pending Review
                        </span>
                      ) : submission.status === 'resubmit' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                          <RotateCcw size={13} /> Revision Requested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          <Check size={13} /> Reviewed &amp; Approved
                        </span>
                      )}

                      {isResubmission && (
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">
                          Revision #{submission.feedback_history?.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assignment Brief & Instructions (if provided) */}
                  {submission.assignment_instructions && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600">
                      <strong className="block font-bold text-slate-800 mb-1">Assignment Challenge Brief:</strong>
                      <p className="leading-relaxed">{submission.assignment_instructions}</p>
                    </div>
                  )}

                  {/* Private Submission In-App Preview & Media Player */}
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-950/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        {getSubmissionFileIcon(fileType)}
                        <span>Submitted Student Asset ({fileType.replace('_', ' ').toUpperCase()})</span>
                      </span>

                      <a
                        href={submission.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
                      >
                        <Download size={13} />
                        <span>Download &amp; Inspect File</span>
                        <ExternalLink size={12} className="text-slate-400" />
                      </a>
                    </div>

                    {/* In-app video player for video cuts */}
                    {fileType === 'video' ? (
                      <div className="overflow-hidden rounded-xl bg-black shadow-inner">
                        <video
                          controls
                          src={submission.file_url}
                          className="aspect-video w-full max-h-96 object-contain"
                          preload="metadata"
                        />
                      </div>
                    ) : fileType === 'image' ? (
                      <div className="flex justify-center overflow-hidden rounded-xl bg-slate-900 p-2">
                        <img
                          src={submission.file_url}
                          alt="Student timeline submission"
                          className="max-h-80 object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-white p-4 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                            <FileArchive size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Project Archive / Timeline Rushes</p>
                            <p className="text-[11px] text-slate-500">Download to open in Premiere Pro, DaVinci Resolve, or FCPX</p>
                          </div>
                        </div>

                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-orange-600 transition"
                        >
                          Open in NLE
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Feedback History Thread */}
                  {submission.feedback_history && submission.feedback_history.length > 0 && (
                    <div className="mt-5 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <MessageSquare size={13} />
                        <span>Mentor Critique History ({submission.feedback_history.length})</span>
                      </div>

                      {submission.feedback_history.map((item, idx) => (
                        <div key={item.id || idx} className="rounded-lg bg-white p-3 shadow-2xs border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span className="font-bold text-slate-700">Critique #{submission.feedback_history!.length - idx}</span>
                            <span>{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{item.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mentor Review Action Form */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <label className="block text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Write Constructive Feedback &amp; Action Items
                      <textarea
                        value={feedback[submission.id] ?? ''}
                        onChange={(event) =>
                          setFeedback((current) => ({ ...current, [submission.id]: event.target.value }))
                        }
                        rows={3}
                        placeholder="Detail timeline pacing, audio ducking, color balance adjustments, or next steps for the student..."
                        className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-xs sm:text-sm font-normal text-slate-900 outline-none focus:border-orange-400 focus:bg-white"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void review(submission, 'resubmit')}
                        loading={savingId === submission.id}
                        className="text-xs font-bold text-amber-800 hover:text-amber-900"
                      >
                        <RotateCcw size={14} /> Request Revision (Resubmit)
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void review(submission, 'reviewed')}
                        loading={savingId === submission.id}
                        className="text-xs font-bold"
                      >
                        <Check size={14} /> Approve &amp; Mark Reviewed
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-16 text-center">
            <Check className="mx-auto text-emerald-500 mb-3" size={36} />
            <h2 className="text-xl font-black text-slate-950">Review Queue is Clear</h2>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
              No submissions match the current filter. When students upload challenge edits, they will appear here.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}

function getSubmissionFileIcon(type: string) {
  switch (type) {
    case 'video':
      return <Video size={16} className="text-emerald-500" />;
    case 'project_file':
      return <FileArchive size={16} className="text-orange-500" />;
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'document':
      return <FileText size={16} className="text-blue-500" />;
    case 'image':
      return <ImageIcon size={16} className="text-purple-500" />;
    default:
      return <FileText size={16} className="text-slate-400" />;
  }
}
