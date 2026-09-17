import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  enrollInCohort,
  formatFileSize,
  listAssignments,
  listAvailableCohorts,
  listMySubmissions,
  submitOrReplaceAssignment,
  type Assignment,
  type Cohort,
  type Submission,
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeAssignment || !file) return;

    if (file.size > 500 * 1024 * 1024) {
      setError('Files must be smaller than 500 MB.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const submittedUrl = await uploadSubmissionFile(userId, file);
      const existingSubmission = submissions.find((item) => item.assignment_id === activeAssignment.id);

      // Resubmission replacement behavior: Replaces file_url, resets status to 'pending'
      await submitOrReplaceAssignment(userId, activeAssignment.id, submittedUrl, existingSubmission?.id);

      setSuccess(
        isResubmitting
          ? 'Revised submission uploaded successfully! Awaiting mentor review.'
          : 'Assignment submitted successfully!'
      );
      setActiveAssignment(null);
      setFile(null);
      setIsResubmitting(false);
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
            />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-sm text-slate-400">No assignments have been published for this cohort yet.</Card>
      )}

      {/* Submission / Resubmission Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-5 backdrop-blur-sm">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-500">
                  {isResubmitting ? 'Replace / Resubmit Assignment' : 'Submit Assignment'}
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

            {/* File Upload Form */}
            <label className="mt-5 block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Upload your video, project file, document, or PDF
              </span>
              <input
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
                accept="video/*,image/*,application/pdf,.doc,.docx,.txt,.rtf,.zip,.rar,.7z,.prproj,.drp,.fcpxml,.aep,.psd"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-normal outline-none focus:border-orange-400"
              />
              <span className="mt-1.5 block text-[11px] text-slate-400">
                Supports video edits (.mp4, .mov), project files (.prproj, .drp, .fcpxml, .aep), ZIPs, and PDFs (Max 500 MB).
              </span>
            </label>

            {file && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <span className="font-bold">Ready to upload:</span> {file.name} ({formatFileSize(file.size)})
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setActiveAssignment(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? 'Uploading & Submitting...' : isResubmitting ? 'Resubmit & Replace' : 'Upload & Submit'}
              </Button>
            </div>
          </form>
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
}: {
  assignment: Assignment;
  submission?: Submission;
  onSubmit: () => void;
  onResubmit: () => void;
}) {
  const status = submission?.status;
  const deadlineStatus = getDeadlineStatus(assignment.deadline);

  return (
    <Card className="flex flex-col justify-between p-5 transition hover:border-slate-300">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">Assignment</p>
            <h3 className="mt-1 text-base font-black text-slate-950">{assignment.title}</h3>
          </div>
          {status === 'reviewed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <Check size={13} /> Reviewed
            </span>
          ) : status === 'resubmit' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              <RotateCcw size={13} /> Revision Needed
            </span>
          ) : status === 'pending' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              <Clock size={13} /> Under Review
            </span>
          ) : null}
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
                ? 'border border-amber-200 bg-amber-50 text-amber-900'
                : status === 'reviewed'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>
                {status === 'resubmit'
                  ? 'Mentor Revision Requested'
                  : status === 'reviewed'
                  ? 'Reviewed & Passed'
                  : 'Submission Received'}
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

            {submission.feedback && (
              <p className="mt-2 text-xs leading-relaxed">
                <strong>Mentor Notes:</strong> {submission.feedback}
              </p>
            )}
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
}: {
  progressPercent: number;
  completedCount: number;
  totalLessons: number;
}) {
  const complete = progressPercent === 100;
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
              ? 'Your certificate and portfolio review are ready for the next step.'
              : `${completedCount} of ${totalLessons} lessons complete. Keep the streak alive.`}
          </p>
        </div>
        {complete ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-600 shadow-sm">
            <Check size={17} /> Certificate unlocked
          </div>
        ) : (
          <div className="flex items-center gap-2 text-orange-600">
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
