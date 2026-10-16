import {
  ExternalLink,
  Flame,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Cohort } from '../../../lib/courseService';
import { useAdminCourses } from '../context/useAdminCourses';

export function CourseChallengesTab({ cohort }: { cohort: Cohort }) {
  const {
    courseChallengesByCohort,
    loadingCourseChallengesCohortId,
    canManageCurriculum,
    setUploadModalCohortId,
    setShowUploadChallengeModal,
    handleDeleteCourseChallenge,
  } = useAdminCourses();

  if (loadingCourseChallengesCohortId === cohort.id && !courseChallengesByCohort[cohort.id]) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Sparkles className="mx-auto mb-2 animate-spin text-amber-500" size={24} />
        <p className="text-xs font-semibold">Loading course challenges &amp; projects...</p>
      </div>
    );
  }

  const challenges = courseChallengesByCohort[cohort.id] || [];

  if (challenges.length > 0) {
    return (
      <div className="space-y-3">
        {challenges.map((ch) => (
          <div
            key={ch.id}
            className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs transition hover:border-slate-300 dark:hover:border-slate-700 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3.5">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black border ${
                  ch.type === 'PROJECT'
                    ? 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                    : 'bg-blue-500/10 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                }`}
              >
                {ch.type === 'PROJECT' ? 'PRJ' : 'TSK'}
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{ch.title}</h4>
                  <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    {ch.week}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {ch.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      ch.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                        : ch.status === 'upcoming'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ch.status}
                  </span>
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                    +{ch.proReward} PRO
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {ch.durationLabel}
                  </span>
                </div>
                {ch.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{ch.description}</p>
                )}
                {ch.assets && ch.assets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ch.assets.map((asset, aIdx) => (
                      <a
                        key={aIdx}
                        href={asset.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Paperclip size={11} className="text-orange-500" />
                        <span>
                          {asset.title} ({asset.size})
                        </span>
                        <ExternalLink size={10} className="text-slate-400" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {canManageCurriculum && (
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                <button
                  onClick={() => void handleDeleteCourseChallenge(cohort.id, ch.id, ch.title)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                  title="Delete Course Challenge"
                  aria-label="Delete Course Challenge"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center">
      <Flame className="mx-auto mb-2 text-amber-500" size={28} />
      <p className="text-sm font-bold text-slate-900 dark:text-white">No Course Challenges Configured Yet</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
        Upload course-specific projects, briefs, starter footage assets, and assign PRO points rewards for students in this course.
      </p>
      {canManageCurriculum && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setUploadModalCohortId(cohort.id);
              setShowUploadChallengeModal(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
          >
            <Upload size={14} className="mr-1" /> Upload Challenge for {cohort.name}
          </Button>
        </div>
      )}
    </div>
  );
}
