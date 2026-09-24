import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  X,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Check,
  ChevronDown,
  Search,
  History,
  Award,
  ArrowLeft,
  Calendar,
  LayoutGrid,
  Filter,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Trophy,
  ChevronsRight,
  Download,
  Upload,
  Play,
  FileText,
  Send,
  Flag,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export type LevelUpSubTab = 'dashboard' | 'habits' | 'challenges';

interface LevelUpViewProps {
  onClose?: () => void;
  initialSubTab?: LevelUpSubTab;
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

interface ChallengeItem {
  id: string;
  type: 'PROJECT' | 'TASK';
  week: string;
  title: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  status: 'active' | 'upcoming' | 'completed';
  participantsJoined: number;
  proReward: number;
  isJoined?: boolean;
}

const INITIAL_CHALLENGES: ChallengeItem[] = [
  {
    id: 'ch-w3-proj',
    type: 'PROJECT',
    week: 'WEEK 3',
    title: 'B15 W3 Project - 3 Remix the emotion',
    startDate: '7 Sep',
    endDate: '13 Sep 2026',
    durationLabel: '7 days',
    status: 'active',
    participantsJoined: 4,
    proReward: 50,
    isJoined: false,
  },
  {
    id: 'ch-w3-task',
    type: 'TASK',
    week: 'WEEK 3',
    title: 'B15 W3 Task 3 - Design sounds for the video',
    startDate: '7 Sep',
    endDate: '10 Sep 2026',
    durationLabel: '4 days',
    status: 'active',
    participantsJoined: 3,
    proReward: 50,
    isJoined: true,
  },
  {
    id: 'ch-w2-proj',
    type: 'PROJECT',
    week: 'WEEK 2',
    title: 'B15 W2 Project - Color Grading & Polish',
    startDate: '31 Aug',
    endDate: '6 Sep 2026',
    durationLabel: '7 days',
    status: 'completed',
    participantsJoined: 38,
    proReward: 100,
    isJoined: true,
  },
  {
    id: 'ch-w4-proj',
    type: 'PROJECT',
    week: 'WEEK 4',
    title: 'B15 W4 Project - Final Narrative Capstone',
    startDate: '14 Sep',
    endDate: '21 Sep 2026',
    durationLabel: '7 days',
    status: 'upcoming',
    participantsJoined: 24,
    proReward: 150,
    isJoined: false,
  },
];

export const LevelUpView: React.FC<LevelUpViewProps> = ({ onClose, initialSubTab = 'dashboard' }) => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sub-tab state
  const querySub = searchParams.get('sub') as LevelUpSubTab | null;
  const [activeSubTab, setActiveSubTab] = useState<LevelUpSubTab>(querySub || initialSubTab);

  const handleSubTabChange = (tab: LevelUpSubTab) => {
    setActiveSubTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sub', tab);
    setSearchParams(newParams);
  };

  // Dashboard state
  const [showHabits, setShowHabits] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'top10'>('all');
  const [hoveredDay, setHoveredDay] = useState<{ day: string; userRate: number; commRate: number } | null>(null);

