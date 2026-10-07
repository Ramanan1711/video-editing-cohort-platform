import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Award,
  Calendar,
  Check,
  CheckSquare,
  ExternalLink,
  FileText,
  History,
  Layers,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { startCohortCheckout, DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../lib/paymentService';
import {
  addFeedbackReply,
  formatFileSize,
  listAllStudentCohorts,
  listAssignments,
  listAvailableCohorts,
  listMySubmissions,
  listSubmissionVersions,
  markFeedbackRead,
  submitOrReplaceAssignment,
  subscribeToUserSubmissions,
  type Assignment,
  type Cohort,
  type Submission,
  type SubmissionVersion,
  uploadSubmissionFile,
  getSecureSubmissionUrl,
} from '../lib/courseService';
import { AssignmentCard } from './student/player/AssignmentSubmitCard';


const handleOpenSecureSubmissionFile = async (e: React.MouseEvent, rawUrl: string) => {
  e.preventDefault();
  const secureUrl = await getSecureSubmissionUrl(rawUrl);
  window.open(secureUrl, '_blank', 'noopener,noreferrer');
};

function getCohortEnrollmentStatus(cohort: Cohort): { isOpen: boolean; label?: string } {
  if (cohort.status && !['published', 'active'].includes(cohort.status)) {
    return { isOpen: false, label: 'Not Open' };
  }
  const now = Date.now();
  if (cohort.enrollment_start && new Date(cohort.enrollment_start).getTime() > now) {
    return { isOpen: false, label: 'Opening Soon' };
  }
  if (cohort.enrollment_end && new Date(cohort.enrollment_end).getTime() < now) {
    return { isOpen: false, label: 'Enrollment Closed' };
  }
  return { isOpen: true };
}

export function EnrollmentPanel({
  userId,
  userEmail,
  userName,
  initialCohortId,
  autoCheckout = false,
  onEnrolled,
}: {
  userId: string;
  userEmail?: string;
  userName?: string;
  initialCohortId?: string;
  autoCheckout?: boolean;
  onEnrolled: () => void;
}) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    () => initialCohortId || ''
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAvailableCohorts(userId)
      .then((data) => {
        if (!active) return;
        setCohorts(data);
        const preferred = initialCohortId;
        if (preferred && data.some((c) => c.id === preferred)) {
          setSelectedId(preferred);
        } else if (data.length > 0) {
          setSelectedId((curr) => curr || data[0].id);
        }
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Unable to load cohorts.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId, initialCohortId]);

  const selectedCohort = cohorts.find((c) => c.id === selectedId);
  const selectedStatus = selectedCohort ? getCohortEnrollmentStatus(selectedCohort) : null;
  const autoCheckoutTriggeredRef = useRef(false);

  const enroll = useCallback(async () => {
    if (!selectedCohort || !selectedStatus?.isOpen) return;
    setSaving(true);
    setError(null);

    const price = selectedCohort.price_inr ?? DEFAULT_COHORT_FEE_INR;
    if (price <= 0) {
      setError('Free enrollment is prohibited under the platform paid-only policy. Cohorts require paid checkout.');
      setSaving(false);
      return;
    }

    await startCohortCheckout({
      cohortId: selectedCohort.id,
      cohortName: selectedCohort.name,
      userEmail,
      userName,
      onSuccess: () => {
        setSaving(false);
        onEnrolled();
      },
      onError: (err) => {
        setSaving(false);
        setError(err.message || 'Payment was unsuccessful or cancelled.');
      },
      onDismiss: () => {
        setSaving(false);
      },
    });
  }, [selectedCohort, selectedStatus?.isOpen, userEmail, userName, onEnrolled]);

  useEffect(() => {
    if (
      autoCheckout &&
      selectedCohort &&
      selectedStatus?.isOpen &&
      !autoCheckoutTriggeredRef.current &&
      !saving
    ) {
      autoCheckoutTriggeredRef.current = true;
      void enroll();
    }
  }, [autoCheckout, selectedCohort, selectedStatus?.isOpen, saving, enroll]);

  return (
    <Card className="mx-auto max-w-3xl p-6 sm:p-10">
      <div className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
        <Sparkles size={22} />
      </div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-orange-500">Your next step</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Choose your cohort.</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
        Join an active cohort to unlock its roadmap, video lessons, editing challenges, and mentor review room.
      </p>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <LoaderCircle className="mt-8 animate-spin text-orange-500" size={20} />
      ) : cohorts.length ? (
        <div className="mt-7 space-y-3">
          {cohorts.map((cohort) => {
            const status = getCohortEnrollmentStatus(cohort);
            const isSelected = selectedId === cohort.id;
            return (
              <button
                key={cohort.id}
                onClick={() => status.isOpen && setSelectedId(cohort.id)}
                disabled={!status.isOpen}
                className={`flex w-full items-start justify-between rounded-xl border p-4 text-left transition ${
                  !status.isOpen
                    ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                    : isSelected
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 hover:border-orange-200'
                }`}
              >
                <span>
                  <div className="flex items-center gap-2">
                    <strong className="block text-sm text-slate-950">{cohort.name}</strong>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                      ₹{(cohort.price_inr ?? DEFAULT_COHORT_FEE_INR).toLocaleString('en-IN')} {cohort.currency || DEFAULT_CURRENCY}
                    </span>
                    {!status.isOpen && (
                      <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {status.label}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block text-sm text-slate-500">{cohort.description || 'A focused learning cohort.'}</span>
                </span>
                {isSelected && <Check className="text-orange-600" size={19} />}
              </button>
            );
          })}
          <Button
            onClick={() => void enroll()}
            loading={saving}
            disabled={!selectedId || !selectedStatus?.isOpen}
            className="mt-3"
          >
            {saving
              ? 'Opening checkout...'
              : selectedStatus && !selectedStatus.isOpen
              ? selectedStatus.label || 'Enrollment Closed'
              : selectedCohort && (selectedCohort.price_inr ?? DEFAULT_COHORT_FEE_INR) > 0
              ? `Proceed to Checkout (₹${(selectedCohort.price_inr ?? DEFAULT_COHORT_FEE_INR).toLocaleString('en-IN')} ${selectedCohort.currency || DEFAULT_CURRENCY})`
              : 'Enroll in cohort'}
          </Button>
        </div>
      ) : (
        <p className="mt-7 text-sm text-slate-400">There are no open cohorts right now. Check back soon.</p>
      )}
    </Card>
  );
}

