import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Check,
  ChevronDown,
  Search,
  Sparkles,
  History,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

interface LevelUpViewProps {
  onClose?: () => void;
}

interface LeaderboardMember {
  rank: number;
  id: string;
  name: string;
  points: number;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

const DEFAULT_LEADERBOARD_MEMBERS: LeaderboardMember[] = [
  { rank: 1, id: 'mem-1', name: 'Bala murugan', points: 36190, avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 2, id: 'mem-2', name: 'Kamalesh K', points: 35525, avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 3, id: 'mem-3', name: 'Prasanth R', points: 23430, avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 4, id: 'mem-4', name: 'Santhoshkumar S', points: 19000, avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 5, id: 'mem-5', name: 'Manikandan Kumar', points: 16620, avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 6, id: 'mem-6', name: 'Deepak Saravanan', points: 15750, avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 7, id: 'mem-7', name: 'Kalaiselvan', points: 14830, avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 8, id: 'mem-8', name: 'Raghul Jadeja', points: 14235, avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 9, id: 'mem-9', name: 'Kavinraj G', points: 13965, avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 10, id: 'mem-10', name: 'Arun Prakash', points: 12400, avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 11, id: 'mem-11', name: 'Vigneshwaran M', points: 11850, avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80' },
  { rank: 12, id: 'mem-12', name: 'Siddharth N', points: 10250, avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&h=120&q=80' },
];

const PRO_HISTORY_TRANSACTIONS = [
  { id: 'tx-1', title: 'Daily Edit: 20 min habit completed', date: 'Today, 08:20 AM', points: '+10 PRO', type: 'habit' },
  { id: 'tx-2', title: 'Assignment 2: Rough Cut Approved', date: 'Yesterday, 04:15 PM', points: '+150 PRO', type: 'assignment' },
  { id: 'tx-3', title: 'Mentor Rubric: Excellent Pacing Bonus', date: '2 days ago', points: '+50 PRO', type: 'mentor' },
  { id: 'tx-4', title: 'Community Feedback: Peer Project Critique', date: '3 days ago', points: '+25 PRO', type: 'community' },
  { id: 'tx-5', title: 'Milestone 1: Assembly Foundations Capstone', date: 'Sep 18, 2026', points: '+500 PRO', type: 'capstone' },
  { id: 'tx-6', title: '7-Day Editing Streak Shield Claimed', date: 'Sep 15, 2026', points: '+94 PRO', type: 'streak' },
];

export const LevelUpView: React.FC<LevelUpViewProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const [showHabits, setShowHabits] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'top10'>('all');
  const [hoveredDay, setHoveredDay] = useState<{ day: string; userRate: number; commRate: number } | null>(null);

  // User's current rank data
  const userRank = 296;
  const userPoints = 829;
  const userDisplayName = profile?.full_name || 'B15068 Jayanth Durairaj';
  const userInitials = (profile?.full_name || 'Jayanth Durairaj')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Habit chart data for the past 7 days
  const chartDays = [
    { day: 'Wed', userRate: 94.2, commRate: 3.1 },
    { day: 'Thu', userRate: 95.0, commRate: 3.2 },
    { day: 'Fri', userRate: 93.8, commRate: 3.0 },
    { day: 'Sat', userRate: 93.5, commRate: 3.2 },
    { day: 'Sun', userRate: 92.9, commRate: 3.1 },
    { day: 'Mon', userRate: 91.4, commRate: 3.1 },
    { day: 'Tue', userRate: 52.0, commRate: 3.13 },
  ];

  // Filter leaderboard based on query and tabs
  const filteredMembers = useMemo(() => {
    let list = DEFAULT_LEADERBOARD_MEMBERS;
    if (filterView === 'top10') {
      list = list.slice(0, 10);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }
    return list;
  }, [filterView, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f9fc] dark:bg-slate-950 p-3 sm:p-5 lg:p-7 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90 p-4 px-5 shadow-2xs backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black">
              <Zap size={20} className="fill-slate-950" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Level Up &amp; Mastery
                </h1>
                <span className="rounded-full bg-amber-500/10 dark:bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  PRO LEADERBOARD
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare your editing points, habit streaks, and cohort rank with fellow creators
              </p>
            </div>
          </div>

          {onClose && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to feed"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                <ArrowLeft size={14} />
                <span>Back to Feed</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Grid: 3 Columns matching reference image */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ========================================================================= */}
          {/* COLUMN 1 (5 Cols): Habit Performance & Benchmark Chart                   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-5 shadow-xs">
              {/* Header & Points Gained */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    Habit
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block">
                    Points gained
                  </span>
                  <div className="inline-flex items-center gap-1.5 mt-0.5">
                    <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-xs text-xs font-black text-amber-950">
                      🪙
                    </span>
                    <span className="text-sm font-black text-amber-500 tracking-tight">
                      130 PRO
                    </span>
                  </div>
                </div>
              </div>

              {/* Avg Completion Rate Stats */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Your avg completion rate{' '}
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">92.86%</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <TrendingUp size={11} className="mr-0.5" />
                    ↑
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-rose-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Community avg completion rate{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">3.13%</span>
                  </span>
                </div>
              </div>

              {/* SVG Visual Line Chart */}
              <div className="mt-6 relative">
                <div className="relative h-56 w-full">
                  <svg viewBox="0 0 480 200" className="h-full w-full overflow-visible">
                    <defs>
                      <linearGradient id="userRateGradientView" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Dotted Horizontal Guidelines */}
                    {[30, 65, 100, 135, 170].map((y, idx) => (
                      <line
                        key={idx}
                        x1="30"
                        y1={y}
                        x2="450"
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                    ))}

                    {/* User Area Fill */}
                    <path
                      d="M 35,32 C 90,30 130,31 160,33 C 210,34 260,36 300,37 C 350,38 385,42 410,48 C 425,75 435,110 445,118 L 445,170 L 35,170 Z"
                      fill="url(#userRateGradientView)"
                    />

                    {/* Community Benchmark Line (Coral / Rose along bottom) */}
                    <line
                      x1="35"
                      y1="168"
                      x2="445"
                      y2="168"
                      stroke="#f43f5e"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* User Smooth Spline Line (Indigo / Cyan glow) */}
                    <path
                      d="M 35,32 C 90,30 130,31 160,33 C 210,34 260,36 300,37 C 350,38 385,42 410,48 C 425,75 435,110 445,118"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />

                    {/* Interactive Data Points */}
                    {chartDays.map((cd, index) => {
                      const x = 35 + index * 68.3;
                      const y = index === 6 ? 118 : 32 + index * 2.5;
                      return (
                        <g key={cd.day} className="cursor-pointer group">
                          <circle
                            cx={x}
                            cy={y}
                            r="5"
                            className="fill-white stroke-indigo-600 stroke-2 group-hover:scale-125 transition-transform"
                            onMouseEnter={() => setHoveredDay(cd)}
                            onMouseLeave={() => setHoveredDay(null)}
                          />
                          <circle
                            cx={x}
                            cy="168"
                            r="3.5"
                            className="fill-rose-500 opacity-80"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Hover Tooltip */}
                  {hoveredDay && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-1.5 text-xs text-white shadow-xl pointer-events-none border border-slate-800 flex items-center gap-2">
                      <span className="font-bold text-amber-400">{hoveredDay.day}:</span>
                      <span>Your: <b>{hoveredDay.userRate}%</b></span>
                      <span className="text-slate-400">|</span>
                      <span>Comm: <b>{hoveredDay.commRate}%</b></span>
                    </div>
                  )}
                </div>

                {/* X-Axis Days Labels */}
                <div className="flex justify-between px-2 pt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  {chartDays.map((d) => (
                    <span key={d.day} className="w-8 text-center">
                      {d.day}
                    </span>
                  ))}
                </div>

                {/* Chart Legend */}
                <div className="mt-6 flex items-center justify-center gap-6 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-indigo-500" />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Your completion rate
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-rose-500" />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Community completion rate
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Motivation Badge */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-transparent p-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles size={20} />
              </span>
              <div className="text-xs">
                <p className="font-black text-slate-900 dark:text-white">Consistent Editing Edge</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  You rank higher than <b>88%</b> of cohort students in daily milestone completion!
                </p>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 2 (4 Cols): Levelup Members Leaderboard                            */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col h-[540px]">
              {/* Header with All / Top 10 Filter Pills */}
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Levelup Members Leaderboard
                </h3>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`rounded-md px-2 py-0.5 transition ${
                      filterView === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('top10')}
                    className={`rounded-md px-2 py-0.5 transition ${
                      filterView === 'top10'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Top 10
                  </button>
                </div>
              </div>

              {/* Search / Filter Input */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cohort member..."
                  className="w-full rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* MY RANK PINNED CARD (Highlighted compared to all members) */}
              <div className="mb-3 rounded-full border-2 border-indigo-400/80 bg-indigo-50/80 dark:bg-indigo-950/60 dark:border-indigo-600 p-1.5 pr-3 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-indigo-500/40 bg-indigo-600 text-[11px] font-black text-white shrink-0">
                    {userRank}
                  </span>
                  <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 overflow-hidden shrink-0">
                    {userInitials}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {userDisplayName.length > 14 ? `${userDisplayName.slice(0, 14)}...` : userDisplayName}
                      </span>
                      <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white uppercase tracking-wider">
                        YOU
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 rounded-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 shadow-2xs">
                  <span className="text-xs">🪙</span>
                  <span className="text-xs font-black text-amber-500 dark:text-amber-400">
                    {userPoints} PRO
                  </span>
                </div>
              </div>

              {/* Scrollable Leaderboard List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {filteredMembers.map((member) => {
                  const isRank1 = member.rank === 1;
                  const isRank2 = member.rank === 2;
                  const isRank3 = member.rank === 3;

                  // PODIUM RANK 1: Warm Golden Pill
                  if (isRank1) {
                    return (
                      <div
                        key={member.id}
                        className="rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 p-1.5 pr-3 flex items-center justify-between text-white shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-transform"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex size-7 items-center justify-center rounded-full bg-amber-600/60 border border-white/40 text-xs font-black shrink-0">
                            🥇
                          </span>
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="size-7 rounded-full object-cover border border-white/60 shrink-0"
                          />
                          <span className="text-xs font-black tracking-tight truncate">
                            {member.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 rounded-full bg-amber-600/80 px-2.5 py-0.5 border border-amber-300/40">
                          <span className="text-xs">🪙</span>
                          <span className="text-xs font-black text-amber-100">
                            {member.points.toLocaleString()} PRO
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // PODIUM RANK 2: Silver / Sky Pill
                  if (isRank2) {
                    return (
                      <div
                        key={member.id}
                        className="rounded-full bg-gradient-to-r from-slate-200 via-sky-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700 p-1.5 pr-3 flex items-center justify-between text-slate-900 dark:text-white shadow-sm hover:scale-[1.01] transition-transform"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex size-7 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-xs font-black shrink-0">
                            🥈
                          </span>
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="size-7 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                          />
                          <span className="text-xs font-black tracking-tight truncate">
                            {member.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 rounded-full bg-slate-300/70 dark:bg-slate-600/80 px-2.5 py-0.5">
                          <span className="text-xs">🪙</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {member.points.toLocaleString()} PRO
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // PODIUM RANK 3: Bronze / Terracotta Pill
                  if (isRank3) {
                    return (
                      <div
                        key={member.id}
                        className="rounded-full bg-gradient-to-r from-orange-300 via-amber-400 to-orange-400 text-slate-950 p-1.5 pr-3 flex items-center justify-between shadow-sm hover:scale-[1.01] transition-transform"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex size-7 items-center justify-center rounded-full bg-amber-600/30 text-xs font-black shrink-0">
                            🥉
                          </span>
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="size-7 rounded-full object-cover border border-amber-600/30 shrink-0"
                          />
                          <span className="text-xs font-black tracking-tight truncate">
                            {member.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 rounded-full bg-amber-600/30 px-2.5 py-0.5">
                          <span className="text-xs">🪙</span>
                          <span className="text-xs font-black text-slate-950">
                            {member.points.toLocaleString()} PRO
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // RANKS 4+: Clean Standard Pill Rows
                  return (
                    <div
                      key={member.id}
                      className="rounded-full border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 pr-3 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black shrink-0">
                          {member.rank}
                        </span>
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="size-7 rounded-full object-cover shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {member.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5">
                        <span className="text-xs">🪙</span>
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                          {member.points.toLocaleString()} PRO
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 3 (3 Cols): Artistic Profile Card & Daily Habits                   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-3">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#3a3587] via-[#292367] to-[#161245] text-white p-5 shadow-xl min-h-[540px] flex flex-col justify-between">
              
              {/* Starry Constellation Backdrop Dots */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-6 left-8 size-1 rounded-full bg-white shadow-xs" />
                <div className="absolute top-14 right-10 size-1 rounded-full bg-white shadow-xs" />
                <div className="absolute top-28 left-20 size-1 rounded-full bg-white shadow-xs" />
                <div className="absolute top-36 right-16 size-1 rounded-full bg-white shadow-xs" />
                <div className="absolute top-48 left-12 size-1 rounded-full bg-white shadow-xs" />
              </div>

              <div className="relative z-10">
                {/* Big Profile Avatar */}
                <div className="text-center pt-2">
                  <div className="relative mx-auto size-20">
                    <div className="size-20 rounded-full border-4 border-white/90 bg-slate-200 text-slate-800 flex items-center justify-center font-black text-xl shadow-xl overflow-hidden">
                      {userInitials}
                    </div>
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 border border-white/10 px-3 py-0.5 text-xs font-black text-amber-300 shadow-sm">
                    <span>🪙</span>
                    <span>{userPoints} PRO</span>
                  </div>

                  <h4 className="mt-2 text-sm font-black text-white tracking-tight">
                    {userDisplayName}
                  </h4>
                </div>

                {/* PRO Points Banner & History Trigger Button */}
                <div className="mt-5 rounded-2xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between backdrop-blur-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🪙</span>
                    <span className="text-xs font-black text-amber-300">
                      {userPoints} PRO
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="rounded-xl bg-white/90 px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-white hover:scale-105 active:scale-95 transition shadow-xs flex items-center gap-1"
                  >
                    <span>View PRO History</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {/* Today's Habits Section */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <h5 className="text-xs font-black text-white tracking-wide">
                      Today's Habits
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowHabits(!showHabits)}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-white/20 transition flex items-center gap-1"
                    >
                      {showHabits ? (
                        <>
                          <Check size={10} className="text-emerald-400" />
                          <span>Show less</span>
                        </>
                      ) : (
                        <>
                          <span>Show more</span>
                          <ChevronDown size={10} />
                        </>
                      )}
                    </button>
                  </div>

                  {showHabits && (
                    <div className="space-y-2">
                      {/* Habit 1 */}
                      <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between backdrop-blur-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500 text-white shrink-0">
                            <Check size={12} />
                          </span>
                          <div>
                            <p className="text-[11px] font-extrabold text-white">
                              EDIT for 20 minutes
                            </p>
                            <p className="text-[9px] text-slate-300">08:00 AM</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                          🪙 10 PRO
                        </span>
                      </div>

                      {/* Habit 2 */}
                      <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between backdrop-blur-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500 text-white shrink-0">
                            <Check size={12} />
                          </span>
                          <div>
                            <p className="text-[11px] font-extrabold text-white">
                              Export 1 Rough Cut
                            </p>
                            <p className="text-[9px] text-slate-300">11:30 AM</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                          🪙 15 PRO
                        </span>
                      </div>

                      {/* Habit 3 */}
                      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 flex items-center justify-between backdrop-blur-xs opacity-90">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-md border border-white/40 text-transparent shrink-0">
                            ✓
                          </span>
                          <div>
                            <p className="text-[11px] font-bold text-slate-200">
                              Review 1 Peer Project
                            </p>
                            <p className="text-[9px] text-slate-400">03:00 PM</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                          🪙 25 PRO
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scenic Misty Pine Trees Silhouette at Bottom */}
              <div className="relative mt-8 -mx-5 -mb-5 h-24 overflow-hidden pointer-events-none">
                <svg viewBox="0 0 360 100" className="absolute bottom-0 w-full h-full fill-indigo-950/90" preserveAspectRatio="none">
                  <path d="M0,100 L0,70 L20,40 L40,70 L60,45 L80,75 L110,35 L140,75 L170,40 L200,80 L230,30 L260,75 L290,45 L320,80 L340,50 L360,75 L360,100 Z" opacity="0.4" />
                  <path d="M0,100 L0,80 L15,55 L30,85 L50,50 L75,85 L100,55 L125,90 L155,50 L185,85 L215,45 L245,85 L275,55 L305,90 L335,60 L360,85 L360,100 Z" opacity="0.8" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Footer info banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 rounded-2xl p-4 px-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Award size={15} className="text-amber-500" />
            <span>Leaderboard refreshes hourly based on lesson watch time, assignment scores, and daily habit consistency</span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* PRO Points History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-white shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <History size={16} />
                </span>
                <div>
                  <h4 className="text-sm font-black">PRO XP Transaction History</h4>
                  <p className="text-[11px] text-slate-400">Total Balance: {userPoints} PRO</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {PRO_HISTORY_TRANSACTIONS.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tx.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{tx.date}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {tx.points}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
