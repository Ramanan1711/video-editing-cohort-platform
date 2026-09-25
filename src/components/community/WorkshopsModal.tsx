import { useState, useEffect } from 'react';
import { X, Video, Clock, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import {
  listStudentLiveSessions,
  type StudentLiveSession,
} from '../../lib/courseService';

interface WorkshopsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormattedWorkshop {
  id: string;
  title: string;
  speaker: string;
  date: string;
  status: 'upcoming' | 'recorded';
  link: string;
}

export const WorkshopsModal: React.FC<WorkshopsModalProps> = ({ isOpen, onClose }) => {
  const [workshops, setWorkshops] = useState<FormattedWorkshop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function loadSessions() {
      try {
        setLoading(true);
        const data: StudentLiveSession[] = await listStudentLiveSessions();
        if (!active) return;

        if (data && data.length > 0) {
          const now = Date.now();
          const mapped: FormattedWorkshop[] = data.map((s) => {
            const dateObj = new Date(s.starts_at);
            const isPast = dateObj.getTime() + 150 * 60 * 1000 < now;

            const dateStr = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            return {
              id: s.id,
              title: s.title,
              speaker: s.description || 'Cohort Lead Mentor',
              date: dateStr,
              status: isPast ? 'recorded' : 'upcoming',
              link: s.meeting_url || '#',
            };
          });
          setWorkshops(mapped);
        } else {
          setWorkshops([]);
        }
      } catch (err) {
        console.warn('Failed to load live sessions for modal:', err);
        setWorkshops([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSessions();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <Video size={17} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">Cohort Workshops</h3>
              <p className="text-[10px] text-slate-400">Live mentor sessions, guest critiques, and recordings</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 size={24} className="animate-spin text-orange-500 mb-2" />
            <p className="text-xs font-semibold">Loading live sessions...</p>
          </div>
        ) : workshops.length > 0 ? (
          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {workshops.map((ws) => (
              <div
                key={ws.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider mb-1 ${
                        ws.status === 'upcoming'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {ws.status}
                    </span>
                    <h4 className="text-xs font-bold text-slate-950 dark:text-white leading-snug">
                      {ws.title}
                    </h4>
                    {ws.speaker && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ws.speaker}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{ws.date}</span>
                  </div>

                  {ws.link && ws.link !== '#' ? (
                    <a
                      href={ws.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400"
                    >
                      <span>{ws.status === 'upcoming' ? 'Join Stream' : 'Watch Recording'}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-slate-400 text-[10px]">Link not available</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Calendar className="mx-auto size-9 text-slate-300 dark:text-slate-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No live sessions currently scheduled
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
              Live timeline critiques, Q&amp;As, and masterclasses will appear here once scheduled by your mentor.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