export function CohortDiscoveryModal({
  userId,
  userEmail,
  userName,
  isOpen,
  onClose,
  currentCohortId,
  targetCohortId,
  onSelectCohort,
}: {
  userId: string;
  userEmail?: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  currentCohortId?: string | null;
  targetCohortId?: string | null;
  onSelectCohort: (cohortId: string) => void;
}) {
  const [cohorts, setCohorts] = useState<(Cohort & { isEnrolled: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    listAllStudentCohorts(userId)
      .then((data) => {
        if (active) {
          setCohorts(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load cohorts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleEnrollAndSwitch = async (cohort: Cohort) => {
    setError(null);
    setEnrollingId(cohort.id);

    const price = cohort.price_inr ?? DEFAULT_COHORT_FEE_INR;
    if (price <= 0) {
      setError('Free enrollment is prohibited under the platform paid-only policy. Cohorts require paid checkout.');
      setEnrollingId(null);
      return;
    }

    await startCohortCheckout({
      cohortId: cohort.id,
      cohortName: cohort.name,
      userEmail,
      userName,
      onSuccess: () => {
        setEnrollingId(null);
        onSelectCohort(cohort.id);
        onClose();
      },
      onError: (err) => {
        setEnrollingId(null);
        setError(err.message || 'Payment was unsuccessful or cancelled.');
      },
      onDismiss: () => {
        setEnrollingId(null);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Layers size={16} />
              </span>
              <h3 className="text-xl font-black text-slate-950">Cohort Discovery &amp; Switcher</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Browse available editing cohorts or seamlessly switch between your active enrollments.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderCircle size={24} className="animate-spin text-orange-500" />
            </div>
          ) : cohorts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No active cohorts available right now.
            </div>
          ) : (
            (targetCohortId
              ? [...cohorts].sort((a, b) => (a.id === targetCohortId ? -1 : b.id === targetCohortId ? 1 : 0))
              : cohorts
            ).map((cohort) => {
              const isCurrent = cohort.id === currentCohortId;
              const isEnrolled = cohort.isEnrolled;
              const isTargetUnpaid = cohort.id === targetCohortId && !isEnrolled;

              return (
                <div
                  key={cohort.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition ${
                    isTargetUnpaid
                      ? 'border-orange-500 ring-2 ring-orange-400/30 bg-orange-50/40 shadow-sm'
                      : isCurrent
                      ? 'border-orange-400 bg-orange-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-950">{cohort.name}</h4>
                      {isTargetUnpaid && (
                        <span className="rounded-md bg-orange-500 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                          Selected Course
                        </span>
                      )}
                      {isCurrent && (
                        <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          Active View
                        </span>
                      )}
                      {!isCurrent && isEnrolled && (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Enrolled
                        </span>
                      )}
                      {!isEnrolled && (
                        (() => {
                          const status = getCohortEnrollmentStatus(cohort);
                          return (
                            <>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  status.isOpen
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                                }`}
                              >
                                {status.isOpen ? 'Open to Join' : status.label || 'Closed'}
                              </span>
                              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                ₹{(cohort.price_inr ?? DEFAULT_COHORT_FEE_INR).toLocaleString('en-IN')} {cohort.currency || DEFAULT_CURRENCY}
                              </span>
                            </>
                          );
                        })()
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {cohort.description || 'Intensive video editing coursework and portfolio mentorship.'}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600">
                        <Check size={15} /> Currently viewing
                      </span>
                    ) : isEnrolled ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onSelectCohort(cohort.id);
                          onClose();
                        }}
                      >
                        Switch Cohort
                      </Button>
                    ) : (
                      (() => {
                        const status = getCohortEnrollmentStatus(cohort);
                        return (
                          <Button
                            size="sm"
                            variant={status.isOpen ? 'primary' : 'secondary'}
                            disabled={!status.isOpen}
                            loading={enrollingId === cohort.id}
                            onClick={() => status.isOpen && void handleEnrollAndSwitch(cohort)}
                          >
                            {status.isOpen
                              ? `Enroll (₹${(cohort.price_inr ?? DEFAULT_COHORT_FEE_INR).toLocaleString('en-IN')} ${cohort.currency || DEFAULT_CURRENCY})`
                              : status.label || 'Closed'}
                          </Button>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AssignmentPanel({
  userId,
  cohortId,
  onFeedbackRead,
}: {
  userId: string;
  cohortId: string;
  onFeedbackRead?: () => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acknowledgedLate, setAcknowledgedLate] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [nowTimestamp] = useState(() => Date.now());

  // Version History Modal State
  const [viewingVersionSubmission, setViewingVersionSubmission] = useState<Submission | null>(null);
  const [submissionVersions, setSubmissionVersions] = useState<SubmissionVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionViewTab, setVersionViewTab] = useState<'timeline' | 'compare'>('timeline');
  const [compareVersionId, setCompareVersionId] = useState<string>('');

  // Revision Checklist State for Resubmission
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    pacing: false,
    audio: false,
    color: false,
    critique: false,
  });

  const load = async () => {
    try {
      const [nextAssignments, nextSubmissions] = await Promise.all([
        listAssignments(cohortId),
        listMySubmissions(userId),
      ]);
      setAssignments(nextAssignments);
      setSubmissions(nextSubmissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([listAssignments(cohortId), listMySubmissions(userId)])
      .then(([nextAssignments, nextSubmissions]) => {
        if (!active) return;
        setAssignments(nextAssignments);
        setSubmissions(nextSubmissions);
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Unable to load assignments.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cohortId, userId]);

  // Real-time listener for mentor critiques, approvals, and replies
  useEffect(() => {
    const unsubscribe = subscribeToUserSubmissions(userId, () => {
      listMySubmissions(userId)
        .then((latestSubs) => setSubmissions(latestSubs))
        .catch((err) => console.warn('Real-time submission refresh failed:', err));
    });
    return () => {
      unsubscribe();
    };
  }, [userId]);

  const submit = async (event: React.FormEvent, isDraft = false) => {
    event.preventDefault();
    if (!activeAssignment || !file) return;

    if (file.size > 500 * 1024 * 1024) {
      setError('Files must be smaller than 500 MB.');
      return;
    }

    // Supported format check
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const ALLOWED = ['.mp4', '.mov', '.webm', '.prproj', '.drp', '.fcpxml', '.aep', '.zip', '.rar', '.7z', '.pdf', '.doc', '.docx'];
    if (!ALLOWED.includes(ext)) {
      setError(`File extension ${ext} is not supported. Please upload a video (.mp4, .mov), project file (.prproj, .drp, .aep), ZIP archive, or PDF.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const submittedUrl = await uploadSubmissionFile(userId, file);
      const existingSubmission = submissions.find((item) => item.assignment_id === activeAssignment.id);

      await submitOrReplaceAssignment(
        userId,
        activeAssignment.id,
        submittedUrl,
        existingSubmission?.id,
        isDraft,
        submissionNotes.trim() || undefined
      );

      setSuccess(
        isDraft
          ? 'Submission draft saved successfully!'
          : isResubmitting
          ? 'Revised submission uploaded successfully! Awaiting mentor review.'
          : 'Assignment submitted successfully for mentor review!'
      );
      setActiveAssignment(null);
      setFile(null);
      setSubmissionNotes('');
      setIsResubmitting(false);
      setAcknowledgedLate(false);
      setChecklist({ pacing: false, audio: false, color: false, critique: false });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit assignment.');
    } finally {
      setSaving(false);
    }
  };

  const openSubmitModal = (assignment: Assignment, isResubmit = false) => {
    setActiveAssignment(assignment);
    setIsResubmitting(isResubmit);
    setFile(null);
    setSubmissionNotes('');
    setError(null);
    setAcknowledgedLate(false);
    setChecklist({ pacing: false, audio: false, color: false, critique: false });
  };

  const handleOpenVersions = async (submission: Submission) => {
    setViewingVersionSubmission(submission);
    setLoadingVersions(true);
    setVersionViewTab('timeline');
    try {
      const versions = await listSubmissionVersions(submission.id);
      setSubmissionVersions(versions);
      if (versions.length > 0) {
        setCompareVersionId(versions[0].id);
      }
    } catch (err) {
      console.warn('Failed to load versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSendFeedbackReply = async (feedbackId: string, message: string) => {
    await addFeedbackReply(feedbackId, userId, message);
    await load();
  };

  const handleMarkCritiqueRead = async (feedbackId: string) => {
    try {
      await markFeedbackRead(feedbackId);
      setSubmissions((prev) =>
        prev.map((sub) => ({
          ...sub,
          feedback_history: (sub.feedback_history || []).map((f) =>
            f.id === feedbackId ? { ...f, student_read_at: new Date().toISOString() } : f
          ),
        }))
      );
      if (onFeedbackRead) {
        onFeedbackRead();
      }
    } catch (err) {
      console.warn('Failed to mark critique read:', err);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">The proof loop</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Assignments &amp; Reviews</h2>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {submissions.filter((item) => item.status === 'reviewed').length} of {assignments.length} reviewed
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <LoaderCircle className="animate-spin text-orange-500" size={20} />
      ) : assignments.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              submission={submissions.find((item) => item.assignment_id === assignment.id)}
              onSubmit={() => openSubmitModal(assignment, false)}
              onResubmit={() => openSubmitModal(assignment, true)}
              onOpenVersions={handleOpenVersions}
              onSendReply={handleSendFeedbackReply}
              onMarkFeedbackRead={handleMarkCritiqueRead}
            />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-sm text-slate-400">No assignments have been published for this cohort yet.</Card>
      )}

      {/* Submission / Resubmission Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-5 backdrop-blur-sm">
          <form onSubmit={(e) => void submit(e, false)} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-500">
                  {isResubmitting ? 'Resubmit Assignment Revision' : 'Submit Assignment'}
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">{activeAssignment.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignment(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            {/* Assignment Instructions */}
            {activeAssignment.instructions && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">
                <strong className="mb-1 block font-bold text-slate-800">Assignment Brief &amp; Instructions:</strong>
                {activeAssignment.instructions}
              </div>
            )}

            {/* Deadline Display */}
            {activeAssignment.deadline && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Calendar size={14} className="text-orange-500" />
                <span>Due by: {formatDeadline(activeAssignment.deadline)}</span>
              </div>
            )}

            {/* Late Submission Warning and Required Acknowledgment */}
            {Boolean(
              activeAssignment.deadline &&
                new Date(activeAssignment.deadline).getTime() < nowTimestamp
            ) && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-900">
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <AlertTriangle size={15} className="text-red-600 shrink-0" />
                  <span>Late Submission Warning</span>
                </div>
                <p className="mt-1 text-slate-700 leading-relaxed">
                  The official deadline for this cohort assignment was{' '}
                  <span className="font-semibold text-slate-900">
                    {formatDeadline(activeAssignment.deadline!)}
                  </span>
                  . Submissions after this date are flagged as late for mentor review.
                </p>
                <label className="mt-2.5 flex items-start gap-2 cursor-pointer font-bold text-red-950">
                  <input
                    type="checkbox"
                    checked={acknowledgedLate}
                    onChange={(e) => setAcknowledgedLate(e.target.checked)}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                  />
                  <span>I acknowledge that this work is being submitted past the deadline.</span>
                </label>
              </div>
            )}

            {/* Interactive Revision Checklist for Resubmission */}
            {isResubmitting && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                  <CheckSquare size={14} className="text-amber-600" /> Revision Self-Checklist
                </span>
                <p className="mt-1 text-xs text-amber-700">
                  Verify these core polish items before submitting your revision to mentor:
                </p>
                <div className="mt-2.5 space-y-2 text-xs text-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.critique}
                      onChange={(e) => setChecklist({ ...checklist, critique: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>Applied all mentor critique &amp; timeline adjustments</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.pacing}
                      onChange={(e) => setChecklist({ ...checklist, pacing: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>Pacing &amp; cutting continuity reviewed on playback</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.audio}
                      onChange={(e) => setChecklist({ ...checklist, audio: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>Dialogue levels balanced and background music ducked</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.color}
                      onChange={(e) => setChecklist({ ...checklist, color: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>Color grade and skin tones checked across cut points</span>
                  </label>
                </div>
              </div>
            )}

            {/* File Upload Form */}
            <label className="mt-5 block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Upload your video, project file, or export <span className="text-red-500">*</span>
              </span>
              <input
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.prproj,.drp,.fcpxml,.aep,.zip,.rar,.7z,.pdf"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-normal outline-none focus:border-orange-400"
              />
              <span className="mt-1.5 block text-[11px] text-slate-400">
                Accepted formats: .mp4, .mov, .webm, Premiere (.prproj), DaVinci (.drp), FCP (.fcpxml), After Effects (.aep), ZIP, PDF (Max 500 MB).
              </span>
            </label>

            {file && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <span className="font-bold">Ready to upload:</span> {file.name} ({formatFileSize(file.size)})
              </div>
            )}

            {/* Student Reflection / Notes */}
            <label className="mt-4 block text-left">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                Notes / Reflection for your mentor (optional)
              </span>
              <textarea
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Share your creative decisions, problem areas you faced, or specific feedback you'd like on this cut..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-orange-400 placeholder:text-slate-400"
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setActiveAssignment(null)} disabled={saving}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => void submit(e, true)}
                  disabled={saving || !file}
                >
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={
                    saving ||
                    (Boolean(
                      activeAssignment.deadline &&
                        new Date(activeAssignment.deadline).getTime() < nowTimestamp
                    ) &&
                      !acknowledgedLate)
                  }
                >
                  {saving ? 'Uploading...' : isResubmitting ? 'Submit Revision' : 'Submit for Review'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Submission Version History Modal with Smart Side-by-Side Comparison */}
      {viewingVersionSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-orange-500" />
                <h3 className="text-base font-black text-slate-950">Submission Version History</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingVersionSubmission(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* View Mode Toggle: Timeline vs Smart Side-by-Side Comparison */}
            <div className="mt-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setVersionViewTab('timeline')}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  versionViewTab === 'timeline'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Version Timeline
              </button>
              <button
                type="button"
                onClick={() => {
                  setVersionViewTab('compare');
                  if (submissionVersions.length > 0 && !compareVersionId) {
                    setCompareVersionId(submissionVersions[0].id);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 flex-1 rounded-lg py-1.5 transition ${
                  versionViewTab === 'compare'
                    ? 'bg-white text-orange-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <ArrowRightLeft size={13} />
                <span>Smart Side-by-Side Comparison</span>
              </button>
            </div>

            {versionViewTab === 'timeline' ? (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                {/* Current Active Version */}
                <div className="rounded-xl border border-orange-300 bg-orange-50/30 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                      Version {viewingVersionSubmission.version_number || 1} (Active)
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {viewingVersionSubmission.created_at
                        ? new Date(viewingVersionSubmission.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Latest'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 capitalize">Status: {viewingVersionSubmission.status}</span>
                    <a
                      href={viewingVersionSubmission.file_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => void handleOpenSecureSubmissionFile(e, viewingVersionSubmission.file_url)}
                      className="inline-flex items-center gap-1 font-bold text-orange-600 underline"
                    >
                      View Active File <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                {/* Archived Historical Versions */}
                {loadingVersions ? (
                  <div className="py-4 text-center text-xs text-slate-400">Loading prior revisions...</div>
                ) : submissionVersions.length ? (
                  submissionVersions.map((ver) => (
                    <div key={ver.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-700">Version {ver.version_number} (Archived)</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ver.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-slate-500 capitalize">Prior status: {ver.status}</span>
                        <a
                          href={ver.file_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => void handleOpenSecureSubmissionFile(e, ver.file_url)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 underline hover:text-orange-600"
                        >
                          Archived File <ExternalLink size={11} />
                        </a>
                      </div>
                      {ver.notes && (
                        <p className="mt-1.5 rounded border border-slate-200 bg-white/80 p-2 text-[11px] text-slate-600 leading-snug">
                          <strong className="font-bold text-slate-700">Notes:</strong> {ver.notes}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-center text-xs text-slate-400">No previous versions archived yet.</p>
                )}
              </div>
            ) : (
              /* Smart Side-by-Side Comparison */
              <div className="mt-4 max-h-96 overflow-y-auto pr-1">
                {submissionVersions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
                    <ArrowRightLeft size={24} className="mx-auto mb-2 text-slate-400" />
                    <p className="font-bold text-slate-700">Single Version Submission</p>
                    <p className="mt-1 text-slate-500">
                      Only 1 version exists so far. Uploading a resubmission creates a new revision milestone, allowing side-by-side comparison of notes, files, and mentor evaluations here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Select Prior Version to compare with */}
                    {submissionVersions.length > 1 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-600">Compare against:</span>
                        <select
                          value={compareVersionId}
                          onChange={(e) => setCompareVersionId(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-orange-400"
                        >
                          {submissionVersions.map((v) => (
                            <option key={v.id} value={v.id}>
                              Version {v.version_number} ({new Date(v.created_at).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(() => {
                      const selectedVer =
                        submissionVersions.find((v) => v.id === compareVersionId) || submissionVersions[0];
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Prior Version Column */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-black text-slate-700">
                                Version {selectedVer.version_number} (Prior)
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(selectedVer.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                              <p className="capitalize font-semibold text-slate-700">{selectedVer.status}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">File Asset</span>
                              <div className="mt-0.5">
                                <a
                                  href={selectedVer.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => void handleOpenSecureSubmissionFile(e, selectedVer.file_url)}
                                  className="inline-flex items-center gap-1 font-semibold text-slate-600 underline hover:text-orange-600"
                                >
                                  Open Archived Media <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revision Notes</span>
                              <p className="mt-0.5 text-slate-600 text-[11px] leading-relaxed">
                                {selectedVer.notes || 'Prior submission draft.'}
                              </p>
                            </div>
                          </div>

                          {/* Current Active Version Column */}
                          <div className="rounded-xl border border-orange-300 bg-orange-50/40 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                              <span className="font-black text-orange-950">
                                Version {viewingVersionSubmission.version_number || (selectedVer.version_number + 1)} (Active)
                              </span>
                              <span className="text-[10px] text-orange-700 font-semibold">
                                {viewingVersionSubmission.created_at
                                  ? new Date(viewingVersionSubmission.created_at).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'Current'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Current Status</span>
                              <p className="capitalize font-black text-orange-950">{viewingVersionSubmission.status}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Active File</span>
                              <div className="mt-0.5">
                                <a
                                  href={viewingVersionSubmission.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => void handleOpenSecureSubmissionFile(e, viewingVersionSubmission.file_url)}
                                  className="inline-flex items-center gap-1 font-bold text-orange-700 underline hover:text-orange-900"
                                >
                                  Open Latest Revision <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Mentor Review</span>
                              <p className="mt-0.5 text-slate-700 text-[11px] leading-relaxed">
                                {viewingVersionSubmission.feedback ||
                                  (viewingVersionSubmission.status === 'reviewed'
                                    ? 'Reviewed & Approved by Mentor'
                                    : 'Awaiting Mentor Review for this revision')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setViewingVersionSubmission(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



export function MilestonePanel({
  progressPercent,
  completedCount,
  totalLessons,
  onViewCertificate,
  onViewReportCard,
  label = 'lessons complete',
}: {
  progressPercent: number;
  completedCount: number;
  totalLessons: number;
  onViewCertificate?: () => void;
  onViewReportCard?: () => void;
  label?: string;
}) {
  const complete = progressPercent === 100 && totalLessons > 0;
  return (
    <Card className="mt-8 overflow-hidden border-orange-200 bg-orange-50 p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
            {complete ? 'Cohort complete' : 'Your milestone'}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            {complete ? 'You made it through.' : `${progressPercent}% of the way there.`}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {complete
              ? 'Your verified certificate and official internship evaluation report are ready.'
              : `${completedCount} of ${totalLessons} ${label}. Keep the streak alive.`}
          </p>
        </div>
        {complete ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onViewCertificate}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-600"
            >
              <Award size={18} className="text-orange-400" />
              <span>View Official Certificate</span>
            </button>
            {onViewReportCard && (
              <button
                onClick={onViewReportCard}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-xs transition hover:bg-slate-50"
              >
                <FileText size={18} className="text-orange-500" />
                <span>Internship Report Card</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {onViewReportCard && (
              <button
                onClick={onViewReportCard}
                className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white/80 px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-white"
              >
                <FileText size={15} className="text-orange-500" />
                <span>View Evaluation Dossier</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
              <Sparkles size={20} /> Keep going
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatDeadline(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'No date';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

