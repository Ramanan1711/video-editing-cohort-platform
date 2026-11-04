import { useState, useEffect } from 'react';
import { Calendar, ExternalLink, Radio, CheckCircle2, Loader2 } from 'lucide-react';
import type { StudentLiveSession } from '../../../lib/courseService';
import { checkInToSession, getStudentAttendanceHistory } from '../../../lib/attendanceService';
import { useToast } from '../../../context/useToast';

export interface LiveSessionsTabProps {
  liveSessions: StudentLiveSession[];
  nowTimestamp: number;
  userId?: string | null;
  onCheckIn?: (sessionId: string) => Promise<void> | void;
}

export function LiveSessionsTab({
  liveSessions,
  nowTimestamp,
  userId,
  onCheckIn,
}: LiveSessionsTabProps) {
  const toast = useToast();
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    void getStudentAttendanceHistory(userId).then((records) => {
      if (!isMounted) return;
      const attended = new Set(
        records
          .filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'excused')
          .map((r) => r.session_id)
      );
      setCheckedInIds(attended);
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleJoinSession = async (session: StudentLiveSession, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Pre-open new tab synchronously to guarantee no browser pop-up blocker issues
    let newTab: Window | null = null;
    if (session.meeting_url && typeof window !== 'undefined') {
      newTab = window.open('about:blank', '_blank');
    }

    setCheckingInId(session.id);
    try {
      if (onCheckIn) {
        await onCheckIn(session.id);
      } else {
        await checkInToSession(session.id);
      }
      setCheckedInIds((prev) => new Set([...prev, session.id]));
      toast?.success('Attendance checked in! Opening video room...');
    } catch (err) {
      console.error('Failed to register live session attendance:', err);
    } finally {
      setCheckingInId(null);
      if (session.meeting_url) {
        if (newTab && !newTab.closed && newTab.location) {
          try {
            newTab.location.href = session.meeting_url;
          } catch {
            window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
          }
        } else if (typeof window !== 'undefined') {
          window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
        }
      }
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Live Mentorship</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Cohort Live Review Sessions</h2>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {liveSessions.length} {liveSessions.length === 1 ? 'Session' : 'Sessions'} Scheduled
        </span>
      </div>

      {liveSessions.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {liveSessions.map((session) => {
            const dateObj = new Date(session.starts_at);
            const isUpcoming = dateObj.getTime() > nowTimestamp;

            return (
              <div
                key={session.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-orange-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                        isUpcoming
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Radio size={12} className={isUpcoming ? 'animate-pulse text-orange-600' : ''} />
                      {isUpcoming ? 'Upcoming Live Session' : 'Past Session'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {dateObj.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-black text-slate-950">{session.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {session.description || 'Live timeline review, critique room, and Q&A with mentors.'}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Calendar size={14} className="text-orange-500" />
                    <span>
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {checkedInIds.has(session.id) && (
                    <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>Attendance Verified for Certificate</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleJoinSession(session, e)}
                    disabled={checkingInId === session.id}
                    data-testid={`join-session-btn-${session.id}`}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                      checkedInIds.has(session.id)
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    {checkingInId === session.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white" />
                        <span>Recording Attendance &amp; Joining...</span>
                      </>
                    ) : checkedInIds.has(session.id) ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span>Rejoin Video Room (Zoom / Meet)</span>
                        <ExternalLink size={13} />
                      </>
                    ) : (
                      <>
                        <span>Join Video Room (Zoom / Meet)</span>
                        <ExternalLink size={13} />
                      </>
                    )}
                  </button>
                  <p className="mt-1.5 text-center text-[10px] text-slate-400">
                    {checkedInIds.has(session.id)
                      ? '✓ Attendance recorded toward 75% certificate requirement'
                      : 'Clicking to join automatically records your attendance for graduation'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Radio size={28} className="mx-auto text-slate-300 mb-2" />
          <h3 className="text-sm font-black text-slate-900">No Live Sessions Scheduled</h3>
          <p className="mt-1 text-xs text-slate-500">
            Check back soon! Mentors post weekly critique and Q&amp;A sessions here.
          </p>
        </div>
      )}
    </div>
  );
}

