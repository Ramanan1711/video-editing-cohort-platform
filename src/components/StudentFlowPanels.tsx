import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  FileText,
  History,
  Layers,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  addFeedbackReply,
  enrollInCohort,
  formatFileSize,
  listAllStudentCohorts,
  listAssignments,
  listAvailableCohorts,
  listMySubmissions,
  listSubmissionVersions,
  submitOrReplaceAssignment,
  type Assignment,
  type Cohort,
  type Submission,
  type SubmissionVersion,
  uploadSubmissionFile,
} from '../lib/courseService';

export function EnrollmentPanel({ userId, onEnrolled }: { userId: string; onEnrolled: () => void }) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAvailableCohorts(userId)
      .then((data) => active && setCohorts(data))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Unable to load cohorts.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  const enroll = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await enrollInCohort(userId, selectedId);
      onEnrolled();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to enroll.');
    } finally {
      setSaving(false);
    }
  };

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
          {cohorts.map((cohort) => (
            <button
              key={cohort.id}
              onClick={() => setSelectedId(cohort.id)}
              className={`flex w-full items-start justify-between rounded-xl border p-4 text-left transition ${
                selectedId === cohort.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-200'
              }`}
            >
              <span>
                <strong className="block text-sm text-slate-950">{cohort.name}</strong>
                <span className="mt-1 block text-sm text-slate-500">{cohort.description || 'A focused learning cohort.'}</span>
              </span>
              {selectedId === cohort.id && <Check className="text-orange-600" size={19} />}
            </button>
          ))}
          <Button onClick={() => void enroll()} loading={saving} disabled={!selectedId} className="mt-3">
            {saving ? 'Joining cohort...' : 'Enroll in cohort'}
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
  isOpen,
  onClose,
  currentCohortId,
  onSelectCohort,
}: {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  currentCohortId?: string | null;
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

  const handleEnrollAndSwitch = async (cohortId: string) => {
    try {
      setEnrollingId(cohortId);
      await enrollInCohort(userId, cohortId);
      onSelectCohort(cohortId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll in cohort.');
    } finally {
      setEnrollingId(null);
    }
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
            cohorts.map((cohort) => {
              const isCurrent = cohort.id === currentCohortId;
              const isEnrolled = cohort.isEnrolled;

              return (
                <div
                  key={cohort.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition ${
                    isCurrent
                      ? 'border-orange-400 bg-orange-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-950">{cohort.name}</h4>
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
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          Open to Join
                        </span>
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
                      <Button
                        size="sm"
                        variant="primary"
                        loading={enrollingId === cohort.id}
                        onClick={() => void handleEnrollAndSwitch(cohort.id)}
                      >
                        Enroll &amp; Switch
                      </Button>
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

export function AssignmentPanel({ userId, cohortId }: { userId: string; cohortId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Version History Modal State
  const [viewingVersionSubmission, setViewingVersionSubmission] = useState<Submission | null>(null);
  const [submissionVersions, setSubmissionVersions] = useState<SubmissionVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

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
        isDraft
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
      setIsResubmitting(false);
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
    setError(null);
    setChecklist({ pacing: false, audio: false, color: false, critique: false });
  };

  const handleOpenVersions = async (submission: Submission) => {
    setViewingVersionSubmission(submission);
    setLoadingVersions(true);
    try {
      const versions = await listSubmissionVersions(submission.id);
      setSubmissionVersions(versions);
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
                <Button type="submit" loading={saving}>
                  {saving ? 'Uploading...' : isResubmitting ? 'Submit Revision' : 'Submit for Review'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Submission Version History Modal */}
      {viewingVersionSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
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

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
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
                    className="inline-flex items-center gap-1 font-bold text-orange-600 underline"
                  >
                    View File <ExternalLink size={11} />
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
                        className="inline-flex items-center gap-1 font-semibold text-slate-700 underline hover:text-orange-600"
                      >
                        Archived File <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-2 text-center text-xs text-slate-400">No previous versions archived yet.</p>
              )}
            </div>

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

function AssignmentCard({
  assignment,
  submission,
  onSubmit,
  onResubmit,
  onOpenVersions,
  onSendReply,
}: {
  assignment: Assignment;
  submission?: Submission;
  onSubmit: () => void;
  onResubmit: () => void;
  onOpenVersions?: (submission: Submission) => void;
  onSendReply?: (feedbackId: string, message: string) => Promise<void>;
}) {
  const status = submission?.status;
  const deadlineStatus = getDeadlineStatus(assignment.deadline);
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);

  const handleReplySubmit = async (feedbackId: string) => {
    const text = (replyDrafts[feedbackId] || '').trim();
    if (!text || !onSendReply) return;
    setReplySending(feedbackId);
    try {
      await onSendReply(feedbackId, text);
      setReplyDrafts((prev) => ({ ...prev, [feedbackId]: '' }));
      setReplyOpen((prev) => ({ ...prev, [feedbackId]: false }));
    } catch (err) {
      console.warn('Failed to send reply:', err);
    } finally {
      setReplySending(null);
    }
  };

  return (
    <Card className="flex flex-col justify-between p-5 transition hover:border-slate-300 text-left">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">Assignment</p>
            <h3 className="mt-1 text-base font-black text-slate-950">{assignment.title}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            {status === 'reviewed' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <Check size={13} /> Reviewed &amp; Passed
              </span>
            ) : status === 'resubmit' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                <RotateCcw size={13} /> Revision Needed
              </span>
            ) : status === 'pending' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Clock size={13} /> Under Review
              </span>
            ) : status === 'draft' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                <FileText size={13} /> Draft Saved
              </span>
            ) : null}

            {submission?.is_late && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <AlertTriangle size={11} /> Late Submission
              </span>
            )}
          </div>
        </div>

        {/* Deadline Indicator */}
        {assignment.deadline && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                deadlineStatus.isPast
                  ? 'bg-red-50 text-red-600'
                  : deadlineStatus.isNear
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Calendar size={11} /> {deadlineStatus.label}
            </span>
          </div>
        )}

        {/* Instructions */}
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {assignment.instructions || 'Complete the challenge and submit your edited video or project file for mentor review.'}
        </p>

        {/* Submission Feedback & Status Details */}
        {submission && (
          <div
            className={`mt-4 rounded-xl p-3.5 text-xs ${
              status === 'resubmit'
                ? 'border border-amber-200 bg-amber-50/80 text-amber-900'
                : status === 'reviewed'
                ? 'border border-emerald-200 bg-emerald-50/80 text-emerald-900'
                : status === 'draft'
                ? 'border border-slate-200 bg-slate-100/80 text-slate-700'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>
                {status === 'resubmit'
                  ? 'Mentor Revision Requested'
                  : status === 'reviewed'
                  ? 'Reviewed & Approved'
                  : status === 'draft'
                  ? 'Draft in Progress'
                  : 'Submission Under Mentor Review'}
              </span>
              <a
                href={submission.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-600"
              >
                View submitted file <ExternalLink size={11} />
              </a>
            </div>

            {/* Version History Button */}
            {onOpenVersions && (
              <button
                type="button"
                onClick={() => onOpenVersions(submission)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline"
              >
                <History size={12} /> Submission Version History (v{submission.version_number || 1})
              </button>
            )}

            {/* Mentor Feedback History Thread with Replies */}
            {submission.feedback_history && submission.feedback_history.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-slate-200/60 pt-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <MessageSquare size={12} />
                  <span>Mentor Feedback History ({submission.feedback_history.length})</span>
                </div>
                {submission.feedback_history.map((item, idx) => (
                  <div key={item.id || idx} className="rounded-lg bg-white/90 p-3 shadow-2xs border border-slate-100">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-800">
                        {item.mentor_name ? `Critique by ${item.mentor_name}` : `Critique #${idx + 1}`}
                      </span>
                      <span>{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{item.comments}</p>

                    {/* 5-Point Rubric Evaluation */}
                    {item.rubric && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 mb-2">
                          <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                            Rubric Evaluation
                          </span>
                          {(() => {
                            const scores = [
                              item.rubric?.storytelling,
                              item.rubric?.pacing,
                              item.rubric?.audio,
                              item.rubric?.color,
                              item.rubric?.technical,
                            ].filter((v): v is number => typeof v === 'number');
                            if (!scores.length) return null;
                            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                            const grade = avg >= 4.5 ? 'A+' : avg >= 4.0 ? 'A' : avg >= 3.5 ? 'B+' : avg >= 3.0 ? 'B' : avg >= 2.0 ? 'C' : 'Needs Polish';
                            return (
                              <span className="rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
                                Grade {grade} ({avg.toFixed(1)}/5)
                              </span>
                            );
                          })()}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {[
                            { label: 'Storytelling & Narrative', val: item.rubric.storytelling ?? 0 },
                            { label: 'Pacing & Rhythm', val: item.rubric.pacing ?? 0 },
                            { label: 'Audio & Ducking', val: item.rubric.audio ?? 0 },
                            { label: 'Color Grade & Match', val: item.rubric.color ?? 0 },
                            { label: 'Technical Assembly', val: item.rubric.technical ?? 0 },
                          ].map((crit) => (
                            <div key={crit.label} className="flex flex-col gap-0.5">
                              <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                                <span>{crit.label}</span>
                                <span className="font-bold text-slate-800">{crit.val}/5</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    crit.val >= 4
                                      ? 'bg-emerald-500'
                                      : crit.val >= 3
                                      ? 'bg-orange-500'
                                      : 'bg-red-400'
                                  }`}
                                  style={{ width: `${(crit.val / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamped Critique Notes */}
                    {item.timestamped_notes && item.timestamped_notes.length > 0 && (
                      <div className="mt-2.5 rounded-lg border border-amber-200/70 bg-amber-50/60 p-2.5 text-xs">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900 mb-1.5">
                          <Clock size={12} className="text-amber-600" />
                          <span>Timeline Markers ({item.timestamped_notes.length})</span>
                        </div>
                        <div className="space-y-1">
                          {item.timestamped_notes.map((noteItem, nIdx) => (
                            <div key={nIdx} className="flex items-start gap-2 text-[11px]">
                              <span className="font-mono font-bold rounded bg-amber-200/60 px-1.5 py-0.5 text-amber-900 shrink-0">
                                {noteItem.formatted_time || `${Math.floor(noteItem.timestamp_seconds / 60)}:${String(Math.floor(noteItem.timestamp_seconds % 60)).padStart(2, '0')}`}
                              </span>
                              <span className="text-slate-700 leading-snug">{noteItem.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback Replies */}
                    {(item.replies || []).length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2">
                        {item.replies!.map((reply) => (
                          <div key={reply.id} className="rounded-md bg-slate-50 p-2 text-[11px]">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                              <span className="font-bold text-slate-700">{reply.author_name}</span>
                              <span>{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-700">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply to critique toggle */}
                    {onSendReply && (
                      <div className="mt-2">
                        {replyOpen[item.id] ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              placeholder="Reply to mentor feedback..."
                              value={replyDrafts[item.id] || ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-orange-400"
                            />
                            <Button
                              size="sm"
                              disabled={!replyDrafts[item.id]?.trim() || replySending === item.id}
                              onClick={() => void handleReplySubmit(item.id)}
                            >
                              <Send size={11} />
                            </Button>
                            <button
                              onClick={() => setReplyOpen((prev) => ({ ...prev, [item.id]: false }))}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyOpen((prev) => ({ ...prev, [item.id]: true }))}
                            className="text-[10px] font-bold text-orange-600 hover:underline"
                          >
                            + Reply to critique
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : submission.feedback ? (
              <div className="mt-2.5 border-t border-slate-200/60 pt-2 text-xs leading-relaxed">
                <strong>Mentor Notes:</strong> {submission.feedback}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-5">
        {status === 'resubmit' ? (
          <Button variant="primary" size="sm" className="w-full" onClick={onResubmit}>
            <RotateCcw size={14} /> Resubmit Assignment (Upload Revision)
          </Button>
        ) : status === 'pending' ? (
          <Button variant="secondary" size="sm" className="w-full" onClick={onResubmit}>
            <Upload size={14} /> Replace Submission File
          </Button>
        ) : status === 'draft' ? (
          <Button variant="primary" size="sm" className="w-full" onClick={onResubmit}>
            <Upload size={14} /> Finalize &amp; Submit Draft
          </Button>
        ) : status === 'reviewed' ? (
          <div className="text-center text-xs font-semibold text-emerald-600">
            ✓ Assignment completed and approved
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={onSubmit}>
            <Send size={14} /> Submit Assignment
          </Button>
        )}
      </div>
    </Card>
  );
}

export function MilestonePanel({
  progressPercent,
  completedCount,
  totalLessons,
  onViewCertificate,
}: {
  progressPercent: number;
  completedCount: number;
  totalLessons: number;
  onViewCertificate?: () => void;
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
              ? 'Your verified certificate and portfolio review are ready to download.'
              : `${completedCount} of ${totalLessons} lessons complete. Keep the streak alive.`}
          </p>
        </div>
        {complete ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onViewCertificate}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-600"
            >
              <Award size={18} className="text-orange-400" />
              <span>View Official Certificate</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
            <Sparkles size={20} /> Keep going
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

function getDeadlineStatus(isoString?: string | null): { label: string; isPast: boolean; isNear: boolean } {
  if (!isoString) return { label: 'No deadline', isPast: false, isNear: false };
  const deadline = new Date(isoString);
  if (isNaN(deadline.getTime())) return { label: 'No deadline', isPast: false, isNear: false };

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return { label: `Overdue (${formatDeadline(isoString)})`, isPast: true, isNear: false };
  }
  if (diffHours <= 24) {
    return { label: `Due today (${formatDeadline(isoString)})`, isPast: false, isNear: true };
  }
  if (diffHours <= 72) {
    return { label: `Due in ${Math.ceil(diffHours / 24)} days`, isPast: false, isNear: true };
  }
  return { label: `Due ${formatDeadline(isoString)}`, isPast: false, isNear: false };
}
