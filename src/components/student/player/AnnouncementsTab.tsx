import { Megaphone } from 'lucide-react';
import type { Cohort, StudentAnnouncement } from '../../../lib/courseService';

export interface AnnouncementsTabProps {
  announcements: StudentAnnouncement[];
  allCohorts: Cohort[];
}

export function AnnouncementsTab({ announcements, allCohorts }: AnnouncementsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Studio Dispatch</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Cohort Announcements</h2>
        </div>
      </div>

      {announcements.length ? (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    <Megaphone size={14} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-950">{announcement.title}</h3>
                      {announcement.cohort_id ? (
                        <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          {allCohorts.find((c) => c.id === announcement.cohort_id)?.name ||
                            allCohorts.find((c) => c.id === announcement.cohort_id)?.title ||
                            'Cohort Announcement'}
                        </span>
                      ) : (
                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Platform Broadcast
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {new Date(announcement.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                {announcement.body}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Megaphone size={28} className="mx-auto text-slate-300 mb-2" />
          <h3 className="text-sm font-black text-slate-900">No Announcements Yet</h3>
          <p className="mt-1 text-xs text-slate-500">
            Instructors and mentors will broadcast milestones, updates, and reminders here.
          </p>
        </div>
      )}
    </div>
  );
}

