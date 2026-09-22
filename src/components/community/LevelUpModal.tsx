import React from 'react';
import { X, Flame, Star, Award, Zap } from 'lucide-react';
import { LeaderboardCard } from './LeaderboardCard';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-950 p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">Level Up &amp; Mastery</h3>
              <p className="text-[11px] text-slate-400">Gamified cohort XP, ranks, and capstones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current User Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
              <Flame size={15} />
              <span className="text-[10px] font-black uppercase">Streak</span>
            </div>
            <p className="text-lg font-black">14 Days</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
              <Star size={15} />
              <span className="text-[10px] font-black uppercase">PRO XP</span>
            </div>
            <p className="text-lg font-black">940 XP</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
              <Award size={15} />
              <span className="text-[10px] font-black uppercase">Badge</span>
            </div>
            <p className="text-lg font-black">Top 5%</p>
          </div>
        </div>

        {/* Top 3 Graphic Card Embed */}
        <div className="mt-4">
          <LeaderboardCard title="LIVE BATCH 15 LEADERBOARD" />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
