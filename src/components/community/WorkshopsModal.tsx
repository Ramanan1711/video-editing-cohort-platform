import React from 'react';
import { X, Video, Clock, ExternalLink } from 'lucide-react';

interface WorkshopsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkshopsModal: React.FC<WorkshopsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const workshops = [
    {
      id: 'w-1',
      title: 'Live Timeline Breakdown: Retention & Kinetic Typography',
      speaker: 'Shibin (Lead Editor)',
      date: 'This Wednesday, 7:00 PM IST',
      status: 'upcoming',
      link: 'https://meet.google.com',
    },
    {
      id: 'w-2',
      title: 'Sound Design Masterclass: Layering SFX & Atmos for 4K Commercials',
      speaker: 'Guest Colorist & Mixer',
      date: 'Saturday, 5:00 PM IST',
      status: 'upcoming',
      link: 'https://meet.google.com',
    },
    {
      id: 'w-3',
      title: 'Week 1 Critique Room: First Cut Roast & Fixes',
      speaker: 'Mentorship Team',
      date: 'Recorded',
      status: 'recorded',
      link: '#',
    },
  ];

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

        <div className="mt-4 space-y-3">
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
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{ws.date}</span>
                </div>

                <a
                  href={ws.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  <span>{ws.status === 'upcoming' ? 'Join Stream' : 'Watch Recording'}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>

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
