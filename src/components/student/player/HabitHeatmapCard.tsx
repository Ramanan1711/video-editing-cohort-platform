import { Flame, Shield, Zap } from 'lucide-react';
import type { GamificationProfile } from '../../../lib/gamificationService';

export interface HabitHeatmapCardProps {
  gamification: GamificationProfile;
}

export function HabitHeatmapCard({ gamification }: HabitHeatmapCardProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-surface-elevated/40 backdrop-blur-xl p-4.5 sm:p-5 shadow-2xs dark:shadow-xl dark:shadow-black/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 shrink-0">
            <Flame size={18} />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              14-Day Editing Momentum &amp; Habit Activity
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Daily timeline drills reinforce muscle memory and editorial instinct.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <Zap size={14} className="text-amber-500" />
            <span>
              Momentum: {Math.min(100, Math.round((gamification.weeklyActiveCount / gamification.weeklyTarget) * 100))}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <Shield
              size={14}
              className={gamification.hasStreakShield ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}
            />
            <span className="text-[11px]">
              {gamification.hasStreakShield ? 'Streak Shield Ready' : 'Streak Shield Active'}
            </span>
          </div>
        </div>
      </div>

      {/* 14 Days Visual Heatmap Blocks */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
          {(gamification.recentHeatmap ?? []).map((day) => (
            <div
              key={day.dateStr}
              className="flex flex-col items-center gap-1 flex-1 min-w-[34px]"
              title={`${day.dateStr}: ${day.isActive ? 'Active session' : 'Rest day'}`}
            >
              <div
                className={`h-7 w-full rounded-lg border transition-all ${
                  day.isActive
                    ? 'bg-orange-500 border-orange-600 text-white shadow-2xs'
                    : day.isToday
                    ? 'bg-slate-100 dark:bg-slate-800 border-dashed border-orange-400'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-white/5'
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  day.isToday ? 'text-orange-600 dark:text-orange-400 font-black' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {day.dayLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