  // Habits Calendar state
  const [currentMonthName, setCurrentMonthName] = useState('September 2026');
  const [todayHabitCompleted, setTodayHabitCompleted] = useState(true);
  const [todayHabitDismissed, setTodayHabitDismissed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Challenges state
  const [challenges, setChallenges] = useState<ChallengeItem[]>(INITIAL_CHALLENGES);
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'all' | 'completed' | 'upcoming'>('active');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const queryChallengeId = searchParams.get('challenge');
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeItem | null>(() => {
    if (queryChallengeId) {
      return INITIAL_CHALLENGES.find((c) => c.id === queryChallengeId) || null;
    }
    return null;
  });
  const [activeDetailTab, setActiveDetailTab] = useState<'brief' | 'assets' | 'submit' | 'peers'>('brief');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submittedChallengeIds, setSubmittedChallengeIds] = useState<string[]>(['ch-w3-task']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checkin Modal state (Matching user's reference image for Task check-in)
  const [showCheckinModal, setShowCheckinModal] = useState<boolean>(() => Boolean(queryChallengeId));
  const [checkinScreenshotUrl, setCheckinScreenshotUrl] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [showCheckinSubmitForm, setShowCheckinSubmitForm] = useState(false);
  const [submittedCheckinIds, setSubmittedCheckinIds] = useState<string[]>([]);

  const handleSelectChallenge = (challenge: ChallengeItem | null) => {
    setSelectedChallenge(challenge);
    if (challenge) {
      setShowCheckinModal(true);
    }
    const newParams = new URLSearchParams(searchParams);
    if (challenge) {
      newParams.set('challenge', challenge.id);
    } else {
      newParams.delete('challenge');
    }
    setSearchParams(newParams);
  };

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

  // Filter leaderboard
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

  // Calendar cells generation for September 2026
  const calendarCells = useMemo(() => {
    const days: {
      dateNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isCompleted: boolean;
      habitTitle: string;
    }[] = [];

    // Aug 30, Aug 31
    days.push({ dateNum: 30, isCurrentMonth: false, isToday: false, isCompleted: true, habitTitle: 'EDIT for 20 minutes' });
    days.push({ dateNum: 31, isCurrentMonth: false, isToday: false, isCompleted: true, habitTitle: 'EDIT for 20 minutes' });

    // Sep 1 to Sep 30
    for (let i = 1; i <= 30; i++) {
      const isToday = i === 8;
      const isCompleted = i <= 8; // Past and today are completed
      days.push({
        dateNum: i,
        isCurrentMonth: true,
        isToday,
        isCompleted,
        habitTitle: 'EDIT for 20 minutes',
      });
    }

    // Oct 1 to Oct 10
    for (let i = 1; i <= 10; i++) {
      days.push({
        dateNum: i,
        isCurrentMonth: false,
        isToday: false,
        isCompleted: false,
        habitTitle: 'EDIT for 20 minutes',
      });
    }

    return days;
  }, []);

  const handleToggleTodayHabit = () => {
    const nextState = !todayHabitCompleted;
    setTodayHabitCompleted(nextState);
    if (nextState) {
      setToastMessage('+10 PRO Points Earned!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleJoinChallenge = (challengeId: string) => {
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === challengeId ? { ...c, isJoined: true, participantsJoined: c.participantsJoined + 1 } : c
      )
    );
    setToastMessage('🎉 Joined Challenge! Complete it to earn PRO points');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered challenges list
  const filteredChallenges = useMemo(() => {
    if (challengeFilter === 'all') return challenges;
    return challenges.filter((c) => c.status === challengeFilter);
  }, [challenges, challengeFilter]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f8f9fc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* ========================================================================= */}
      {/* Sub-View Navigation Mini Rail (Left Icon Bar from Reference Image)        */}
      {/* ========================================================================= */}
      <aside className="w-14 sm:w-16 border-r border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 flex flex-col items-center py-4 gap-3 shrink-0 backdrop-blur-md">
        <button
          title="Toggle view"
          aria-label="Toggle rail"
          className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ChevronsRight size={18} />
        </button>

        {/* Dashboard 4-Square Grid Icon */}
        <button
          onClick={() => handleSubTabChange('dashboard')}
          title="Leaderboard & Overview"
          aria-label="Dashboard rail button"
          className={`flex size-10 items-center justify-center rounded-xl transition ${
            activeSubTab === 'dashboard'
              ? 'bg-amber-100/80 text-amber-950 font-bold dark:bg-amber-900/50 dark:text-amber-200 shadow-2xs'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutGrid size={20} />
        </button>

        {/* Habits Monthly Calendar / Bar Chart Icon (Purple active pill from screenshot) */}
        <button
          onClick={() => handleSubTabChange('habits')}
          title="Habits Calendar"
          aria-label="Habits rail button"
          className={`flex size-10 items-center justify-center rounded-xl transition ${
            activeSubTab === 'habits'
              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar size={20} />
        </button>

        {/* Challenges Trophy / Project Icon */}
        <button
          onClick={() => handleSubTabChange('challenges')}
          title="Challenges 2.0"
          aria-label="Challenges rail button"
          className={`flex size-10 items-center justify-center rounded-xl transition ${
            activeSubTab === 'challenges'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Trophy size={19} />
        </button>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 space-y-5">
        <div className="mx-auto max-w-7xl space-y-5">

          {/* Top Header Bar with Sub-Tab Selector Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 p-4 px-5 shadow-2xs backdrop-blur-md">
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
                  Track daily editing habits, monitor cohort consistency, and conquer challenges
                </p>
              </div>
            </div>

            {/* Sub-Tab Navigation Segmented Pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60">
                <button
                  onClick={() => handleSubTabChange('dashboard')}
                  aria-label="Switch to dashboard view"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeSubTab === 'dashboard'
                      ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => handleSubTabChange('habits')}
                  aria-label="Switch to habits view"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeSubTab === 'habits'
                      ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>Habits</span>
                </button>

                <button
                  onClick={() => handleSubTabChange('challenges')}
                  aria-label="Switch to challenges view"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeSubTab === 'challenges'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Trophy size={14} />
                  <span>Challenges 2.0</span>
                </button>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back to feed"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Feed</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="rounded-xl bg-emerald-500 text-white p-3 text-xs font-black flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 1: HABITS CALENDAR VIEW (From User Reference Image 1)                */}
          {/* ========================================================================= */}
          {activeSubTab === 'habits' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Habits
                </h2>
              </div>

              {/* Grid: Calendar on Left, Today's Habits on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* Calendar Card (8 cols) */}
                <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                  {/* Calendar Top Controls: Month & Prev/Next */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {currentMonthName}
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentMonthName('September 2026')}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      >
                        Today
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          title="Previous Month"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          title="Next Month"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-2 pt-4 pb-2 text-center text-xs font-black text-slate-600 dark:text-slate-400">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>

                  {/* 42 Monthly Grid Cells */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarCells.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`min-h-[72px] sm:min-h-[82px] rounded-xl border p-1.5 sm:p-2 flex flex-col justify-between transition-all ${
                          cell.isToday
                            ? 'border-amber-400 bg-amber-50/40 dark:border-amber-500/70 dark:bg-amber-950/20 shadow-xs'
                            : cell.isCurrentMonth
                            ? 'border-slate-150 dark:border-slate-800/80 bg-white dark:bg-slate-900/60'
                            : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/40 opacity-70'
                        }`}
                      >
                        {/* Date Number */}
                        <div className="text-right">
                          <span
                            className={`text-xs font-bold ${
                              cell.isToday
                                ? 'text-amber-600 dark:text-amber-400 font-black'
                                : cell.isCurrentMonth
                                ? 'text-slate-700 dark:text-slate-300'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                          >
                            {cell.dateNum}
                          </span>
                        </div>

                        {/* Habit Badge Pill inside Day */}
                        <div
                          className={`rounded-md border p-1 sm:p-1.5 text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 border-l-[3px] sm:border-l-4 ${
                            cell.isCompleted
                              ? 'border-l-amber-500 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200'
                              : 'border-l-amber-400 border-slate-100 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {cell.isCompleted ? (
                            <span className="flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black shrink-0">
                              ✓
                            </span>
                          ) : (
                            <span className="size-2 rounded-full bg-amber-400/80 shrink-0" />
                          )}
                          <span className="truncate leading-tight">{cell.habitTitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Complete Today's Habits (1) (Matching Reference Image 1) */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Complete today's Habits (1)
                    </h3>
                  </div>

                  {!todayHabitDismissed ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleToggleTodayHabit}
                          className={`flex size-6 items-center justify-center rounded-full transition ${
                            todayHabitCompleted
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                          }`}
                        >
                          {todayHabitCompleted && <Check size={14} className="stroke-[3]" />}
                        </button>

                        <div>
                          <p
                            className={`text-xs font-extrabold ${
                              todayHabitCompleted
                                ? 'text-slate-600 dark:text-slate-400 line-through decoration-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            EDIT For 20 Minutes
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock size={12} />
                            <span>08:00 AM</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-2xs">
                          10 PRO
                        </span>
                        <button
                          onClick={() => setTodayHabitDismissed(true)}
                          title="Dismiss"
                          className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center space-y-2">
                      <p className="text-xs text-slate-500">All habits logged for today!</p>
                      <button
                        onClick={() => setTodayHabitDismissed(false)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Undo dismissal
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3">
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                      💡 Pro Consistency Tip
                    </p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5">
                      Completing your daily 20-minute timeline practice for 7 days grants a 100 PRO streak multiplier!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: CHALLENGES 2.0 VIEW (From User Reference Image 2)                 */}
          {/* ========================================================================= */}
          {activeSubTab === 'challenges' && (
            <div className="space-y-5">
              {selectedChallenge ? (
                /* ================================================================= */
                /* Challenge Detail / Workspace Page ("Next page in the Challenges") */
                /* ================================================================= */
                <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSelectChallenge(null)}
                      aria-label="Back to challenges list"
                      className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition group"
                    >
                      <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                      <span>Back to challenges</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {selectedChallenge.status}
                      </span>
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        🪙 {selectedChallenge.proReward} PRO Points Reward
                      </span>
                    </div>
                  </div>

                  {/* Dark Hero Card Banner (Matching Reference Image) */}
                  <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-[#13161c] text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md overflow-hidden relative">
                    <div className="space-y-3 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-400">
                          {selectedChallenge.type} {selectedChallenge.week}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={12} />
                          <span>{selectedChallenge.startDate} - {selectedChallenge.endDate} • {selectedChallenge.durationLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                          Ends in: 2d 0h 17m
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                        {selectedChallenge.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400">
                        Cut / Craft Cohort Creative Challenge • Master documentary pacing, emotional audio layers, and storytelling impact
                      </p>
                    </div>

                    {/* Action Button: 🪙 50 PRO */}
                    <div className="shrink-0 flex flex-col sm:items-end gap-1.5 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowCheckinModal(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                      >
                        <span>🪙</span>
                        <span>{selectedChallenge.proReward} PRO</span>
                      </button>
                      <span className="text-[11px] text-slate-400 self-center sm:self-end">Click to view checkin details</span>
                    </div>
                  </div>

                  {/* Submissions & Leaderboard Card (Flame 🔥 Icon) */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                          <Flame size={18} />
                        </span>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          Submissions
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-slate-400">
                        {submittedCheckinIds.includes(selectedChallenge.id) ? '2 submissions' : '1 submission'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Leaderboard Item #1 matching reference image */}
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-3 hover:bg-slate-100/70 transition">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-400 w-5 text-center">#1</span>
                          <img
                            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80"
                            alt="Bala murugan"
                            className="size-8 rounded-full object-cover ring-2 ring-amber-400/40"
                          />
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white">Bala murugan</p>
                            <p className="text-[10px] text-slate-400">Checked in 3 hours ago</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
                            🪙 50 PRO
                          </span>
                          <span className="text-base" title="1st Place">🥇</span>
                        </div>
                      </div>

                      {/* User submission if submitted */}
                      {submittedCheckinIds.includes(selectedChallenge.id) && (
                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 transition animate-in fade-in">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 w-5 text-center">#2</span>
                            <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs ring-2 ring-emerald-400/40">
                              {userInitials}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white">{userDisplayName} (You)</p>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Checked in just now</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                              🪙 50 PRO
                            </span>
                            <span className="text-base" title="Check-in Complete">✅</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation Sub-Tabs & Detailed Workspace */}
                  <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 overflow-x-auto gap-4">
                      {[
                        { id: 'brief', label: 'Brief & Instructions', icon: FileText },
                        { id: 'assets', label: 'Assets & Footage', icon: Download },
                        { id: 'submit', label: 'Submit Entry', icon: Upload },
                        { id: 'peers', label: `Peer Submissions (${selectedChallenge.participantsJoined})`, icon: Trophy },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeDetailTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                            className={`flex items-center gap-2 py-3.5 text-xs font-black transition border-b-2 whitespace-nowrap ${
                              isActive
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <Icon size={15} />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab 1: Brief & Instructions */}
                  {activeDetailTab === 'brief' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            Creative Challenge Objectives
                          </h3>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            In this week's challenge, take the provided documentary footage package and invert the viewer's emotional journey. By leveraging rhythmic micro-pauses, J-cuts, and contrasting music dynamics, build narrative tension that resolves into peaceful clarity.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                            Deliverables &amp; Requirements
                          </h4>
                          <div className="space-y-2">
                            {[
                              'Duration must be between 45 seconds and 75 seconds.',
                              'Include at least 3 audio-motivated transitions (L-cut or J-cut).',
                              'Target audio loudness: Dialogue at -14 LUFS, background ambience at -24 LUFS.',
                              'Export resolution: 1080p 24fps in H.264 or ProRes 422.',
                            ].map((req, idx) => (
                              <div key={idx} className="flex items-start gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black shrink-0">
                                  {idx + 1}
                                </span>
                                <span>{req}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between">
                          <span className="text-xs text-slate-500">Ready to upload your edit?</span>
                          <button
                            onClick={() => setActiveDetailTab('submit')}
                            className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-95 transition"
                          >
                            Proceed to Submission →
                          </button>
                        </div>
                      </div>

                      {/* Right Sidebar: Evaluation Rubric */}
                      <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          Grading Rubric (50 Pts)
                        </h3>

                        <div className="space-y-3">
                          {[
                            { title: 'Storytelling & Tension Arc', pts: '20 Pts', desc: 'Emotional trajectory from opening to final resolve' },
                            { title: 'Sound Design & Layering', pts: '15 Pts', desc: 'Foley realism, ambience bed, and audio transitions' },
                            { title: 'Technical Polish & Color', pts: '15 Pts', desc: 'Grade consistency, pacing cadence, and clean export' },
                          ].map((item, idx) => (
                            <div key={idx} className="rounded-xl border border-slate-100 dark:border-slate-800/80 p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{item.title}</span>
                                <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">{item.pts}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">{item.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Assets & Footage */}
                  {activeDetailTab === 'assets' && (
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Challenge Footage &amp; Audio Assets
                      </h3>
                      <p className="text-xs text-slate-500">
                        Download the project assets prepared for this week's challenge. High-bitrate 4K raw footage and uncompressed 24-bit audio stems.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {[
                          { title: 'Documentary Footage Pack', size: '1.4 GB', type: '.zip / ProRes 422' },
                          { title: 'Sound Design & Foley FX Bed', size: '320 MB', type: '.zip / 24-bit WAV' },
                          { title: 'NLE Starter Project Templates', size: '45 MB', type: '.drp & .prproj' },
                        ].map((asset, i) => (
                          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between">
                            <div>
                              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mb-2">
                                <Download size={18} />
                              </span>
                              <h4 className="text-xs font-black text-slate-900 dark:text-white">{asset.title}</h4>
                              <p className="text-[10px] text-slate-400">{asset.type} • {asset.size}</p>
                            </div>
                            <button
                              onClick={() => {
                                setToastMessage(`Downloading ${asset.title}...`);
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition"
                            >
                              <Download size={13} />
                              <span>Download Asset</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Submit Your Entry */}
                  {activeDetailTab === 'submit' && (
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs max-w-2xl mx-auto space-y-5">
                      <div className="text-center space-y-1">
                        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mx-auto">
                          <Upload size={22} />
                        </span>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          Submit Your Challenge Entry
                        </h3>
                        <p className="text-xs text-slate-500">
                          Submit your video link to unlock {selectedChallenge.proReward} PRO points and receive mentor critique
                        </p>
                      </div>

                      {submittedChallengeIds.includes(selectedChallenge.id) ? (
                        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center space-y-3">
                          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white mx-auto shadow-md">
                            <Check size={24} />
                          </span>
                          <div>
                            <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-300">
                              Entry Successfully Submitted!
                            </h4>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                              You claimed 🪙 {selectedChallenge.proReward} PRO Points. Mentor review will be available within 48 hours.
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectChallenge(null)}
                            className="rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-black dark:bg-white dark:text-slate-950 hover:bg-slate-800 transition"
                          >
                            Return to Challenges
                          </button>
                        </div>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!submissionUrl.trim()) return;
                            setIsSubmitting(true);
                            setTimeout(() => {
                              setIsSubmitting(false);
                              setSubmittedChallengeIds((prev) => [...prev, selectedChallenge.id]);
                              setToastMessage(`🎉 Entry Submitted! +${selectedChallenge.proReward} PRO Points Claimed!`);
                              setSubmissionUrl('');
                              setSubmissionNotes('');
                              setTimeout(() => setToastMessage(null), 4000);
                            }, 500);
                          }}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Video Playback URL (YouTube, Vimeo, Loom, or Drive) *
                            </label>
                            <input
                              type="url"
                              required
                              value={submissionUrl}
                              onChange={(e) => setSubmissionUrl(e.target.value)}
                              placeholder="https://youtube.com/watch?v=..."
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Editor Notes &amp; Creative Reflections
                            </label>
                            <textarea
                              rows={3}
                              value={submissionNotes}
                              onChange={(e) => setSubmissionNotes(e.target.value)}
                              placeholder="Describe your editing choices, pacing shifts, sound design approach..."
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !submissionUrl.trim()}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-98 transition disabled:opacity-50"
                          >
                            <Send size={15} />
                            <span>{isSubmitting ? 'Submitting...' : `Submit Challenge Entry & Claim 🪙 ${selectedChallenge.proReward} PRO`}</span>
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Peer Submissions */}
                  {activeDetailTab === 'peers' && (
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            Cohort Peer Submissions
                          </h3>
                          <p className="text-xs text-slate-500">
                            Watch cuts from fellow cohort members and exchange constructive feedback
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        {[
                          { name: 'Bala murugan', rank: '🥇 Rank 1', time: 'Yesterday', views: 42, score: '48/50' },
                          { name: 'Kamalesh K', rank: '🥈 Rank 2', time: '2 days ago', views: 31, score: '46/50' },
                          { name: 'Prasanth R', rank: '🥉 Rank 3', time: '3 days ago', views: 28, score: '45/50' },
                        ].map((peer, i) => (
                          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                            <div className="relative h-28 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden group">
                              <span className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs group-hover:scale-110 transition">
                                <Play size={16} />
                              </span>
                              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white">
                                0:58
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{peer.name}</span>
                              <span className="text-[10px] font-black text-amber-500">{peer.rank}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Score: {peer.score}</span>
                              <span>{peer.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ================================================================= */
                /* Challenges 2.0 List Grid (Matching User Reference Image Exactly) */
                /* ================================================================= */
                <>
                  {/* Header with Title and Filter Dropdown */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        Challenges
                      </h2>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        <span className="capitalize">{challengeFilter}</span>
                        <Filter size={13} className="text-slate-400" />
                        <ChevronDown size={14} className="text-slate-400" />
                      </button>

                      {showFilterDropdown && (
                        <div className="absolute right-0 mt-1 w-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-20">
                          {(['active', 'upcoming', 'completed', 'all'] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setChallengeFilter(opt);
                                setShowFilterDropdown(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                                challengeFilter === opt
                                  ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span>{opt}</span>
                              {challengeFilter === opt && <Check size={12} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Challenge Cards Grid (Matching Reference Image 2) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredChallenges.map((challenge) => {
                      const isProject = challenge.type === 'PROJECT';

                      return (
                        <div
                          key={challenge.id}
                          onClick={() => handleSelectChallenge(challenge)}
                          className="group cursor-pointer rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-amber-400 dark:hover:border-amber-500/70 hover:shadow-lg transition-all flex flex-col justify-between"
                        >
                          {/* Top Graphic Banner with Styled SVGs matching screenshot */}
                          <div className="relative h-44 sm:h-48 w-full bg-[#13161c] flex flex-col items-center justify-center p-4 border-b border-slate-800">
                            {/* Top-Right ACTIVE Green Ribbon */}
                            <div className="absolute top-0 right-0">
                              <span
                                className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-bl-xl shadow-xs text-white ${
                                  challenge.status === 'active'
                                    ? 'bg-emerald-600'
                                    : challenge.status === 'completed'
                                    ? 'bg-blue-600'
                                    : 'bg-purple-600'
                                }`}
                              >
                                {challenge.status}
                              </span>
                            </div>

                            {/* Vector Graphic: Laptop Screen (Project) vs Notepad (Task) */}
                            <div className="flex flex-col items-center justify-center space-y-1">
                              {isProject ? (
                                // Golden Laptop Vector Art
                                <div className="relative">
                                  <svg width="68" height="48" viewBox="0 0 68 48" fill="none" className="text-amber-400">
                                    <rect x="8" y="4" width="52" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" />
                                    <path d="M4 36H64C65.1046 36 66 36.8954 66 38V40H2V38C2 36.8954 2.89543 36 4 36Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
                                    <rect x="14" y="10" width="40" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                                    <polygon points="30,16 40,20 30,24" fill="currentColor" />
                                    <line x1="16" y1="26" x2="52" y2="26" stroke="currentColor" strokeWidth="1.5" />
                                  </svg>
                                </div>
                              ) : (
                                // Golden Notepad & Pencil Vector Art
                                <div className="relative">
                                  <svg width="56" height="48" viewBox="0 0 56 48" fill="none" className="text-amber-400">
                                    <rect x="10" y="4" width="34" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" />
                                    <line x1="16" y1="14" x2="30" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="16" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="16" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    {/* Tilted Pencil */}
                                    <g transform="translate(24, 6) rotate(32)">
                                      <polygon points="16,2 20,4 6,28 2,26" fill="currentColor" stroke="currentColor" strokeWidth="1" />
                                      <polygon points="2,26 6,28 0,32" fill="#f59e0b" />
                                    </g>
                                  </svg>
                                </div>
                              )}

                              {/* Bold Graphic Typography */}
                              <div className="text-center font-black tracking-wider uppercase text-amber-400">
                                <span className="block text-xl tracking-widest drop-shadow-[0_2px_8px_rgba(245,158,11,0.4)]">
                                  {challenge.type}
                                </span>
                                <span className="block text-sm tracking-wider text-amber-300 font-extrabold">
                                  {challenge.week}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                            <div className="space-y-2.5">
                              {/* Duration Pill */}
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                <span>{challenge.startDate} - {challenge.endDate} • {challenge.durationLabel}</span>
                              </div>

                              {/* Challenge Title */}
                              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug group-hover:text-amber-500 transition-colors">
                                {challenge.title}
                              </h3>

                              {/* Participants & Social Proof */}
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  <img
                                    className="inline-block size-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&h=64&q=80"
                                    alt="User"
                                  />
                                  <img
                                    className="inline-block size-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80"
                                    alt="User"
                                  />
                                  {challenge.participantsJoined > 2 && (
                                    <img
                                      className="inline-block size-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                                      src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=64&h=64&q=80"
                                      alt="User"
                                    />
                                  )}
                                </div>
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  +{challenge.participantsJoined - 1} participants joined
                                </span>
                              </div>
                            </div>

                            {/* Divider & Footer (Matching Screenshot Exactly) */}
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                              {challenge.isJoined ? (
                                <div className="flex items-center">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Joined
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-500">
                                    Join &amp; stand a chance to earn
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJoinChallenge(challenge.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300 hover:bg-amber-100 active:scale-95 transition shadow-2xs"
                                  >
                                    <span>🪙 {challenge.proReward} PRO</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: DASHBOARD & LEADERBOARD (Previous 3-Column Experience)            */}
          {/* ========================================================================= */}
          {activeSubTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* COLUMN 1 (5 Cols): Habit Performance & Benchmark Chart */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-5 shadow-xs">
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
                        <line x1="30" y1="20" x2="470" y2="20" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" className="dark:stroke-slate-800" />
                        <line x1="30" y1="70" x2="470" y2="70" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" className="dark:stroke-slate-800" />
                        <line x1="30" y1="120" x2="470" y2="120" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" className="dark:stroke-slate-800" />
                        <line x1="30" y1="170" x2="470" y2="170" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" className="dark:stroke-slate-800" />

                        {/* Y-Axis Labels */}
                        <text x="5" y="24" fontSize="10" fill="#94a3b8" fontWeight="600">100%</text>
                        <text x="5" y="74" fontSize="10" fill="#94a3b8" fontWeight="600">75%</text>
                        <text x="5" y="124" fontSize="10" fill="#94a3b8" fontWeight="600">50%</text>
                        <text x="5" y="174" fontSize="10" fill="#94a3b8" fontWeight="600">25%</text>

                        {/* Community Average Line */}
                        <path
                          d="M 50 188 Q 115 187, 180 188 T 310 187 T 440 188"
                          fill="none"
                          stroke="#fb7185"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* User Completion Curve Fill */}
                        <path
                          d="M 50 30 C 115 28, 180 32, 245 33 C 310 34, 375 36, 440 115 L 440 170 L 50 170 Z"
                          fill="url(#userRateGradientView)"
                        />

                        {/* User Completion Spline */}
                        <path
                          d="M 50 30 C 115 28, 180 32, 245 33 C 310 34, 375 36, 440 115"
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive Data Nodes */}
                        {[
                          { cx: 50, cy: 30, day: 'Wed', u: 94.2, c: 3.1 },
                          { cx: 115, cy: 28, day: 'Thu', u: 95.0, c: 3.2 },
                          { cx: 180, cy: 32, day: 'Fri', u: 93.8, c: 3.0 },
                          { cx: 245, cy: 33, day: 'Sat', u: 93.5, c: 3.2 },
                          { cx: 310, cy: 34, day: 'Sun', u: 92.9, c: 3.1 },
                          { cx: 375, cy: 36, day: 'Mon', u: 91.4, c: 3.1 },
                          { cx: 440, cy: 115, day: 'Tue', u: 52.0, c: 3.13 },
                        ].map((pt, i) => (
                          <g
                            key={i}
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredDay({ day: pt.day, userRate: pt.u, commRate: pt.c })}
                            onMouseLeave={() => setHoveredDay(null)}
                          >
                            <circle
                              cx={pt.cx}
                              cy={pt.cy}
                              r={i === 6 ? 6 : 4}
                              className={i === 6 ? 'fill-indigo-600 stroke-4 stroke-white dark:stroke-slate-900 shadow-md' : 'fill-white stroke-3 stroke-indigo-600'}
                            />
                            <circle
                              cx={pt.cx}
                              cy={188}
                              r={3}
                              className="fill-rose-400 stroke-2 stroke-white dark:stroke-slate-900"
                            />
                          </g>
                        ))}
                      </svg>

                      {/* Tooltip Overlay */}
                      {hoveredDay && (
                        <div className="absolute top-2 right-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-2 px-3 shadow-lg backdrop-blur-xs text-xs pointer-events-none animate-in fade-in">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{hoveredDay.day} Performance</p>
                          <p className="text-indigo-600 dark:text-indigo-400 font-extrabold">You: {hoveredDay.userRate}%</p>
                          <p className="text-rose-500 font-medium">Community: {hoveredDay.commRate}%</p>
                        </div>
                      )}
                    </div>

                    {/* X-Axis Days of Week */}
                    <div className="flex justify-between px-6 pt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                      {chartDays.map((d) => (
                        <span key={d.day} className={d.day === 'Tue' ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''}>
                          {d.day}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-6 text-[11px] font-semibold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-indigo-500" />
                      <span>Your Completion</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-400" />
                      <span>Cohort Avg</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2 (4 Cols): Members Leaderboard */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                      Levelup Members
                    </h3>
                    <p className="text-[11px] text-slate-400">Ranked by points</p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    <button
                      onClick={() => setFilterView('all')}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                        filterView === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterView('top10')}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                        filterView === 'top10'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Top 10
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cohort members..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                {/* Pinned Current User Rank Card */}
                <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50/60 dark:from-amber-950/40 dark:to-yellow-950/20 p-3 mb-3 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-xs font-black text-amber-900 dark:text-amber-300">
                      ({userRank})
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {userDisplayName}
                      </p>
                      <span className="inline-block rounded-sm bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black text-amber-800 dark:text-amber-300">
                        YOU
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-black text-amber-900 dark:text-amber-300">
                    {userPoints} PRO
                  </span>
                </div>

                {/* Top 3 Podium Highlights */}
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-xl border border-yellow-200/80 bg-yellow-500/10 dark:border-yellow-600/30 dark:bg-yellow-500/5 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🥇</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Bala murugan</span>
                    </div>
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">36,190 PRO</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🥈</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Kamalesh K</span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">35,525 PRO</span>
                  </div>

                  <div className="rounded-xl border border-amber-200/60 bg-amber-700/5 dark:border-amber-800/30 dark:bg-amber-900/10 p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🥉</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Prasanth R</span>
                    </div>
                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-500">23,430 PRO</span>
                  </div>
                </div>

                {/* Scrollable Members List */}
                <div className="flex-1 overflow-y-auto max-h-72 space-y-1 pr-1">
                  {filteredMembers.slice(3).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-center text-slate-400 font-bold text-[11px] shrink-0">
                          {member.rank}
                        </span>
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="size-6 rounded-full object-cover shrink-0"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {member.name}
                        </span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-200 shrink-0">
                        {member.points.toLocaleString()} PRO
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* COLUMN 3 (3 Cols): Artistic Starry Cosmic Profile & Habits Card */}
              <div className="lg:col-span-3 rounded-2xl bg-gradient-to-b from-[#1b1f3b] via-[#10142b] to-[#0a0c1a] text-white p-5 shadow-lg border border-indigo-950 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="relative z-10 space-y-4">
                  {/* Top Avatar & Coin Profile */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-slate-950 font-black text-xl shadow-lg ring-4 ring-amber-400/20">
                        {userInitials}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black shadow-md border-2 border-[#10142b]">
                        🪙
                      </span>
                    </div>

                    <h4 className="mt-2.5 text-sm font-black tracking-tight text-white">
                      {userDisplayName}
                    </h4>

                    {/* PRO Points Badge */}
                    <div className="mt-1 flex items-center gap-1 rounded-full bg-white/10 px-3 py-0.5 text-xs font-black text-amber-300 border border-white/15">
                      <span>{userPoints} PRO</span>
                    </div>

                    {/* PRO History Trigger */}
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="mt-2 text-[10px] font-bold text-amber-300/80 hover:text-amber-200 flex items-center gap-1 transition"
                    >
                      <span>View PRO History</span>
                      <ArrowUpRight size={10} />
                    </button>
                  </div>

                  {/* Today's Habits Header with Expand/Collapse */}
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black tracking-wide text-white">
                        Today's Habits
                      </span>
                      <button
                        onClick={() => setShowHabits(!showHabits)}
                        className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-0.5"
                      >
                        {showHabits ? <span>Show less</span> : <span>Show more</span>}
                        <ChevronDown size={10} className={showHabits ? 'rotate-180' : ''} />
                      </button>
                    </div>

                    {showHabits && (
                      <div className="space-y-2">
                        <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between backdrop-blur-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500 text-white shrink-0">
                              <Check size={12} />
                            </span>
                            <div>
                              <p className="text-[11px] font-extrabold text-white">EDIT for 20 minutes</p>
                              <p className="text-[9px] text-slate-300">08:00 AM</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                            🪙 10 PRO
                          </span>
                        </div>

                        <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between backdrop-blur-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500 text-white shrink-0">
                              <Check size={12} />
                            </span>
                            <div>
                              <p className="text-[11px] font-extrabold text-white">Export 1 Rough Cut</p>
                              <p className="text-[9px] text-slate-300">11:30 AM</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                            🪙 15 PRO
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Artistic Misty Layered Pine Silhouette at Base */}
                <div className="relative mt-4 -mx-5 -mb-5 h-16 overflow-hidden opacity-30 pointer-events-none">
                  <svg viewBox="0 0 300 80" className="w-full h-full object-cover fill-indigo-400" preserveAspectRatio="none">
                    <polygon points="0,80 20,45 35,65 55,30 75,70 95,20 115,60 135,35 155,75 175,25 195,65 215,30 235,70 255,40 275,60 300,30 300,80" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Footer Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Award size={15} className="text-amber-500" />
              <span>Leaderboard &amp; challenges refresh hourly based on lessons, habits, and project submissions</span>
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

        {/* ========================================================================= */}
        {/* CHECKIN DETAILS MODAL (Matching User Reference Image Exactly)             */}
        {/* ========================================================================= */}
        {showCheckinModal && selectedChallenge && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
            onClick={() => setShowCheckinModal(false)}
          >
            <div
              className="relative w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Checkin details for {selectedChallenge.title.replace(/^B\d+\s+W\d+\s+/, '')}
                </h3>
                <button
                  onClick={() => setShowCheckinModal(false)}
                  aria-label="Close modal"
                  className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: 2 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
                {/* Left Column (8 Cols): Instructions */}
                <div className="lg:col-span-8 space-y-5">
                  {/* Card Header with Peach Flag */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
                      <Flag size={18} />
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {selectedChallenge.title.replace(/^B\d+\s+W\d+\s+/, '')}
                    </h4>
                  </div>

                  {/* Stat Card: Points assigned + Ends in */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Points assigned:</span>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">🪙 {selectedChallenge.proReward} PRO</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Ends in:</span>
                      <span className="text-xs font-black text-rose-500">2d 0h 17m</span>
                    </div>
                  </div>

                  {/* 5 Step-by-Step Instructions */}
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 1 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Complete watching both Lessons</span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 2 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Select any one from the given footage. Download the footage :{' '}
                        <a
                          href="#download-footage"
                          onClick={(e) => {
                            e.preventDefault();
                            setToastMessage('Footage download link clicked');
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 underline decoration-blue-400/50"
                        >
                          Here
                        </a>
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 3 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Plan the sounds using notes in resolve</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-start gap-2.5">
                        <span className="font-black text-slate-900 dark:text-white shrink-0">Step 4 :</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Subscribe to Epidemic Sounds
                        </span>
                      </div>
                      <div className="pl-14 space-y-1">
                        <a
                          href="https://share.epidemicsound.com/cxdvph"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 underline decoration-blue-400/50 break-all"
                        >
                          https://share.epidemicsound.com/cxdvph
                        </a>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                          ( ⚠️ Just subscribe to the Monthly Creator Plan )
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 5 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Collect Music &amp; SFX</span>
                    </div>
                  </div>

                  {/* Bottom Submission Link Notice */}
                  <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="font-black">Submission :</span> Upload the Screenshot of your Planned Timeline{' '}
                      <a
                        href="#upload-timeline"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowCheckinSubmitForm(true);
                        }}
                        className="font-black text-blue-600 hover:text-blue-500 dark:text-blue-400 underline decoration-blue-400/50"
                      >
                        Here
                      </a>
                    </p>
                  </div>
                </div>

                {/* Right Column (4 Cols): Submissions Action Card */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Submissions
                      </h4>
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-600 dark:text-amber-400">
                        🪙 + {selectedChallenge.proReward} PRO
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Submit your check-in to complete today's challenge.
                    </p>

                    {/* Check-in submission form / completed state */}
                    {submittedCheckinIds.includes(selectedChallenge.id) ? (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center space-y-2">
                        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white mx-auto shadow-xs">
                          <Check size={18} />
                        </span>
                        <p className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                          Check-in Completed!
                        </p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          You earned +{selectedChallenge.proReward} PRO Points today
                        </p>
                      </div>
                    ) : showCheckinSubmitForm ? (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Screenshot Proof URL *
                          </label>
                          <input
                            type="url"
                            value={checkinScreenshotUrl}
                            onChange={(e) => setCheckinScreenshotUrl(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Notes (optional)
                          </label>
                          <textarea
                            rows={2}
                            value={checkinNotes}
                            onChange={(e) => setCheckinNotes(e.target.value)}
                            placeholder="Sound design markers placed..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    {!submittedCheckinIds.includes(selectedChallenge.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!showCheckinSubmitForm) {
                            setShowCheckinSubmitForm(true);
                          } else {
                            // Complete checkin
                            setSubmittedCheckinIds((prev) => [...prev, selectedChallenge.id]);
                            setToastMessage(`🎉 Check-in Completed! +${selectedChallenge.proReward} PRO Points Claimed!`);
                            setShowCheckinSubmitForm(false);
                            setTimeout(() => setToastMessage(null), 4000);
                          }
                        }}
                        className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 py-3 text-xs font-black text-white shadow-md shadow-amber-500/20 transition cursor-pointer"
                      >
                        Submit
                      </button>
                    )}
                    {submittedCheckinIds.includes(selectedChallenge.id) && (
                      <button
                        type="button"
                        onClick={() => setShowCheckinModal(false)}
                        className="w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 text-xs font-black transition cursor-pointer"
                      >
                        Done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
