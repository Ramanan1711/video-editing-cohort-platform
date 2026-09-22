import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageSquare,
  Search,
  Send,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TableSkeleton } from '../components/ui/Skeletons';
import { StateFallback } from '../components/ui/StateFallback';
import { getSecureSubmissionUrl } from '../lib/courseService';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { parseDatabaseError, type AppError } from '../lib/errorHandling';
import {
  getMentorAssignedCohorts,
  listDetailedMentorSubmissions,
  listMentorStudents,
  sendMentorMessage,
  type DetailedMentorSubmission,
  type MentorStudentProgress,
} from '../lib/mentorService';

export function MentorStudents() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<MentorStudentProgress[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'attention' | 'on_track' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected student detail slide-over
  const [selectedStudent, setSelectedStudent] = useState<MentorStudentProgress | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<DetailedMentorSubmission[]>([]);
  const [loadingDossier, setLoadingDossier] = useState(false);

  // Message modal
  const [messageStudent, setMessageStudent] = useState<MentorStudentProgress | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const isMentorOrAdmin = profile?.role === 'mentor' || profile?.role === 'admin';

  const handleOpenAsset = async (e: React.MouseEvent, rawUrl: string) => {
    e.preventDefault();
    const secureUrl = await getSecureSubmissionUrl(rawUrl);
    window.open(secureUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!user || !isMentorOrAdmin) return;
    const userId = user.id;
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const assignedCohorts = await getMentorAssignedCohorts(userId, profile?.role || 'mentor');
        if (!active) return;
        setCohorts(assignedCohorts);

        const cohortIds = assignedCohorts.map((c) => c.id);
        const studentList = await listMentorStudents(cohortIds.length ? cohortIds : undefined);
        if (!active) return;
        setStudents(studentList);
        setError(null);
        setAppError(null);
      } catch (err) {
        if (active) {
          const parsed = parseDatabaseError(err);
          setAppError(parsed);
          setError(parsed.message);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRetrying(false);
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [user, profile, isMentorOrAdmin, reloadTrigger]);

  const handleRetry = () => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesCohort = selectedCohort === 'all' || s.cohort_id === selectedCohort;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.student_name.toLowerCase().includes(q) ||
        s.student_email.toLowerCase().includes(q) ||
        s.cohort_name.toLowerCase().includes(q);

      let matchesFilter = true;
      if (filterMode === 'attention') matchesFilter = s.needs_attention;
      else if (filterMode === 'on_track') matchesFilter = !s.needs_attention && s.progress_pct < 100;
      else if (filterMode === 'completed') matchesFilter = s.progress_pct === 100;

      return matchesCohort && matchesSearch && matchesFilter;
    });
  }, [students, selectedCohort, searchQuery, filterMode]);

  // Open Dossier
  const handleOpenDossier = async (student: MentorStudentProgress) => {
    setSelectedStudent(student);
    setLoadingDossier(true);
    try {
      const allSubs = await listDetailedMentorSubmissions([student.cohort_id]);
      const forStudent = allSubs.filter((s) => s.student_id === student.student_id);
      setStudentSubmissions(forStudent);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDossier(false);
    }
  };

  // Send Direct Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageStudent || !messageBody.trim()) return;

    try {
      setSendingMessage(true);
      await sendMentorMessage(
        messageStudent.student_id,
        messageBody.trim(),
        messageStudent.cohort_id
      );
      const msg = `Direct note sent to ${messageStudent.student_name}.`;
      setSuccess(msg);
      toast.success(msg);
      setMessageStudent(null);
      setMessageBody('');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Failed to send note');
    } finally {
      setSendingMessage(false);
    }
  };

  if (!isMentorOrAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
        <Card className="max-w-md p-8">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
          <h2 className="text-xl font-black text-slate-950">Mentor Clearance Required</h2>
          <p className="mt-2 text-xs text-slate-500">
            Student progress tracking is restricted to cohort mentors and administrators.
          </p>
        </Card>
      </div>
    );
  }

  const attentionCount = students.filter((s) => s.needs_attention).length;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="pl-12 sm:pl-14 lg:pl-0">
              <div className="flex items-center gap-2">
                <Link
                  to="/mentor"
                  className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  <ArrowLeft size={14} />
                </Link>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Student Intelligence</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Student Progress Directory</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Track lesson completions, review submission history, inspect resubmission rates, and reach out directly.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/mentor">
                <Button variant="secondary" size="sm">
                  Mentor Dashboard
                </Button>
              </Link>
              <Link to="/review/submissions">
                <Button size="sm">
                  <Video size={14} /> Review Queue
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

        {/* Filters and Search Bar */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-slate-950 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setFilterMode('attention')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterMode === 'attention'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Requires Attention ({attentionCount})
            </button>
            <button
              onClick={() => setFilterMode('on_track')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterMode === 'on_track'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              On Track
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterMode === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Completed
            </button>
          </div>

          <div className="flex items-center gap-3">
            {cohorts.length > 1 && (
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-orange-400"
              >
                <option value="all">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search students or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-none placeholder:text-slate-400 focus:border-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Directory Content */}
        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : appError && !students.length ? (
          <StateFallback
            appError={appError}
            actionText="Retry Student Roster"
            onAction={handleRetry}
            isRetrying={retrying}
          />
        ) : filteredStudents.length ? (
          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <Card
                key={`${student.cohort_id}-${student.student_id}`}
                className="p-5 transition hover:border-slate-300"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-black text-orange-700">
                      {student.student_name[0] || 'S'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{student.student_name}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {student.cohort_name}
                        </span>
                        {student.needs_attention && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <AlertCircle size={10} /> Needs Attention
                          </span>
                        )}
                        {student.progress_pct === 100 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 size={10} /> Graduated
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{student.student_email}</p>

                      {student.attention_reasons.length > 0 && (
                        <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                          Note: {student.attention_reasons.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    {/* Progress Bar */}
                    <div className="w-36">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600">Curriculum</span>
                        <span className="font-black text-slate-950">{student.progress_pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            student.progress_pct === 100 ? 'bg-emerald-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${student.progress_pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {student.completed_lessons} of {student.total_lessons} lessons
                      </p>
                    </div>

                    {/* Submissions & Revisions */}
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-950">
                        {student.passed_count} / {student.total_assignments} Passed
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {student.resubmission_count > 0 ? (
                          <span className="text-orange-600 font-bold">{student.resubmission_count} revisions</span>
                        ) : (
                          '0 revisions'
                        )}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setMessageStudent(student)}
                        title="Send encouragement or note"
                      >
                        <MessageSquare size={13} />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenDossier(student)}
                      >
                        View Dossier →
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <StateFallback
            type="empty"
            title="No students found"
            description="No students match the current filter or search criteria. Try adjusting your filters or resetting search terms."
            actionText="Reset Filters"
            onAction={() => {
              setFilterMode('all');
              setSelectedCohort('all');
              setSearchQuery('');
            }}
          />
        )}
      </main>

      {/* Student Dossier Slide-Over / Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-7 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-base font-black text-orange-700">
                  {selectedStudent.student_name[0] || 'S'}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">{selectedStudent.student_name}</h2>
                  <p className="text-xs text-slate-400">
                    {selectedStudent.student_email} · {selectedStudent.cohort_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 text-center text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Curriculum</p>
                <p className="mt-0.5 text-base font-black text-slate-950">{selectedStudent.progress_pct}%</p>
                <p className="text-[10px] text-slate-500">{selectedStudent.completed_lessons} lessons done</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Submissions</p>
                <p className="mt-0.5 text-base font-black text-slate-950">{selectedStudent.submissions_count}</p>
                <p className="text-[10px] text-slate-500">{selectedStudent.passed_count} passed</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Revisions</p>
                <p className="mt-0.5 text-base font-black text-orange-600">
                  {selectedStudent.resubmission_count}
                </p>
                <p className="text-[10px] text-slate-500">Requested to date</p>
              </div>
            </div>

            {/* Submission & Feedback History */}
            <div className="mt-6">
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider">
                Submission &amp; Critique History
              </h3>

              <div className="mt-3 space-y-3">
                {loadingDossier ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading submission records...</p>
                ) : studentSubmissions.length ? (
                  studentSubmissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-slate-100 bg-white p-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-slate-950">{sub.assignment_title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Submitted {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        {sub.status === 'reviewed' ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Approved
                          </span>
                        ) : sub.status === 'resubmit' ? (
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                            Revision Requested
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            Pending Review
                          </span>
                        )}
                      </div>

                      {/* File Link */}
                      <div className="mt-2.5">
                        <a
                          href={sub.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => void handleOpenAsset(e, sub.file_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700"
                        >
                          View submitted asset <ExternalLink size={11} />
                        </a>
                      </div>

                      {/* Feedback Notes */}
                      {sub.detailed_feedback_history && sub.detailed_feedback_history.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-2.5 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Mentor Critiques ({sub.detailed_feedback_history.length})
                          </p>
                          {sub.detailed_feedback_history.map((fb) => (
                            <div key={fb.id} className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                              <p className="whitespace-pre-wrap">{fb.comments}</p>
                              <span className="mt-1 block text-[10px] text-slate-400">
                                {new Date(fb.created_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">No submissions uploaded yet.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMessageStudent(selectedStudent);
                  setSelectedStudent(null);
                }}
              >
                <Mail size={13} /> Send Direct Note
              </Button>
              <Button size="sm" onClick={() => setSelectedStudent(null)}>
                Close Dossier
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Direct Message Modal */}
      {messageStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-950">Message {messageStudent.student_name}</h2>
              <button onClick={() => setMessageStudent(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Message / Encouragement</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Hey, noticed you've been working on the rough cut. Let me know if you need help with the pacing..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setMessageStudent(null)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={sendingMessage}>
                  <Send size={13} /> Send Note
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
