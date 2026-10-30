import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Flag,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  RotateCcw,
  Search,
  Sliders,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ReviewQueueSkeleton } from '../components/ui/Skeletons';
import { StateFallback } from '../components/ui/StateFallback';
import { TopRightControls } from '../components/TopRightControls';
import { Pagination } from '../components/ui/Pagination';
import { detectResourceType, getSecureSubmissionUrl } from '../lib/courseService';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { parseDatabaseError, type AppError } from '../lib/errorHandling';
import {
  escalateSubmissionToAdmin,
  getMentorAssignedCohorts,
  listDetailedMentorSubmissions,
  subscribeToMentorSubmissions,
  submitDetailedReview,
  RUBRIC_REVIEW_TEMPLATES,
  type DetailedMentorSubmission,
  type RubricScore,
  type TimestampedNote,
} from '../lib/mentorService';

type StatusTab = 'pending' | 'resubmit' | 'reviewed' | 'all';
type SortOption = 'urgency' | 'newest' | 'oldest';

const REVIEW_TEMPLATES = [
  { label: 'Tighten Pacing', text: 'Trim 4-6 frames between dialogue exchanges to tighten the overall rhythm.' },
  { label: 'Audio Ducking', text: 'Lower background music by -4dB under the dialogue track to improve speech intelligibility.' },
  { label: 'Color Balance', text: 'Neutralize skin tones in shot 2; shadows appear slightly pushed into magenta.' },
  { label: 'L-Cut Audio', text: 'Lead with audio 12 frames before cutting video to smooth the transition into the next scene.' },
  { label: 'Approved with Honors', text: 'Superb narrative pacing, clean sound design mix, and balanced color grade. Approved!' },
];

