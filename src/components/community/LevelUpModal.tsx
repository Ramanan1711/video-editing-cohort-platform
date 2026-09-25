import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { fetchEnrolledLeaderboard, type LeaderboardMember } from '../../lib/gamificationService';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRO_HISTORY_TRANSACTIONS = [
  { id: 'tx-1', title: 'Daily Edit: 20 min habit completed', date: 'Today, 08:20 AM', points: '+10 PRO', type: 'habit' },
  { id: 'tx-2', title: 'Assignment 2: Rough Cut Approved', date: 'Yesterday, 04:15 PM', points: '+150 PRO', type: 'assignment' },
  { id: 'tx-3', title: 'Mentor Rubric: Excellent Pacing Bonus', date: '2 days ago', points: '+50 PRO', type: 'mentor' },
  { id: 'tx-4', title: 'Community Feedback: Peer Project Critique', date: '3 days ago', points: '+25 PRO', type: 'community' },
  { id: 'tx-5', title: 'Milestone 1: Assembly Foundations Capstone', date: 'Sep 18, 2026', points: '+500 PRO', type: 'capstone' },
  { id: 'tx-6', title: '7-Day Editing Streak Shield Claimed', date: 'Sep 15, 2026', points: '+94 PRO', type: 'streak' },
];

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [showHabits, setShowHabits] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'top10' | 'myrank'>('all');
  const [hoveredDay, setHoveredDay] = useState<{ day: string; userRate: number; commRate: number } | null>(null);

  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);

  // Fetch enrolled students dynamically from Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadMembers() {
      try {
        setLoadingMembers(true);
        const data = await fetchEnrolledLeaderboard(undefined, user?.id);
        if (isMounted) {
          setMembers(data);
        }
      } catch (err) {
        console.error('Failed to load enrolled members for modal leaderboard:', err);
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    }
    if (isOpen) {
      loadMembers();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id]);

  // User's current rank data
  const currentUserMember = useMemo(() => {
    return members.find((m) => m.id === user?.id || m.isCurrentUser);
  }, [members, user?.id]);

  const userRank = currentUserMember ? currentUserMember.rank : (members.length > 0 ? members.length + 1 : 1);
  const userPoints = currentUserMember ? currentUserMember.points : 0;
  const userDisplayName = profile?.full_name || currentUserMember?.name || 'You';
  const userInitials = (userDisplayName || 'ST')
    .split(' ')
    .filter(Boolean)
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
    let list = members;
    if (filterView === 'top10') {
      list = list.slice(0, 10);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }
    return list;
  }, [members, filterView, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-7xl rounded-3xl border border-slate-200/80 bg-[#f8f9fc] dark:bg-slate-950 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black">
              <Zap size={20} className="fill-slate-950" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Level Up &amp; Mastery
                </h2>
                <span className="rounded-full bg-amber-500/10 dark:bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  PRO LEADERBOARD
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare your editing points, habit streaks, and cohort rank with fellow creators
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              title="Close modal"
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-2xs hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Grid Layout (3 Columns matching reference) */}
        <div className="p-4 sm:p-6 lg:p-7">
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
                        <linearGradient id="userRateGradient" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#userRateGradient)"
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
                            {/* Community dot */}
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

              {/* Quick Motivation Card */}
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
                {/* Header */}
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
                  {loadingMembers && members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                      <Loader2 size={24} className="animate-spin text-amber-500" />
                      <span className="text-xs font-semibold">Loading enrolled students...</span>
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <span className="text-xs font-semibold">No enrolled members found</span>
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
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
                  }))}
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
                    {/* Layer 1 back trees */}
                    <path d="M0,100 L0,70 L20,40 L40,70 L60,45 L80,75 L110,35 L140,75 L170,40 L200,80 L230,30 L260,75 L290,45 L320,80 L340,50 L360,75 L360,100 Z" opacity="0.4" />
                    {/* Layer 2 front trees */}
                    <path d="M0,100 L0,80 L15,55 L30,85 L50,50 L75,85 L100,55 L125,90 L155,50 L185,85 L215,45 L245,85 L275,55 L305,90 L335,60 L360,85 L360,100 Z" opacity="0.8" />
                  </svg>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-6 py-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Award size={14} className="text-amber-500" />
            <span>Leaderboard refreshes hourly based on lesson watch time and peer reviews</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Nested PRO Points History Modal                                           */}
      {/* ========================================================================= */}
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
