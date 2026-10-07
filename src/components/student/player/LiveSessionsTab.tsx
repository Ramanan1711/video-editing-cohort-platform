import { Calendar, ExternalLink, Radio } from 'lucide-react';
import type { StudentLiveSession } from '../../../lib/courseService';

export interface LiveSessionsTabProps {
  liveSessions: StudentLiveSession[];
  nowTimestamp: number;
}

export function LiveSessionsTab({ liveSessions, nowTimestamp }: LiveSessionsTabProps) {
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
                  <a
                    href={session.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
                  >
                    <span>Join Video Room (Zoom / Meet)</span>
                    <ExternalLink size={13} />
                  </a>
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