export function ReviewSubmissions() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [submissions, setSubmissions] = useState<DetailedMentorSubmission[]>([]);
  const [assignedCohorts, setAssignedCohorts] = useState<{ id: string; name: string }[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('urgency');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Per-submission review form state
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>({});
  const [rubrics, setRubrics] = useState<Record<string, RubricScore>>({});
  const [timestampedNotes, setTimestampedNotes] = useState<Record<string, TimestampedNote[]>>({});

  // Active timecode builder per submission
  const [activeNoteText, setActiveNoteText] = useState<Record<string, string>>({});
  const [activeNoteCat, setActiveNoteCat] = useState<
    Record<string, 'pacing' | 'audio' | 'color' | 'storytelling' | 'technical' | 'general'>
  >({});
  const [activePlaybackTime, setActivePlaybackTime] = useState<Record<string, number>>({});

  // Video refs for timestamp seeking
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Revision comparison tab toggle per submission ('current' | 'previous')
  const [activeViewTab, setActiveViewTab] = useState<Record<string, 'current' | 'history'>>({});

  // Escalation Modal state
  const [escalatingSubmission, setEscalatingSubmission] = useState<DetailedMentorSubmission | null>(null);
  const [escalationReason, setEscalationReason] = useState('Second Opinion Needed');
  const [escalationDetail, setEscalationDetail] = useState('');
  const [submittingEscalation, setSubmittingEscalation] = useState(false);

  // Secure signed URLs for private submissions storage
  const [secureUrls, setSecureUrls] = useState<Record<string, string>>({});

  const isAuthorized = profile?.role === 'mentor' || profile?.role === 'admin';

  // Resolve time-limited signed URLs for submission media
  useEffect(() => {
    if (!submissions.length) return;
    let active = true;

    Promise.all(
      submissions.map(async (s) => {
        const url = await getSecureSubmissionUrl(s.file_url);
        return [s.id, url] as const;
      })
    ).then((pairs) => {
      if (active) {
        setSecureUrls(Object.fromEntries(pairs));
      }
    });

    return () => {
      active = false;
    };
  }, [submissions]);

  useEffect(() => {
    if (!isAuthorized || !user) return;
    let active = true;
    const userId = user.id;

    async function fetchQueue() {
      try {
        const cohorts = await getMentorAssignedCohorts(userId, profile?.role || 'mentor');
        if (!active) return;
        setAssignedCohorts(cohorts);
        setAppError(null);
        setError(null);

        const cohortIds = cohorts.map((c) => c.id);
        const data = await listDetailedMentorSubmissions(profile?.role === 'admin' ? undefined : cohortIds);
        if (!active) return;
        setSubmissions(data);

        // Pre-fill initial rubrics and feedback states
        const initialRubrics: Record<string, RubricScore> = {};
        const initialTimestamps: Record<string, TimestampedNote[]> = {};
        const initialPrivate: Record<string, string> = {};

        for (const sub of data) {
          if (sub.detailed_feedback_history?.[0]?.rubric) {
            initialRubrics[sub.id] = sub.detailed_feedback_history[0].rubric as RubricScore;
          } else {
            initialRubrics[sub.id] = { storytelling: 4, pacing: 4, audio: 4, color: 4, technical: 4 };
          }
          if (sub.detailed_feedback_history?.[0]?.timestamped_notes) {
            initialTimestamps[sub.id] = sub.detailed_feedback_history[0].timestamped_notes;
          }
          if (sub.private_notes) {
            initialPrivate[sub.id] = sub.private_notes;
          }
        }
        setRubrics(initialRubrics);
        setTimestampedNotes(initialTimestamps);
        setPrivateNotes(initialPrivate);
      } catch (reason: unknown) {
        if (!active) return;
        const parsed = parseDatabaseError(reason);
        setAppError(parsed);
        setError(parsed.message);
      } finally {
        if (active) {
          setLoading(false);
          setRetrying(false);
        }
      }
    }

    void fetchQueue();

    return () => {
      active = false;
    };
  }, [user, profile, isAuthorized, reloadTrigger]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  }, []);

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
      overdue: submissions.filter((s) => s.status === 'pending' && s.sla_status === 'overdue').length,
    };
  }, [submissions]);

  // Filtered & Sorted Submissions
  const filteredSubmissions = useMemo(() => {
    const list = submissions.filter((s) => {
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

    return list.sort((a, b) => {
      if (sortOption === 'urgency') {
        // Pending first, then sorted by waiting hours descending
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return (b.waiting_time_hours || 0) - (a.waiting_time_hours || 0);
      }
      if (sortOption === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return 0;
    });
  }, [submissions, statusTab, selectedCohort, searchQuery, sortOption]);

  // Paginated Submissions Slice
  const totalSubPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalSubPages);
  const pagedSubmissions = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredSubmissions.slice(start, start + pageSize);
  }, [filteredSubmissions, safeCurrentPage, pageSize]);

  // Real-time listener for incoming submissions & feedback updates
  useEffect(() => {
    if (!isAuthorized) return;
    const cohortIds = assignedCohorts.map((c) => c.id);
    const unsubscribe = subscribeToMentorSubmissions(cohortIds, () => {
      setReloadTrigger((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, [isAuthorized, assignedCohorts]);

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

  // Format seconds into MM:SS
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add Timecoded Note
  const handleAddTimecodedNote = (submissionId: string) => {
    const time = activePlaybackTime[submissionId] || 0;
    const text = activeNoteText[submissionId]?.trim();
    if (!text) return;

    const newNote: TimestampedNote = {
      id: `note-${Date.now()}`,
      timestamp_seconds: time,
      formatted_time: formatTimecode(time),
      category: activeNoteCat[submissionId] || 'pacing',
      text,
    };

    setTimestampedNotes((prev) => ({
      ...prev,
      [submissionId]: [...(prev[submissionId] || []), newNote].sort(
        (a, b) => a.timestamp_seconds - b.timestamp_seconds
      ),
    }));

    setActiveNoteText((prev) => ({ ...prev, [submissionId]: '' }));
  };

  // Seek video to timestamp
  const seekVideo = (submissionId: string, seconds: number) => {
    const vid = videoRefs.current[submissionId];
    if (vid && typeof vid.currentTime === 'number') {
      try {
        vid.currentTime = seconds;
        void vid.play().catch(() => {});
      } catch {
        // Safe fallback for unmounted video
      }
    }
  };

  // Insert Review Template
  const handleInsertTemplate = (submissionId: string, snippet: string) => {
    setFeedbackNotes((prev) => {
      const existing = prev[submissionId]?.trim() || '';
      return {
        ...prev,
        [submissionId]: existing ? `${existing}\n\n${snippet}` : snippet,
      };
    });
  };

  // Update Rubric Score
  const handleUpdateRubric = (submissionId: string, axis: keyof RubricScore, score: number) => {
    setRubrics((prev) => ({
      ...prev,
      [submissionId]: {
        ...(prev[submissionId] || { storytelling: 4, pacing: 4, audio: 4, color: 4, technical: 4 }),
        [axis]: score,
      },
    }));
  };

  // Review submission
  const review = async (submission: DetailedMentorSubmission, status: 'reviewed' | 'resubmit') => {
    if (!user) return;
    const notes = feedbackNotes[submission.id]?.trim() || '';

    if (status === 'resubmit' && !notes) {
      setError('Please provide feedback notes explaining what revisions or adjustments are required.');
      return;
    }

    setSavingId(submission.id);
    setError(null);
    setSuccess(null);

    const prevSubmissions = submissions;
    const rubric = rubrics[submission.id] || { storytelling: 4, pacing: 4, audio: 4, color: 4, technical: 4 };
    const notesArray = timestampedNotes[submission.id] || [];
    const privateNote = privateNotes[submission.id] || null;

    // Optimistically update queue immediately
    setSubmissions((current) =>
      current.map((item) =>
        item.id === submission.id
          ? {
              ...item,
              status,
              feedback: notes || item.feedback,
              detailed_feedback_history: [
                {
                  id: `temp-${Date.now()}`,
                  submission_id: item.id,
                  mentor_id: user.id,
                  comments: notes,
                  rubric,
                  timestamped_notes: notesArray,
                  private_notes: privateNote,
                  created_at: new Date().toISOString(),
                },
                ...(item.detailed_feedback_history || []),
              ],
            }
          : item
      )
    );

    const toastMsg =
      status === 'reviewed'
        ? `Approved and marked reviewed for ${submission.student_name || 'student'}.`
        : `Requested revision from ${submission.student_name || 'student'}.`;

    setSuccess(toastMsg);
    toast.success(toastMsg);
    setFeedbackNotes((prev) => ({ ...prev, [submission.id]: '' }));

    try {
      await submitDetailedReview(submission.id, status, notes, rubric, notesArray, privateNote);
    } catch (reason) {
      // Rollback on network or DB error
      setSubmissions(prevSubmissions);
      const parsed = parseDatabaseError(reason);
      setError(parsed.message);
      toast.error(parsed.message, 'Review Submission Failed');
    } finally {
      setSavingId(null);
    }
  };

  // Escalate to Admin
  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalatingSubmission || !user) return;

    try {
      setSubmittingEscalation(true);
      const fullReason = `${escalationReason}: ${escalationDetail}`.trim();
      await escalateSubmissionToAdmin(escalatingSubmission.id, user.id, fullReason);
      const msg = `Submission flagged and escalated to Administration.`;
      setSuccess(msg);
      toast.success(msg);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === escalatingSubmission.id
            ? { ...s, escalated_at: new Date().toISOString(), escalation_reason: fullReason }
            : s
        )
      );
      setEscalatingSubmission(null);
      setEscalationDetail('');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Escalation Failed');
    } finally {
      setSubmittingEscalation(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="pl-12 sm:pl-14 lg:pl-0">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-slate-950 text-white shadow-2xs">
                  <Video size={16} />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Evaluation Suite</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Mentor Review Queue</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Inspect timeline cuts, leave timecoded feedback, rate rubric dimensions, and ensure review SLA targets.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/mentor">
                <Button variant="secondary" size="sm">
                  Mentor Dashboard
                </Button>
              </Link>
              <Link to="/mentor/students">
                <Button variant="secondary" size="sm">
                  Student Progress
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
          <div className="mb-5 flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-950/40 border border-transparent dark:border-red-900/60 p-3.5 text-xs text-red-700 dark:text-red-300">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-transparent dark:border-emerald-900/60 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* SLA Status Bar */}
        {counts.overdue > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 p-3.5 text-xs text-red-800 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={16} />
              <span>
                <strong>SLA Alert:</strong> {counts.overdue} submission{counts.overdue > 1 ? 's are' : ' is'} overdue
                (&gt; 24h waiting time in queue).
              </span>
            </div>
            <button
              onClick={() => {
                setStatusTab('pending');
                setSortOption('urgency');
              }}
              className="font-bold underline hover:text-red-900 dark:hover:text-red-200"
            >
              Prioritize Urgent Reviews →
            </button>
          </div>
        )}

        {/* Status Tabs and Controls */}
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <button
              onClick={() => setStatusTab('pending')}
              className={`rounded-xl px-3.5 py-2 transition ${
                statusTab === 'pending'
                  ? 'bg-slate-950 text-white shadow-2xs dark:bg-orange-500 dark:text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Needs Review ({counts.pending})
            </button>
            <button
              onClick={() => setStatusTab('resubmit')}
              className={`rounded-xl px-3.5 py-2 transition ${
                statusTab === 'resubmit'
                  ? 'bg-slate-950 text-white shadow-2xs dark:bg-orange-500 dark:text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Revision Requested ({counts.resubmit})
            </button>
            <button
              onClick={() => setStatusTab('reviewed')}
              className={`rounded-xl px-3.5 py-2 transition ${
                statusTab === 'reviewed'
                  ? 'bg-slate-950 text-white shadow-2xs dark:bg-orange-500 dark:text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Reviewed &amp; Passed ({counts.reviewed})
            </button>
            <button
              onClick={() => setStatusTab('all')}
              className={`rounded-xl px-3.5 py-2 transition ${
                statusTab === 'all'
                  ? 'bg-slate-950 text-white shadow-2xs dark:bg-orange-500 dark:text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              All Submissions ({counts.all})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Cohort Scoping Dropdown */}
            {availableCohorts.length > 1 && (
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs outline-none focus:border-orange-400"
              >
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Cohorts</option>
                {availableCohorts.map((name) => (
                  <option key={name} value={name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {name}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Order Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs outline-none focus:border-orange-400"
            >
              <option value="urgency" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Urgency (Longest Waiting First)</option>
              <option value="newest" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Newest First</option>
              <option value="oldest" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Oldest First</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search student or assignment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white shadow-2xs outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Queue Content */}
        {loading ? (
          <ReviewQueueSkeleton />
        ) : appError && submissions.length === 0 ? (
          <StateFallback
            appError={appError}
            actionText="Retry Review Queue"
            onAction={handleRetry}
            isRetrying={retrying}
          />
        ) : profile?.role !== 'admin' && assignedCohorts.length === 0 ? (
          <Card className="p-10 text-center max-w-lg mx-auto border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mb-4 shadow-2xs">
              <Layers size={24} />
            </div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">No Cohorts Assigned</h2>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your mentor account is not currently assigned to any active cohort review rosters. Once a platform administrator assigns you to a cohort, student submissions will appear here for grading and feedback.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/mentor">
                <Button variant="secondary" size="sm">Mentor Command Center →</Button>
              </Link>
            </div>
          </Card>
        ) : filteredSubmissions.length ? (
          <div className="space-y-8">
            {pagedSubmissions.map((submission) => {
              const fileType = detectResourceType(submission.file_url);
              const isExternalSubmission =
                submission.file_url.startsWith('http') &&
                !submission.file_url.includes('supabase.co') &&
                !submission.file_url.includes('/storage/v1/object/') &&
                !submission.file_url.startsWith('submissions/');
              const resolvedUrl = secureUrls[submission.id] || (isExternalSubmission ? submission.file_url : '');
              const isResubmission = Boolean(
                submission.detailed_feedback_history?.length && submission.detailed_feedback_history.length > 1
              );
              const currentRubric = rubrics[submission.id] || {
                storytelling: 4,
                pacing: 4,
                audio: 4,
                color: 4,
                technical: 4,
              };
              const rubricTotal = Object.values(currentRubric).reduce((a, b) => a + b, 0);
              const subTimestamps = timestampedNotes[submission.id] || [];
              const viewTab = activeViewTab[submission.id] || 'current';

              return (
                <Card
                  key={submission.id}
                  className="overflow-hidden p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  {/* Top Metadata Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 md:flex-row md:items-start">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 text-sm font-black text-white shadow-2xs">
                        {submission.student_name?.charAt(0).toUpperCase() || 'S'}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-base font-black text-slate-950 dark:text-white">
                            {submission.student_name || 'Student'}
                          </strong>
                          <span className="text-xs text-slate-400 dark:text-slate-400">({submission.student_email})</span>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {submission.cohort_name}
                          </span>
                        </div>

                        <h3 className="mt-1 text-sm font-bold text-orange-600 dark:text-orange-400">
                          Assignment: {submission.assignment_title}
                        </h3>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Submitted{' '}
                            {submission.created_at
                              ? new Date(submission.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Recently'}
                          </span>

                          {submission.assignment_deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              Due:{' '}
                              {new Date(submission.assignment_deadline).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}

                          {/* Waiting time SLA Indicator */}
                          {submission.status === 'pending' && (() => {
                            const targetHours = submission.sla_target_hours || 24;
                            const waiting = submission.waiting_time_hours || 0;
                            const diff = targetHours - waiting;
                            const isOverdue = diff <= 0;
                            const absDiff = Math.abs(diff);
                            const diffHours = Math.floor(absDiff);
                            const diffMins = Math.round((absDiff - diffHours) * 60);
                            const timeLabel = isOverdue
                              ? `Overdue by ${diffHours}h ${diffMins}m`
                              : `${diffHours}h ${diffMins}m remaining`;

                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[10px] font-black ${
                                  submission.sla_status === 'overdue'
                                    ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60'
                                    : submission.sla_status === 'warning'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                                }`}
                              >
                                <Clock size={11} className={submission.sla_status === 'overdue' ? 'animate-pulse text-red-600 dark:text-red-400' : ''} />
                                <span>{timeLabel}</span>
                                <span className="font-normal opacity-75">({waiting}h in queue)</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Status & Revision & Escalation Badges */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {submission.escalated_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs">
                          <Flag size={12} /> Escalated to Admin
                        </span>
                      )}

                      {submission.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-transparent dark:border-blue-900/50 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                          <Clock size={13} /> Pending Review
                        </span>
                      ) : submission.status === 'resubmit' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-transparent dark:border-amber-900/50 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <RotateCcw size={13} /> Revision Requested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-transparent dark:border-emerald-900/50 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Check size={13} /> Reviewed &amp; Approved
                        </span>
                      )}

                      {isResubmission && (
                        <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 border border-transparent dark:border-purple-900/50 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                          Revision #{submission.detailed_feedback_history?.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tab bar for resubmission history comparison */}
                  {isResubmission && (
                    <div className="mt-4 flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs font-bold">
                      <button
                        onClick={() => setActiveViewTab((prev) => ({ ...prev, [submission.id]: 'current' }))}
                        className={`rounded-lg px-3 py-1 transition ${
                          viewTab === 'current' ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Latest Cut (Round #{submission.detailed_feedback_history?.length})
                      </button>
                      <button
                        onClick={() => setActiveViewTab((prev) => ({ ...prev, [submission.id]: 'history' }))}
                        className={`rounded-lg px-3 py-1 transition ${
                          viewTab === 'history' ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <History size={12} className="inline mr-1" /> Compare Previous Critiques
                      </button>
                    </div>
                  )}

                  {/* Previous Critique View (if toggled) */}
                  {isResubmission && viewTab === 'history' ? (
                    <div className="mt-4 rounded-xl border border-purple-100 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30 p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
                        Prior Revision Rounds &amp; Mentor Notes
                      </h4>
                      {submission.detailed_feedback_history?.map((hist, idx) => (
                        <div key={hist.id || idx} className="rounded-lg bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 p-3.5 text-xs shadow-2xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span className="font-bold text-purple-700 dark:text-purple-400">Round #{(submission.detailed_feedback_history?.length ?? 0) - idx}</span>
                            <span>{new Date(hist.created_at).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{hist.comments}</p>

                          {hist.timestamped_notes && hist.timestamped_notes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                              {hist.timestamped_notes.map((n) => (
                                <span key={n.id} className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                                  [{n.formatted_time}] {n.category}: {n.text}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Assignment Challenge Brief */}
                      {submission.assignment_instructions && (
                        <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-xs text-slate-600 dark:text-slate-300">
                          <strong className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Assignment Challenge Brief:</strong>
                          <p className="leading-relaxed">{submission.assignment_instructions}</p>
                        </div>
                      )}

                      {/* Video Player & Asset Preview Container */}
                      <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-900/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            {getSubmissionFileIcon(fileType)}
                            <span>Submitted Student Asset ({fileType.replace('_', ' ').toUpperCase()})</span>
                          </span>

                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 border border-transparent dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                          >
                            <Download size={13} />
                            <span>Download File</span>
                            <ExternalLink size={12} className="text-slate-400" />
                          </a>
                        </div>

                        {/* In-app video player */}
                        {fileType === 'video' ? (
                          <div className="space-y-3">
                            <div className="overflow-hidden rounded-xl bg-black shadow-inner">
                              <video
                                ref={(el) => {
                                  videoRefs.current[submission.id] = el;
                                }}
                                controls
                                controlsList="nodownload"
                                onContextMenu={(e) => e.preventDefault()}
                                src={resolvedUrl}
                                onTimeUpdate={(e) => {
                                  const time = e.currentTarget?.currentTime;
                                  if (typeof time === 'number' && !isNaN(time)) {
                                    setActivePlaybackTime((prev) => ({
                                      ...prev,
                                      [submission.id]: time,
                                    }));
                                  }
                                }}
                                className="aspect-video w-full max-h-96 object-contain"
                                preload="metadata"
                              />
                            </div>

                            {/* Timestamp Note Builder Bar */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const vid = videoRefs.current[submission.id];
                                    if (vid && typeof vid.currentTime === 'number' && !isNaN(vid.currentTime)) {
                                      const time = vid.currentTime;
                                      setActivePlaybackTime((prev) => ({
                                        ...prev,
                                        [submission.id]: time,
                                      }));
                                    }
                                  }}
                                  title="Click to capture current video playhead"
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-2.5 py-1 text-xs font-mono font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition"
                                >
                                  <Clock size={12} className="text-orange-400" />
                                  {formatTimecode(activePlaybackTime[submission.id] || 0)}
                                </button>

                                <select
                                  value={activeNoteCat[submission.id] || 'pacing'}
                                  onChange={(e) =>
                                    setActiveNoteCat((prev) => ({
                                      ...prev,
                                      [submission.id]: e.target.value as
                                        | 'pacing'
                                        | 'audio'
                                        | 'color'
                                        | 'storytelling'
                                        | 'technical'
                                        | 'general',
                                    }))
                                  }
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-400"
                                >
                                  <option value="pacing" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">⏱ Pacing</option>
                                  <option value="audio" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🎵 Audio</option>
                                  <option value="color" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🎨 Color</option>
                                  <option value="storytelling" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">📖 Storytelling</option>
                                  <option value="technical" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🛠 Technical</option>
                                  <option value="general" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">💬 General</option>
                                </select>

                                <input
                                  type="text"
                                  placeholder="Add frame note at this exact second..."
                                  value={activeNoteText[submission.id] || ''}
                                  onChange={(e) =>
                                    setActiveNoteText((prev) => ({
                                      ...prev,
                                      [submission.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddTimecodedNote(submission.id);
                                    }
                                  }}
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-orange-400"
                                />

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleAddTimecodedNote(submission.id)}
                                  className="shrink-0"
                                >
                                  + Add Marker
                                </Button>
                              </div>

                              {/* Interactive Timecoded Markers List */}
                              {subTimestamps.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                                  {subTimestamps.map((note) => (
                                    <button
                                      key={note.id}
                                      onClick={() => seekVideo(submission.id, note.timestamp_seconds)}
                                      className="group flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 text-left text-xs transition hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-slate-800"
                                      title="Click to seek video to timestamp"
                                    >
                                      <span className="font-mono font-bold text-orange-600 dark:text-orange-400 group-hover:underline">
                                        [{note.formatted_time}]
                                      </span>
                                      <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{note.category}:</span>
                                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-xs">{note.text}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : fileType === 'image' ? (
                          <div className="flex justify-center overflow-hidden rounded-xl bg-slate-900 p-2">
                            <img
                              src={resolvedUrl}
                              alt="Student timeline submission"
                              className="max-h-80 object-contain rounded-lg"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                                <FileArchive size={20} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white">Project Archive / Timeline Rushes</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                   Download to inspect in Premiere Pro, DaVinci Resolve, or FCPX
                                </p>
                              </div>
                            </div>
                            <a
                              href={resolvedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-slate-950 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-orange-600 dark:hover:bg-orange-600 transition"
                            >
                              Open in NLE
                            </a>
                          </div>
                        )}
                      </div>

                      {/* 5-Axis Rubric Matrix Scoring */}
                      <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Sliders size={14} className="text-orange-600 dark:text-orange-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Rubric Assessment (5-Point Standardized Matrix)
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const tplId = e.target.value;
                                if (!tplId) return;
                                const tpl = RUBRIC_REVIEW_TEMPLATES.find((t) => t.id === tplId);
                                if (!tpl) return;
                                setRubrics((prev) => ({
                                  ...prev,
                                  [submission.id]: { ...tpl.scores },
                                }));
                                setFeedbackNotes((prev) => {
                                  const current = prev[submission.id]?.trim() || '';
                                  if (!current) return { ...prev, [submission.id]: tpl.suggestedComments };
                                  return { ...prev, [submission.id]: `${current}\n\n[${tpl.name}]: ${tpl.suggestedComments}` };
                                });
                                e.target.value = '';
                              }}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none hover:border-orange-300 focus:border-orange-500"
                            >
                              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Apply Rubric Template...</option>
                              {RUBRIC_REVIEW_TEMPLATES.map((t) => (
                                <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                  {t.name} ({t.stage})
                                </option>
                              ))}
                            </select>

                            {(() => {
                              const avg = Math.round((rubricTotal / 5) * 10) / 10;
                              let grade = 'Needs Revision';
                              if (avg >= 4.8) grade = 'A+ (Exemplary)';
                              else if (avg >= 4.3) grade = 'A (Excellent)';
                              else if (avg >= 3.8) grade = 'B+ (Proficient)';
                              else if (avg >= 3.3) grade = 'B (Competent)';
                              else if (avg >= 2.5) grade = 'C (Developing)';
                              return (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border border-transparent dark:border-orange-900/40 px-2.5 py-1 text-xs font-black">
                                  <span>Avg: {avg} / 5.0</span>
                                  <span className="opacity-40">•</span>
                                  <span>{grade}</span>
                                  <span className="opacity-40">•</span>
                                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">({rubricTotal}/25)</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
                          {(
                            [
                              { key: 'storytelling', label: 'Storytelling & Arc' },
                              { key: 'pacing', label: 'Pacing & Rhythm' },
                              { key: 'audio', label: 'Audio & Sound' },
                              { key: 'color', label: 'Color & Tone' },
                              { key: 'technical', label: 'Technical Polish' },
                            ] as const
                          ).map(({ key, label }) => {
                            const scoreVal = currentRubric[key] || 1;
                            const levelDesc =
                              scoreVal === 1
                                ? 'Rebuild'
                                : scoreVal === 2
                                ? 'Developing'
                                : scoreVal === 3
                                ? 'Competent'
                                : scoreVal === 4
                                ? 'Advanced'
                                : 'Mastered';
                            return (
                              <div key={key} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-800 p-2.5 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-[11px] truncate">{label}</p>
                                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400">{scoreVal}/5</span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 dark:text-slate-400 font-medium">{levelDesc}</p>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-1">
                                  {[1, 2, 3, 4, 5].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => handleUpdateRubric(submission.id, key, score)}
                                      title={`Set ${label} to ${score}/5 (${
                                        score === 1
                                          ? 'Needs Rebuild'
                                          : score === 2
                                          ? 'Developing'
                                          : score === 3
                                          ? 'Competent'
                                          : score === 4
                                          ? 'Advanced'
                                          : 'Mastered'
                                      })`}
                                      className={`h-8 w-full sm:h-7 sm:w-7 rounded-lg text-xs font-bold transition touch-manipulation ${
                                        scoreVal >= score
                                          ? 'bg-orange-500 text-white'
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Review Canned Templates */}
                      <div className="mt-4">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                          Quick Critique Templates (click to inject):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {REVIEW_TEMPLATES.map((tmpl) => (
                            <button
                              key={tmpl.label}
                              type="button"
                              onClick={() => handleInsertTemplate(submission.id, tmpl.text)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            >
                              + {tmpl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Feedback Textarea Form */}
                      <div className="mt-4">
                        <label className="block text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Student-Facing Feedback &amp; Action Items
                          <textarea
                            value={feedbackNotes[submission.id] ?? ''}
                            onChange={(event) =>
                              setFeedbackNotes((current) => ({ ...current, [submission.id]: event.target.value }))
                            }
                            rows={3}
                            placeholder="Detail timeline pacing, audio ducking, color balance adjustments, or next steps for the student..."
                            className="mt-2 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs sm:text-sm font-normal text-slate-900 dark:text-white outline-none focus:border-orange-400"
                          />
                        </label>
                      </div>

                      {/* Private Staff Notes (Collapsible) */}
                      <div className="mt-3">
                        <label className="block text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                          <Lock size={11} className="inline mr-1 text-slate-400" />
                          Private Mentor Notes (Hidden from Student)
                          <input
                            type="text"
                            value={privateNotes[submission.id] ?? ''}
                            onChange={(e) =>
                              setPrivateNotes((prev) => ({ ...prev, [submission.id]: e.target.value }))
                            }
                            placeholder="Internal observations, student learning behavior notes, or questions for admin..."
                            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-orange-400"
                          />
                        </label>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEscalatingSubmission(submission)}
                          className="w-full sm:w-auto text-xs text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 justify-center"
                        >
                          <Flag size={13} /> Escalate to Admin
                        </Button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void review(submission, 'resubmit')}
                            loading={savingId === submission.id}
                            className="w-full sm:w-auto text-xs font-bold text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 justify-center"
                          >
                            <RotateCcw size={14} /> Request Revision (Resubmit)
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void review(submission, 'reviewed')}
                            loading={savingId === submission.id}
                            className="w-full sm:w-auto text-xs font-bold justify-center"
                          >
                            <Check size={14} /> Approve &amp; Mark Reviewed
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
            {filteredSubmissions.length > pageSize && (
              <div className="pt-2">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalSubPages}
                  totalItems={filteredSubmissions.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>
        ) : (
          <StateFallback
            type="empty"
            title="Review Queue is Clear"
            description="No submissions match the current filter. When students upload challenge edits, they will appear here."
            actionText="Reset Filters"
            onAction={() => {
              setStatusTab('all');
              setSelectedCohort('all');
              setSearchQuery('');
            }}
          />
        )}
      </main>

      {/* Escalate to Admin Modal */}
      {escalatingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Flag size={18} />
                <h2 className="text-base font-black text-slate-950 dark:text-white">Escalate to Administration</h2>
              </div>
              <button
                onClick={() => setEscalatingSubmission(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEscalate} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500 dark:text-slate-400">
                Flagging submission by <strong className="text-slate-950 dark:text-white font-bold">{escalatingSubmission.student_name}</strong> for administrator review.
              </p>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300">Reason Category</label>
                <select
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-400"
                >
                  <option value="Second Opinion Needed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Second Opinion Needed on Assessment</option>
                  <option value="Plagiarism / Unoriginal Assets" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Plagiarism / Uncredited Footage</option>
                  <option value="Content Guideline Violation" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Content Guideline Violation</option>
                  <option value="Student Assistance / Distress" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Student Needs Academic Assistance</option>
                  <option value="Technical Issue" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Technical Asset Malfunction</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300">Context &amp; Details for Admin</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this submission requires administrative intervention..."
                  value={escalationDetail}
                  onChange={(e) => setEscalationDetail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setEscalatingSubmission(null)}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={submittingEscalation} className="bg-red-600 hover:bg-red-700 text-white">
                  <Flag size={13} /> Confirm Escalation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
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
