import {
  ExternalLink,
  Flame,
  Layers,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { getSecureAssetUrl } from '../../../lib/courseService';
import type { Cohort } from '../../../lib/courseService';
import { useAdminCourses } from '../context/useAdminCourses';

export function SprintTrackStudio({ cohort }: { cohort: Cohort }) {
  const {
    challengesByCohort,
    loadingChallengesCohortId,
    canManageCurriculum,
    openChallengeEditor,
    handleDeleteChallenge,
    setBulkImportTargetCohort,
    isMentor,
  } = useAdminCourses();

  const isMentorLocked = isMentor && cohort.status === 'published';

  if (loadingChallengesCohortId === cohort.id && !challengesByCohort[cohort.id]) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Sparkles className="mx-auto mb-2 animate-spin text-amber-500" size={24} />
        <p className="text-xs font-semibold">Loading daily sprint challenges...</p>
      </div>
    );
  }

  const challenges = challengesByCohort[cohort.id] || [];

  if (challenges.length > 0) {
    return (
      <div className="space-y-4">
        {isMentorLocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block mb-0.5">Published Cohort (Live) — Sprint Drills Locked</span>
              <p className="leading-relaxed">
                Modifications to daily tasks and starter assets on published cohorts require permission from Parent Super Admin (<span className="font-semibold underline">ajayramanan17@gmail.com</span>) or Child Super Admin (<span className="font-semibold underline">ajayramanan4444@gmail.com</span>).
              </p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs transition hover:border-slate-300 dark:hover:border-slate-700 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-950/40 text-xs font-black text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                D{challenge.day_number}
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{challenge.title}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      challenge.is_published === false
                        ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                    }`}
                  >
                    {challenge.is_published === false ? 'Draft' : 'Published'}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {challenge.track_type}
                  </span>
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                    {challenge.submission_type.replace('_', ' ')}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {challenge.deadline_hours}h deadline
                  </span>
                </div>
                {challenge.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{challenge.description}</p>
                )}
                {challenge.instructions && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic line-clamp-1">
                    Instructions: {challenge.instructions}
                  </p>
                )}
                {challenge.starter_files_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!challenge.starter_files_url) return;
                      try {
                        const url = await getSecureAssetUrl(challenge.starter_files_url);
                        window.open(url, '_blank');
                      } catch {
                        window.open(challenge.starter_files_url, '_blank');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    <ExternalLink size={11} /> Starter Files
                  </button>
                )}
              </div>
            </div>

            {canManageCurriculum && (
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                {isMentorLocked ? (
                  <span title="Modifications locked on published cohort" className="text-slate-300 dark:text-slate-600 p-1.5">
                    <Lock size={15} />
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => openChallengeEditor(cohort.id, challenge)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                      title="Edit Challenge"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => void handleDeleteChallenge(cohort.id, challenge.id, challenge.title)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                      title="Delete Challenge"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

  return (
    <div className="space-y-4">
      {isMentorLocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block mb-0.5">Published Cohort (Live) — Sprint Track Locked</span>
            <p className="leading-relaxed">
              Adding daily drills or bulk importing sprint tracks for published cohorts requires permission from Parent Super Admin or Child Super Admin.
            </p>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center">
        <Flame className="mx-auto mb-2 text-amber-500" size={28} />
        <p className="text-sm font-bold text-slate-900 dark:text-white">No Daily Challenges Configured</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
          Sprint participants will need daily drills to build their portfolio and qualify for their completion certificate.
        </p>
        {canManageCurriculum && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {isMentorLocked ? (
              <Button
                variant="primary"
                size="sm"
                disabled
                className="opacity-60 cursor-not-allowed"
              >
                <Lock size={14} className="mr-1" /> Add Daily Challenge (Locked)
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openChallengeEditor(cohort.id)}
                >
                  <Plus size={14} className="mr-1" /> Add Daily Challenge
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBulkImportTargetCohort({ id: cohort.id, title: cohort.name });
                  }}
                >
                  <Layers size={14} className="mr-1" /> Bulk Import Sprint Track
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
