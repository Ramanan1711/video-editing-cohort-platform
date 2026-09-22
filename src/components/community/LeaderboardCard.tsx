import React from 'react';
import { Trophy, Award, Sparkles, Gem, Shield } from 'lucide-react';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: string;
  badgeType: 'diamond' | 'shield' | 'flame';
}

interface LeaderboardCardProps {
  title?: string;
  subtitle?: string;
  entries?: LeaderboardEntry[];
  cohortTag?: string;
  className?: string;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'Shibin', points: '1.2K CRAFT', badgeType: 'diamond' },
  { rank: 2, name: 'Thilak', points: '1K CRAFT', badgeType: 'diamond' },
  { rank: 3, name: 'Meshak', points: '767 CRAFT', badgeType: 'shield' },
];

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  title = 'TOP 3 LEADERBOARD',
  entries = DEFAULT_LEADERBOARD,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-stone-950 via-black to-zinc-950 p-6 text-white shadow-2xl border border-amber-500/20 ${className}`}
    >
      {/* Decorative Golden Ambient Glows */}
      <div className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 size-56 rounded-full bg-orange-600/15 blur-3xl" />

      {/* Floating Graphic Coins (SVG / CSS) */}
      <div className="pointer-events-none absolute top-4 left-6 flex size-14 items-center justify-center rounded-full border border-amber-400/40 bg-gradient-to-tr from-amber-600/30 to-yellow-400/20 shadow-lg shadow-amber-500/10 -rotate-12 backdrop-blur-xs">
        <span className="text-xs font-black tracking-widest text-amber-300">CUT</span>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-10 flex size-11 items-center justify-center rounded-full border border-amber-400/30 bg-gradient-to-tr from-amber-700/20 to-yellow-500/15 shadow-md rotate-12 backdrop-blur-xs">
        <span className="text-[10px] font-black text-amber-200">CRAFT</span>
      </div>

      {/* Center Header */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-[11px] font-black tracking-wider uppercase text-amber-400">
          <Sparkles size={12} className="text-amber-400" />
          <span>CUT / CRAFT</span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 drop-shadow-sm">
            {title}
          </h3>
          <Trophy size={20} className="text-amber-400 animate-pulse" />
        </div>
      </div>

      {/* Leaderboard Podiums / Row Items */}
      <div className="relative z-10 mt-6 grid gap-2.5 sm:max-w-md mx-auto">
        {entries.map((item) => {
          const isFirst = item.rank === 1;
          const isSecond = item.rank === 2;

          return (
            <div
              key={item.rank}
              className={`group flex items-center justify-between rounded-full px-4 py-2.5 transition-transform duration-200 hover:scale-[1.01] ${
                isFirst
                  ? 'border border-amber-400/40 bg-white/95 text-slate-950 shadow-lg shadow-amber-500/10'
                  : isSecond
                  ? 'border border-slate-300/30 bg-white/90 text-slate-950 shadow-md'
                  : 'border border-amber-900/30 bg-white/85 text-slate-950 shadow-sm'
              }`}
            >
              {/* Rank & User Info */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-black text-white ${
                    isFirst
                      ? 'bg-slate-900'
                      : isSecond
                      ? 'bg-slate-700'
                      : 'bg-slate-600'
                  }`}
                >
                  {item.rank}
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badgeType === 'diamond' ? (
                    <Gem size={14} className="text-blue-500 fill-blue-500" />
                  ) : (
                    <Shield size={14} className="text-red-500 fill-red-500" />
                  )}
                  <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                    {item.name}
                  </span>
                </div>
              </div>

              {/* Points Badge */}
              <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-2.5 py-0.5 text-[11px] font-black text-amber-950 shadow-2xs">
                <span>{item.points}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Mascot / Badge Illustration */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs font-bold text-amber-400/80 pr-2">
        <Award size={14} />
        <span>Weekly Capstone Evaluations</span>
      </div>
    </div>
  );
};

