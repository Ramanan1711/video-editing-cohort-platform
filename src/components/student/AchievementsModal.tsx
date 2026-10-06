import { Award, Flame, Layers, Lock, Sparkles, Trophy, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { GamificationProfile } from '../../lib/gamificationService';

export interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gamification: GamificationProfile;
}

export function AchievementsModal({
  isOpen,
  onClose,
  gamification,
}: AchievementsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-left">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Level {gamification.level}: {gamification.tierTitle}
              </h3>
              <p className="text-xs text-slate-500">
                Challenge progression milestones &amp; master editor achievements.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-950 mb-2">
            <span>XP Progression</span>
            <span>
              {gamification.totalXp} / {gamification.nextLevelXp || 'Max'} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
              style={{
                width: `${gamification.progressPercent}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              Next Rank:{' '}
              <strong>
                {gamification.level >= 5
                  ? 'Master Lead Editor (Max Level)'
                  : `Level ${gamification.level + 1} • ${gamification.nextTierTitle}`}
              </strong>
            </span>
            <span>
              {gamification.nextLevelXp && gamification.totalXp < gamification.nextLevelXp
                ? `${gamification.nextLevelXp - gamification.totalXp} XP to next level`
                : 'Max rank achieved!'}
            </span>
          </div>
        </div>

        {/* Milestone Badges Grid */}
        <div className="mt-6">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
            Milestone Badges ({gamification.badges.filter((b) => b.unlocked).length} of{' '}
            {gamification.badges.length} Unlocked)
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {gamification.badges.map((badge) => (
              <div
                key={badge.id}
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                  badge.unlocked
                    ? 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-white text-slate-900 shadow-2xs'
                    : 'border-slate-200 bg-slate-50/60 opacity-60'
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base ${
                    badge.unlocked ? 'bg-amber-100' : 'bg-slate-200'
                  }`}
                >
                  {badge.category === 'craft' ? (
                    <Award size={18} className="text-amber-600" />
                  ) : badge.category === 'consistency' ? (
                    <Flame size={18} className="text-orange-500" />
                  ) : badge.category === 'timeline' ? (
                    <Layers size={18} className="text-blue-500" />
                  ) : (
                    <Sparkles size={18} className="text-purple-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-xs font-bold text-slate-950 truncate">{badge.name}</h5>
                    {badge.unlocked ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800 uppercase">
                        Unlocked
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400">
                        <Lock size={9} /> Locked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AchievementsModal;
