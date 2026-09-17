import { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  FileArchive,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Video,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { detectResourceType, listPendingSubmissions, reviewSubmission, type Submission } from '../lib/courseService';
import { useAuth } from '../context/useAuth';

export function ReviewSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    listPendingSubmissions()
      .then((nextSubmissions) => active && setSubmissions(nextSubmissions))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Unable to load submissions.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const review = async (submission: Submission, status: 'reviewed' | 'resubmit') => {
    if (!user) return;
    setSavingId(submission.id);
    setError(null);
    try {
      await reviewSubmission(submission.id, user.id, status, feedback[submission.id] ?? '');
      setSubmissions((current) => current.filter((item) => item.id !== submission.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review submission.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Review room</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Student submissions</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review submitted video cuts, project files, or documents and leave constructive mentor feedback.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
        {error && <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <LoaderCircle className="animate-spin text-orange-500" size={20} />
        ) : submissions.length ? (
          <div className="space-y-5">
            {submissions.map((submission) => {
              const fileType = detectResourceType(submission.file_url);
              const isResubmission = Boolean(submission.feedback);

              return (
                <Card key={submission.id} className="p-6">
                  <div className="flex flex-col justify-between gap-5 md:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                          Pending Review
                        </span>
                        {isResubmission && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                            Resubmitted Revision
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
                          {fileType.replace('_', ' ')}
                        </span>
                      </div>

                      <h2 className="mt-2 text-xl font-black text-slate-950">Assignment submission</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Student ID: {submission.student_id} · Submitted {submission.created_at ? new Date(submission.created_at).toLocaleDateString() : 'Recently'}
                      </p>

                      <div className="mt-4 flex items-center gap-2">
                        {getSubmissionFileIcon(fileType)}
                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700"
                        >
                          Download &amp; inspect student file <ExternalLink size={15} />
                        </a>
                      </div>

                      {submission.feedback && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          <strong className="block font-bold text-slate-800">Previous Mentor Feedback:</strong>
                          {submission.feedback}
                        </div>
                      )}
                    </div>

                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <MessageSquare size={21} />
                    </div>
                  </div>

                  <label className="mt-6 block text-left text-sm font-bold text-slate-700">
                    Mentor Feedback &amp; Action Items
                    <textarea
                      value={feedback[submission.id] ?? ''}
                      onChange={(event) =>
                        setFeedback((current) => ({ ...current, [submission.id]: event.target.value }))
                      }
                      rows={3}
                      placeholder="Tell the student what works, what to adjust in their timeline or pacing, and next steps..."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-orange-400"
                    />
                  </label>

                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => void review(submission, 'resubmit')}
                      loading={savingId === submission.id}
                    >
                      <RotateCcw size={15} /> Request Revision (Resubmit)
                    </Button>
                    <Button onClick={() => void review(submission, 'reviewed')} loading={savingId === submission.id}>
                      <Check size={15} /> Approve &amp; Mark Reviewed
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Check className="mx-auto text-emerald-500" size={32} />
            <h2 className="mt-4 text-xl font-black text-slate-950">Review queue is clear.</h2>
            <p className="mt-2 text-sm text-slate-500">New student submissions will appear here for mentor evaluation.</p>
          </Card>
        )}
      </main>
    </div>
  );
}

function getSubmissionFileIcon(type: string) {
  switch (type) {
    case 'video':
      return <Video size={17} className="text-emerald-500" />;
    case 'project_file':
      return <FileArchive size={17} className="text-orange-500" />;
    case 'pdf':
      return <FileText size={17} className="text-red-500" />;
    case 'document':
      return <FileText size={17} className="text-blue-500" />;
    case 'image':
      return <ImageIcon size={17} className="text-purple-500" />;
    default:
      return <FileText size={17} className="text-slate-400" />;
  }
}
