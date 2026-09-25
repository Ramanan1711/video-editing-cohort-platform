import { useState, useMemo } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  Flame,
  FolderGit2,
  Lock,
  MessageSquare,
  Play,
  RotateCw,
  Send,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../../context/useToast';
import {
  submitDailyChallenge,
  type InternshipDayStatus,
} from '../../lib/internshipService';
import { generateWhatsAppClickToChatUrl } from '../../lib/whatsappService';

interface SprintChallengeTrackerProps {
  cohortId: string;
  cohortName: string;
  userId: string;
  studentName: string;
  sprintDays: InternshipDayStatus[];
  completedCount: number;
  streakCount: number;
  overallScore: number;
  onRefresh: () => void;
  mentorPhone?: string;
}

export function SprintChallengeTracker({
  cohortId: _cohortId,
  cohortName,
  userId,
  studentName,
  sprintDays,
  completedCount,
  streakCount,
  overallScore,
  onRefresh,
  mentorPhone = '919876543210',
}: SprintChallengeTrackerProps) {
  const toast = useToast();
  const [selectedDay, setSelectedDay] = useState<InternshipDayStatus | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activePhaseFilter, setActivePhaseFilter] = useState<'all' | 'phase1' | 'phase2' | 'phase3'>('all');

  const progressPercent = Math.min(100, Math.round((completedCount / 15) * 100));

  const filteredDays = useMemo(() => {
    if (activePhaseFilter === 'phase1') return sprintDays.filter((d) => d.dayNumber <= 5);
    if (activePhaseFilter === 'phase2') return sprintDays.filter((d) => d.dayNumber > 5 && d.dayNumber <= 10);
    if (activePhaseFilter === 'phase3') return sprintDays.filter((d) => d.dayNumber > 10);
    return sprintDays;
  }, [sprintDays, activePhaseFilter]);

  const handleOpenDay = (day: InternshipDayStatus) => {
    setSelectedDay(day);
    if (day.submission) {
      setSubmissionUrl(day.submission.submission_url || '');
      setNotes(day.submission.notes || '');
    } else {
      setSubmissionUrl('');
      setNotes('');
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay || !selectedDay.challenge) return;
    if (!submissionUrl.trim()) {
      toast.error('Please provide a valid GitHub PR, Loom, or Drive URL for your submission.');
      return;
    }

    try {
      setSubmitting(true);
      await submitDailyChallenge(
        userId,
        selectedDay.challenge.id,
        submissionUrl.trim(),
        notes.trim()
      );
      toast.success(`Day ${selectedDay.dayNumber} challenge submitted! Your mentor will review it shortly.`);
      setSelectedDay(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit challenge';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: InternshipDayStatus['status']) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Accepted
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
            <Clock size={12} className="text-amber-600 animate-spin" />
            In Review
          </span>
        );
      case 'resubmit':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-orange-800 dark:text-orange-300">
            <AlertCircle size={12} className="text-orange-600" />
            Revisions
          </span>
        );
      case 'todo':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-800 dark:text-blue-300">
            <Play size={12} className="text-blue-600" />
            Active
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-500">
            <Lock size={12} className="text-slate-400" />
            Locked
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 15-Day Sprint Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
                15-Day Production Sprint
              </span>
              <span className="rounded-full bg-amber-300/30 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-100 backdrop-blur-sm">
                {cohortName || 'Intensive Cohort'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Ship Daily Tasks. Earn Your Verified Credential.
            </h2>
            <p className="text-xs sm:text-sm text-orange-100 max-w-2xl leading-relaxed">
              Every day unlocks a hands-on production challenge with strict 24-hour turnaround. Complete all 15 tasks to pass mentor peer review and receive your industry-ready Certificate of Completion.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Flame size={20} className="text-amber-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-200">Current Streak</p>
                <p className="text-lg font-black text-white">{streakCount} Days 🔥</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Award size={20} className="text-amber-200" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-200">Completed</p>
                <p className="text-lg font-black text-white">{completedCount} / 15</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Sparkles size={20} className="text-amber-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-200">Mentor Rating</p>
                <p className="text-lg font-black text-white">{overallScore}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-orange-100">
            <span>Sprint Progress ({progressPercent}%)</span>
            <span>{15 - completedCount} days remaining</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/20 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-white transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phase Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActivePhaseFilter('all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'all'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            All 15 Days
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase1')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase1'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 1: Foundations (Days 1–5)
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase2')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase2'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 2: Core Execution (Days 6–10)
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase3')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase3'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 3: Capstone &amp; Review (Days 11–15)
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <RotateCw size={13} />
          <span>Refresh Tasks</span>
        </button>
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDays.map((day) => {
          const isSelected = selectedDay?.dayNumber === day.dayNumber;
          const isDone = day.status === 'accepted';
          const isReview = day.status === 'pending';
          const isLocked = day.status === 'locked';

          return (
            <Card
              key={day.dayNumber}
              className={`relative overflow-hidden p-5 transition cursor-pointer hover:shadow-md border ${
                isSelected
                  ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/20 dark:bg-orange-950/20'
                  : isDone
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900'
                  : isReview
                  ? 'border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900'
                  : isLocked
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 opacity-75'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
              onClick={() => !isLocked && handleOpenDay(day)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-8 items-center justify-center rounded-xl text-xs font-black ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isReview
                        ? 'bg-amber-500 text-white'
                        : isLocked
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        : 'bg-orange-500 text-white'
                    }`}
                  >
                    {day.dayNumber.toString().padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Day {day.dayNumber} Sprint
                    </p>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                      {day.title.replace(/^Day \d+:\s*/, '')}
                    </h3>
                  </div>
                </div>

                {getStatusBadge(day.status)}
              </div>

              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {day.challenge?.description || 'Hands-on production task for real-world portfolio mastery.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-500 font-medium">
                  <Clock size={12} />
                  24h Deadline
                </span>

                {isLocked ? (
                  <span className="flex items-center gap-1 font-bold text-slate-400">
                    <Lock size={12} /> Unlock previous day
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDay(day);
                    }}
                    className="inline-flex items-center gap-1 font-black text-orange-600 hover:text-orange-700"
                  >
                    <span>{isDone ? 'Review Task' : isReview ? 'View Status' : 'Start Task'}</span>
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Challenge Detail & Submission Modal */}
      {selectedDay && selectedDay.challenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 text-[11px] font-black uppercase text-orange-700 dark:text-orange-400">
                    Day {selectedDay.dayNumber} Challenge
                  </span>
                  {getStatusBadge(selectedDay.status)}
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedDay.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              {/* Task Description & Briefing */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-orange-500" />
                  Challenge Briefing &amp; Deliverables
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedDay.challenge.description}
                </p>
                {selectedDay.challenge.instructions && (
                  <div className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Instructions: </span>
                    {selectedDay.challenge.instructions}
                  </div>
                )}
              </div>

              {/* Starter Assets / Code Repo if available */}
              {selectedDay.challenge.starter_files_url && (
                <div className="flex items-center justify-between rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <FolderGit2 size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                        Starter Assets &amp; Templates
                      </p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-400">
                        Download raw media clips, project configs, or repository boilerplate.
                      </p>
                    </div>
                  </div>
                  <a
                    href={selectedDay.challenge.starter_files_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <span>Download</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Mentor Feedback Critique Banner if graded */}
              {selectedDay.submission?.mentor_feedback && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Mentor Review &amp; Critique
                    </h4>
                    {selectedDay.submission.score !== null && (
                      <span className="rounded-full bg-emerald-200 dark:bg-emerald-800 px-2.5 py-0.5 text-xs font-black text-emerald-900 dark:text-emerald-100">
                        Score: {selectedDay.submission.score}/100
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 italic">
                    "{selectedDay.submission.mentor_feedback}"
                  </p>
                </div>
              )}

              {/* Submission Form */}
              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deliverable URL (GitHub PR / Google Drive Cut / Loom Walkthrough) *
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      required
                      placeholder="https://github.com/... or https://drive.google.com/... or https://loom.com/..."
                      value={submissionUrl}
                      onChange={(e) => setSubmissionUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-3 pr-10 text-xs text-slate-900 dark:text-white shadow-2xs outline-none focus:border-orange-500"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400">
                      {submissionUrl.includes('github') ? (
                        <Code2 size={15} />
                      ) : submissionUrl.includes('loom') ? (
                        <Video size={15} />
                      ) : (
                        <ExternalLink size={15} />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Submission Notes &amp; Implementation Reflection (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe how you approached the challenge, key techniques applied, or any roadblocks encountered..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white shadow-2xs outline-none focus:border-orange-500"
                  />
                </div>

                {/* WhatsApp Quick Help with Mentor */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={15} className="text-emerald-500" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Stuck on this task?
                    </span>
                  </div>
                  <a
                    href={generateWhatsAppClickToChatUrl(
                      mentorPhone,
                      `Hi Mentor! I am ${studentName} from ${cohortName}. I am currently working on Day ${selectedDay.dayNumber}: ${selectedDay.title} and have a question regarding the challenge requirements.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>Ask Mentor on WhatsApp</span>
                    <ExternalLink size={11} />
                  </a>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedDay(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      'Submitting...'
                    ) : (
                      <>
                        <Send size={14} />
                        {selectedDay.submission ? 'Update Submission' : 'Submit Challenge'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
