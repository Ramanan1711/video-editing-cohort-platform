import { useEffect, useState } from 'react';
import { Check, ExternalLink, LoaderCircle, Play, Send, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  enrollInCohort,
  listAssignments,
  listAvailableCohorts,
  listMySubmissions,
  submitAssignment,
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
      .then((data) => {
        if (active) setCohorts(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load cohorts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
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
        Join an active cohort to unlock its roadmap, lessons, challenges, and mentor review room.
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
                selectedId === cohort.id
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200 hover:border-orange-200'
              }`}
            >
              <span>
                <strong className="block text-sm text-slate-950">{cohort.name}</strong>
                <span className="mt-1 block text-sm text-slate-500">
                  {cohort.description || 'A focused learning cohort.'}
                </span>
              </span>
              {selectedId === cohort.id && <Check className="text-orange-600" size={19} />}
            </button>
          ))}
          <Button onClick={() => void enroll()} loading={saving} disabled={!selectedId} className="mt-3">
            {saving ? 'Joining cohort' : 'Enroll in cohort'}
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
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [nextAssignments, nextSubmissions] = await Promise.all([
      listAssignments(cohortId),
      listMySubmissions(userId),
    ]);
    setAssignments(nextAssignments);
    setSubmissions(nextSubmissions);
  };

  useEffect(() => {
    let active = true;
    Promise.all([listAssignments(cohortId), listMySubmissions(userId)])
      .then(([nextAssignments, nextSubmissions]) => {
        if (!active) return;
        setAssignments(nextAssignments);
        setSubmissions(nextSubmissions);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load assignments.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
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
    try {
      const submittedUrl = await uploadSubmissionFile(userId, file);
      await submitAssignment(userId, activeAssignment.id, submittedUrl);
      setActiveAssignment(null);
      setFile(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">The proof loop</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Assignments & reviews</h2>
        </div>
        <span className="text-sm font-semibold text-slate-400">
          {submissions.filter((item) => item.status === 'reviewed').length} reviewed
        </span>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <LoaderCircle className="animate-spin text-orange-500" size={20} />
      ) : assignments.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              submission={submissions.find((item) => item.assignment_id === assignment.id)}
              onSubmit={() => setActiveAssignment(assignment)}
              onResubmit={() => {
                setActiveAssignment(assignment);
                setFile(null);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-sm text-slate-400">No assignments have been published for this cohort yet.</Card>
      )}

      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">Submit assignment</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">{activeAssignment.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{activeAssignment.instructions}</p>
            <label className="mt-6 block text-sm font-bold text-slate-700">
              Upload your video, document, PDF, image, or project file
              <input
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
                accept="video/*,image/*,application/pdf,.doc,.docx,.txt,.rtf,.zip,.rar,.prproj,.drp,.fcpxml"
                required
                className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"
              />
            </label>
            {file && <p className="mt-2 truncate text-xs text-slate-500">Selected: {file.name}</p>}
            <p className="mt-3 text-xs text-slate-400">Maximum file size: 500 MB.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setActiveAssignment(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                <Play size={15} /> Upload and submit
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
  onResubmit: (url: string) => void;
}) {
  const status = submission?.status;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-orange-500">Assignment</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">{assignment.title}</h3>
        </div>
        {status === 'reviewed' && <Check className="text-emerald-500" size={20} />}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {assignment.instructions || 'Complete the challenge and submit your edited video for mentor feedback.'}
      </p>

      {submission ? (
        <div
          className={`mt-5 rounded-xl p-3.5 text-sm ${
            status === 'resubmit'
              ? 'bg-amber-50 text-amber-800'
              : status === 'reviewed'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <strong className="block">
              {status === 'resubmit'
                ? 'Resubmit requested'
                : status === 'reviewed'
                ? 'Reviewed'
                : 'Pending mentor review'}
            </strong>
            {submission.file_url && (
              <a
                href={submission.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                Your file <ExternalLink size={12} />
              </a>
            )}
          </div>

          {submission.feedback && (
            <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-xs text-slate-800">
              <span className="font-bold">Mentor note:</span> {submission.feedback}
            </p>
          )}

          {status === 'resubmit' && (
            <button
              onClick={() => onResubmit(submission.file_url)}
              className="mt-3 block text-xs font-bold text-amber-900 underline hover:text-amber-950"
            >
              Submit revised file →
            </button>
          )}
        </div>
      ) : (
        <Button variant="secondary" className="mt-5" onClick={onSubmit}>
          <Send size={15} /> Submit edited video
        </Button>
      )}
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
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-600">
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