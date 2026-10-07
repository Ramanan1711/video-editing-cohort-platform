import { useState } from 'react';
import {
  Sparkles,
  Check,
  RotateCcw,
  Clock,
  FileText,
  AlertTriangle,
  Calendar,
  ExternalLink,
  History,
  MessageSquare,
  Send,
  X,
  Upload,
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import {
  type Assignment,
  type Submission,
  getSecureSubmissionUrl,
} from '../../../lib/courseService';

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

const handleOpenSecureSubmissionFile = async (e: React.MouseEvent, rawUrl: string) => {
  e.preventDefault();
  const secureUrl = await getSecureSubmissionUrl(rawUrl);
  window.open(secureUrl, '_blank', 'noopener,noreferrer');
};

export interface AssignmentSubmitCardProps {
  assignment: Assignment;
  submission?: Submission;
  onSubmit: () => void;
  onResubmit: () => void;
  onOpenVersions?: (submission: Submission) => void;
  onSendReply?: (feedbackId: string, message: string) => Promise<void>;
  onMarkFeedbackRead?: (feedbackId: string) => Promise<void> | void;
}

export function AssignmentSubmitCard({
  assignment,
  submission,
  onSubmit,
  onResubmit,
  onOpenVersions,
  onSendReply,
  onMarkFeedbackRead,
}: AssignmentSubmitCardProps) {
  const status = submission?.status;
  const deadlineStatus = getDeadlineStatus(assignment.deadline);
  const unreadCritiques = (submission?.feedback_history || []).filter((item) => !item.student_read_at);
  const hasUnread = unreadCritiques.length > 0;
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);

  const handleReplySubmit = async (feedbackId: string) => {
    const text = (replyDrafts[feedbackId] || '').trim();
    if (!text || !onSendReply) return;
    setReplySending(feedbackId);
    try {
      await onSendReply(feedbackId, text);
      if (onMarkFeedbackRead) {
        void onMarkFeedbackRead(feedbackId);
      }
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
            {hasUnread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 animate-pulse">
                <Sparkles size={11} className="text-orange-600" /> New Critique
              </span>
            )}

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
          {assignment.instructions || assignment.description || 'Complete the challenge and submit your edited video or project file for mentor review.'}
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
                onClick={(e) => void handleOpenSecureSubmissionFile(e, submission.file_url)}
                className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-600"
              >
                View submitted file <ExternalLink size={11} />
              </a>
            </div>

            {submission.notes && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                <span className="font-semibold text-slate-800">Your notes:</span> {submission.notes}
              </div>
            )}

            {/* Version History Button */}
            {onOpenVersions && (
              <button
                type="button"
                onClick={() => onOpenVersions(submission)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline"
              >
                <History size={12} /> Submission Version History (v{submission.version_number || submission.version || 1})
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          {item.mentor_name ? `Critique by ${item.mentor_name}` : `Critique #${idx + 1}`}
                        </span>
                        {!item.student_read_at && (
                          <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!item.student_read_at && onMarkFeedbackRead && (
                          <button
                            type="button"
                            onClick={() => void onMarkFeedbackRead(item.id)}
                            className="font-bold text-orange-600 hover:underline"
                          >
                            Mark Read
                          </button>
                        )}
                        <span>{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
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
                        {(item.replies || []).map((reply) => (
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

// Named alias for backward compatibility
export const AssignmentCard = AssignmentSubmitCard;
