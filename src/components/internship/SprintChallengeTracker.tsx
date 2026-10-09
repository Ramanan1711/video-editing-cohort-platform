import { useState, useMemo } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  FolderGit2,
  Lock,
  Play,
  RotateCw,
  Sparkles,
  X,
  FileCheck,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import {
  submitDailyChallenge,
  gradeDailyChallenge,
  getSecureChallengeSubmissionUrl,
  type InternshipDayStatus,
  type DailyChallengeSubmission,
} from '../../lib/internshipService';
import { getSecureAssetUrl } from '../../lib/courseService';
import { generateWhatsAppClickToChatUrl } from '../../lib/whatsappService';
import { DynamicChallengeSubmissionBox } from './DynamicChallengeSubmissionBox';

interface SprintChallengeTrackerProps {
  cohortId: string;
  cohortName: string;
  userId: string;
  studentName: string;
  sprintDays: InternshipDayStatus[];
  completedCount: number;
  totalDays?: number;
  streakCount: number;
  overallScore: number | null;
  onRefresh: () => void;
  mentorPhone?: string;
  isMentor?: boolean;
}

export function SprintChallengeTracker({
  cohortId: _cohortId,
  cohortName,
  userId,
  studentName,
  sprintDays,
  completedCount,
  totalDays,
  streakCount,
  overallScore,
  onRefresh,
  mentorPhone = '919876543210',
  isMentor = false,
}: SprintChallengeTrackerProps) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const isMentorUser = isMentor || profile?.role === 'mentor' || profile?.role === 'admin';

  const [selectedDay, setSelectedDay] = useState<InternshipDayStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activePhaseFilter, setActivePhaseFilter] = useState<'all' | 'phase1' | 'phase2' | 'phase3'>('all');

  // Secure deliverable inspection and mentor grading state
  const [isOpeningDeliverable, setIsOpeningDeliverable] = useState(false);
  const [isDownloadingStarter, setIsDownloadingStarter] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeScore, setGradeScore] = useState(90);
  const [gradeStatus, setGradeStatus] = useState<'accepted' | 'resubmit'>('accepted');
  const [gradeFeedback, setGradeFeedback] = useState('');

  const handleDownloadStarter = async (url: string) => {
    try {
      setIsDownloadingStarter(true);
      const secureUrl = await getSecureAssetUrl(url);
      window.open(secureUrl, '_blank');
    } catch {
      window.open(url, '_blank');
    } finally {
      setIsDownloadingStarter(false);
    }
  };

  // Optimistic submission state to prevent UI freezing and show instant progress
  const [optimisticDays, setOptimisticDays] = useState<
    Record<number, { submission: DailyChallengeSubmission; status: InternshipDayStatus['status'] }>
  >({});

  const effectiveTotalDays = totalDays || sprintDays.length || 15;

  const mergedSprintDays = useMemo(() => {
    return sprintDays.map((d) => {
      const opt = optimisticDays[d.dayNumber];
      if (opt) {
        return {
          ...d,
          status: opt.status,
          submission: opt.submission,
        };
      }
      return d;
    });
  }, [sprintDays, optimisticDays]);

  const p1End = Math.max(1, Math.floor(effectiveTotalDays / 3));
  const p2End = Math.max(p1End + 1, Math.floor((effectiveTotalDays * 2) / 3));

  const filteredDays = useMemo(() => {
    if (activePhaseFilter === 'phase1') return mergedSprintDays.filter((d) => d.dayNumber <= p1End);
    if (activePhaseFilter === 'phase2') return mergedSprintDays.filter((d) => d.dayNumber > p1End && d.dayNumber <= p2End);
    if (activePhaseFilter === 'phase3') return mergedSprintDays.filter((d) => d.dayNumber > p2End);
    return mergedSprintDays;
  }, [mergedSprintDays, activePhaseFilter, p1End, p2End]);

  const progressPercent = Math.min(100, Math.round((completedCount / effectiveTotalDays) * 100));

  const handleOpenDay = (day: InternshipDayStatus) => {
    setSelectedDay(day);
    if (day.submission) {
      setGradeScore(day.submission.score ?? 90);
      setGradeStatus(day.submission.status === 'resubmit' ? 'resubmit' : 'accepted');
      setGradeFeedback(day.submission.mentor_feedback ?? '');
    } else {
      setGradeScore(90);
      setGradeStatus('accepted');
      setGradeFeedback('');
    }
  };

  const handleOpenSecureDeliverable = async (rawUrl: string) => {
    try {
      setIsOpeningDeliverable(true);
      const secureUrl = await getSecureChallengeSubmissionUrl(rawUrl, 3600);
      window.open(secureUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate secure URL';
      toast.error(msg);
    } finally {
      setIsOpeningDeliverable(false);
    }
  };

  const handleGradeChallenge = async () => {
    if (!selectedDay?.submission || !user) return;
    try {
      setIsGrading(true);
      await gradeDailyChallenge(
        selectedDay.submission.id,
        gradeScore,
        gradeStatus,
        gradeFeedback.trim(),
        user.id
      );
      toast.success(`Day ${selectedDay.dayNumber} challenge graded as ${gradeStatus}!`);
      onRefresh();
      setSelectedDay(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to grade challenge';
      toast.error(msg);
    } finally {
      setIsGrading(false);
    }
  };

  const handleSubmitTask = async (data: {
    submissionUrl: string;
    notes: string;
  }) => {
    if (!selectedDay || !selectedDay.challenge) return;
    if (!data.submissionUrl.trim()) {
      toast.error('Please provide a valid deliverable file or URL for your submission.');
      return;
    }

    const dayNum = selectedDay.dayNumber;
    const challengeId = selectedDay.challenge.id;
    const dayTitle = selectedDay.title;

    // Optimistically update challenge day status to in-review / pending immediately
    const optimisticSub: DailyChallengeSubmission = {
      id: `opt-${Date.now()}`,
      challenge_id: challengeId,
      user_id: userId,
      submission_url: data.submissionUrl.trim(),
      notes: data.notes.trim() || null,
      status: 'pending',
      score: null,
      mentor_feedback: null,
      submitted_at: new Date().toISOString(),
    };

    setOptimisticDays((prev) => ({
      ...prev,
      [dayNum]: {
        submission: optimisticSub,
        status: 'pending',
      },
    }));

    try {
      setSubmitting(true);
      await submitDailyChallenge(
        userId,
        challengeId,
        data.submissionUrl.trim(),
        data.notes.trim()
      );

      // Pre-fill instant WhatsApp notification
      const waMsg = `Hi Mentor! I am ${studentName} from ${cohortName}. I have submitted Day ${dayNum}: ${dayTitle}.\nDeliverable: ${data.submissionUrl.trim()}\nNotes: ${data.notes.trim() || 'Ready for evaluation'}\nPlease review when convenient!`;
      generateWhatsAppClickToChatUrl(mentorPhone, waMsg);

      toast.success(
        `Day ${dayNum} challenge submitted! Your mentor has been queued for review.`
      );
      setSelectedDay(null);
      onRefresh();
    } catch (err: unknown) {
      // Revert optimistic state on failure
      setOptimisticDays((prev) => {
        const next = { ...prev };
        delete next[dayNum];
        return next;
      });
      const msg = err instanceof Error ? err.message : 'Failed to submit challenge';
      toast.error(`Submission failed: ${msg}`);
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

  if (sprintDays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200/50">
          <Flame size={28} />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          No sprint challenges published for this cohort yet.
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Your cohort mentors and instructors will publish the daily challenge syllabus once the sprint kicks off.
        </p>
        <button
          onClick={onRefresh}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-2xs"
        >
          <RotateCw size={14} />
          <span>Check for Published Tasks</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Sprint Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
                {effectiveTotalDays}-Day Production Sprint
              </span>
              <span className="rounded-full bg-amber-300/30 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-100 backdrop-blur-sm">
                {cohortName || 'Intensive Cohort'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Ship Daily Tasks. Earn Your Verified Credential.
            </h2>
            <p className="text-xs sm:text-sm text-orange-100 max-w-2xl leading-relaxed">
              Every day unlocks a hands-on production challenge with strict 24-hour turnaround. Complete all {effectiveTotalDays} tasks to pass mentor peer review and receive your industry-ready Certificate of Completion.
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
                <p className="text-lg font-black text-white">
                  {streakCount > 0 ? `${streakCount} Day${streakCount === 1 ? '' : 's'} 🔥` : '0 Days'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Award size={20} className="text-amber-200" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-200">Completed</p>
                <p className="text-lg font-black text-white">{completedCount} / {effectiveTotalDays}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white">
                <Sparkles size={20} className="text-amber-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-200">
                  {overallScore !== null ? 'Mentor Rating' : 'Rating Pending'}
                </p>
                <p className="text-lg font-black text-white">
                  {overallScore !== null ? `${overallScore}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-orange-100">
            <span>Sprint Progress ({progressPercent}%)</span>
            <span>{Math.max(0, effectiveTotalDays - completedCount)} days remaining</span>
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
            All {effectiveTotalDays} Days
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase1')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase1'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 1: Foundations (Days 1–{p1End})
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase2')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase2'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 2: Core Execution (Days {p1End + 1}–{p2End})
          </button>
          <button
            onClick={() => setActivePhaseFilter('phase3')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activePhaseFilter === 'phase3'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Phase 3: Capstone &amp; Review (Days {p2End + 1}–{effectiveTotalDays})
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
                      {(day.title || day.challenge?.title || `Day ${day.dayNumber} Challenge`).replace(/^Day \d+:\s*/, '')}
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
                  {selectedDay.title || selectedDay.challenge.title || `Day ${selectedDay.dayNumber} Challenge`}
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
                  <button
                    type="button"
                    disabled={isDownloadingStarter}
                    onClick={() => {
                      if (selectedDay?.challenge?.starter_files_url) {
                        void handleDownloadStarter(selectedDay.challenge.starter_files_url);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <span>{isDownloadingStarter ? 'Opening...' : 'Download'}</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              )}

              {/* Submitted Deliverable & Mentor Secure Inspection Card */}
              {selectedDay.submission && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 shrink-0">
                        <FileCheck size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs font-black text-slate-900 dark:text-white">
                            Submitted Deliverable
                          </h5>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                            <Lock size={9} />
                            Private Storage • Expiring Token (1h)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md mt-0.5">
                          {selectedDay.submission.submission_url}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSecureDeliverable(selectedDay.submission!.submission_url)}
                      disabled={isOpeningDeliverable}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 shadow-2xs transition shrink-0 disabled:opacity-50"
                    >
                      <span>{isOpeningDeliverable ? 'Generating Token...' : 'Inspect Deliverable'}</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>

                  {selectedDay.submission.notes && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Student Submission Notes: </span>
                      {selectedDay.submission.notes}
                    </div>
                  )}

                  {/* Instant WhatsApp Mentor Notification Button */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Need immediate feedback or clarification from your mentor?
                    </span>
                    <a
                      href={generateWhatsAppClickToChatUrl(
                        mentorPhone,
                        `Hi Mentor! I am ${studentName} from ${cohortName}. I have submitted Day ${selectedDay.dayNumber}: ${selectedDay.title}.\nDeliverable: ${selectedDay.submission.submission_url}\nPlease review when convenient!`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                    >
                      <MessageSquare size={13} className="text-emerald-500" />
                      <span>Instant WhatsApp Mentor Notification</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}

              {/* Mentor Challenge Evaluation & Grading Panel */}
              {isMentorUser && selectedDay.submission && (
                <div className="rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-orange-500" />
                      Mentor Challenge Evaluation &amp; Grade
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      Current Status: <strong className="uppercase text-orange-600">{selectedDay.submission.status}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="mentor-grade-score" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Score (0 - 100)
                      </label>
                      <input
                        id="mentor-grade-score"
                        type="number"
                        min="0"
                        max="100"
                        value={gradeScore}
                        onChange={(e) => setGradeScore(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="mentor-grade-status" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Outcome Decision
                      </label>
                      <select
                        id="mentor-grade-status"
                        value={gradeStatus}
                        onChange={(e) => setGradeStatus(e.target.value as 'accepted' | 'resubmit')}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500"
                      >
                        <option value="accepted">Accepted (Pass)</option>
                        <option value="resubmit">Request Revisions</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mentor-grade-feedback" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Critique &amp; Actionable Feedback
                    </label>
                    <textarea
                      id="mentor-grade-feedback"
                      rows={2}
                      value={gradeFeedback}
                      onChange={(e) => setGradeFeedback(e.target.value)}
                      placeholder="Provide frame-accurate comments, pacing suggestions, and technical guidance..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGradeChallenge}
                      disabled={isGrading}
                      className="rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition"
                    >
                      {isGrading ? 'Saving Grade...' : 'Save Mentor Evaluation'}
                    </button>
                  </div>
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

              {/* Dual-Mode Dynamic Challenge Submission Box */}
              <DynamicChallengeSubmissionBox
                userId={userId}
                challengeId={selectedDay.challenge.id}
                initialUrl={selectedDay.submission?.submission_url}
                initialNotes={selectedDay.submission?.notes}
                isExistingSubmission={!!selectedDay.submission}
                submitting={submitting}
                trackType={selectedDay.challenge.track_type}
                cohortName={cohortName}
                onSubmit={handleSubmitTask}
                onCancel={() => setSelectedDay(null)}
                mentorPhone={mentorPhone}
                studentName={studentName}
                dayTitle={selectedDay.title}
                dayNumber={selectedDay.dayNumber}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
