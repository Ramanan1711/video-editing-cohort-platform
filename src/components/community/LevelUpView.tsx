import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  FileText,
  Flag,
  Flame,
  Lock,
  BookOpen,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  fetchEnrolledLeaderboard,
  fetchAvailableCourses,
  fetchUserEnrolledCohort,
  fetchUserEnrolledCourses,
  fetchUserProHistory,
  type LeaderboardMember,
  type CourseOption,
  type ProHistoryTransaction,
} from '../../lib/gamificationService';
import {
  fetchCourseChallenges,
  joinCourseChallenge,
  leaveCourseChallenge,
  submitCourseChallenge,
  fetchChallengeParticipants,
  fetchChallengeSubmissions,
  formatChallengeCountdown,
  type CourseChallengeItem,
  type ChallengeParticipantProfile,
  type ChallengeSubmissionDetail,
} from '../../lib/courseChallengeService';
import { ChallengeListSkeleton } from '../ui/Skeletons';
import { DynamicChallengeSubmissionBox } from '../internship/DynamicChallengeSubmissionBox';

export type LevelUpSubTab = 'dashboard' | 'habits' | 'challenges';

interface LevelUpViewProps {
  onClose?: () => void;
  initialSubTab?: LevelUpSubTab;
  initialDate?: Date;
}

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export type ChallengeItem = CourseChallengeItem;

/**
 * Extracts or generates dynamic deliverable requirements based on the challenge description and course track.
 */
function getChallengeDeliverables(challenge: ChallengeItem, courseTitle?: string): string[] {
  if (challenge.description?.trim()) {
    const rawLines = challenge.description
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const bulletLines = rawLines.filter((l) => /^[-*•\d+.)]\s+/.test(l));
    if (bulletLines.length >= 1) {
      return bulletLines.map((l) => l.replace(/^[-*•\d+.)]\s+/, '').trim());
    }

    if (rawLines.length > 1) {
      return rawLines;
    }

    const sentences = challenge.description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    if (sentences.length >= 2) {
      return sentences;
    }
    if (sentences.length === 1) {
      return [sentences[0]];
    }
  }

  const lowerTrack = (courseTitle || challenge.cohortTitle || '').toLowerCase();
  const isCoding =
    lowerTrack.includes('code') ||
    lowerTrack.includes('python') ||
    lowerTrack.includes('java') ||
    lowerTrack.includes('web') ||
    lowerTrack.includes('software');
  const is3D =
    lowerTrack.includes('motion') ||
    lowerTrack.includes('3d') ||
    lowerTrack.includes('blender') ||
    lowerTrack.includes('animation');

  if (isCoding) {
    return [
      `Complete implementation for "${challenge.title}" adhering to clean coding standards.`,
      'Provide a working repository URL (GitHub / GitLab) or live deployed preview link.',
      'Include a clear README or documentation with setup instructions.',
      `Submit your deliverable before the deadline to claim 🪙 ${challenge.proReward} PRO Points.`,
    ];
  }

  if (is3D) {
    return [
      `Render and package the 3D / motion asset for "${challenge.title}".`,
      'Export in recommended presentation format (MP4 / WebM or image render sequences).',
      'Provide access to source project files or Cloud Drive link (Google Drive / Dropbox).',
      `Submit before the deadline to claim 🪙 ${challenge.proReward} PRO Points.`,
    ];
  }

  return [
    `Deliver your project work matching the specifications for "${challenge.title}".`,
    'Upload your finished export to Cloud Storage, YouTube unlisted, Google Drive, or Loom.',
    'Include concise production notes explaining your workflow and key decisions.',
    `Submit your entry before the deadline to claim 🪙 ${challenge.proReward} PRO Points.`,
  ];
}

/**
 * Dynamically computes grading rubric breakdown proportional to the challenge's PRO points.
 */
function getChallengeRubric(challenge: ChallengeItem, courseTitle?: string) {
  const total = challenge.proReward || 50;
  const part1 = Math.round(total * 0.4);
  const part2 = Math.round(total * 0.3);
  const part3 = total - part1 - part2;

  const lowerTrack = (courseTitle || challenge.cohortTitle || '').toLowerCase();
  const isCoding =
    lowerTrack.includes('code') ||
    lowerTrack.includes('python') ||
    lowerTrack.includes('java') ||
    lowerTrack.includes('web') ||
    lowerTrack.includes('software');
  const is3D =
    lowerTrack.includes('motion') ||
    lowerTrack.includes('3d') ||
    lowerTrack.includes('blender') ||
    lowerTrack.includes('animation');

  if (isCoding) {
    return [
      { title: 'Core Functionality & Logic', pts: `${part1} Pts`, desc: 'Meets all functional specs and passes edge cases cleanly' },
      { title: 'Code Architecture & Quality', pts: `${part2} Pts`, desc: 'Modular structure, clean formatting, and clear comments' },
      { title: 'Documentation & Delivery', pts: `${part3} Pts`, desc: 'Working repository setup and clear usage instructions' },
    ];
  }

  if (is3D) {
    return [
      { title: 'Visual Fidelity & Composition', pts: `${part1} Pts`, desc: 'Lighting, materials, and overall aesthetic execution' },
      { title: 'Animation Timing & Curves', pts: `${part2} Pts`, desc: 'Fluid movement, pacing cadence, and realistic motion' },
      { title: 'Render Quality & Export Specs', pts: `${part3} Pts`, desc: 'Noise-free clean render and adherence to format specs' },
    ];
  }

  return [
    { title: 'Storytelling & Narrative Flow', pts: `${part1} Pts`, desc: 'Structural pacing and emotional clarity throughout' },
    { title: 'Audio & Visual Technique', pts: `${part2} Pts`, desc: 'Clean transitions, balanced sound, and polished visuals' },
    { title: 'Technical Polish & Export', pts: `${part3} Pts`, desc: 'Adherence to delivery requirements and clean output' },
  ];
}

export const LevelUpView: React.FC<LevelUpViewProps> = ({
  onClose,
  initialSubTab = 'dashboard',
  initialDate,
}) => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Dynamic enrolled students & XP Leaderboard state
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [initialCohortResolved, setInitialCohortResolved] = useState<boolean>(false);

  // Selected course details
  const selectedCourse = useMemo(() => {
    if (selectedCohortId === 'all') return null;
    return courses.find((c) => c.id === selectedCohortId) || null;
  }, [courses, selectedCohortId]);

  // Fetch user's enrolled courses (or fallback to available courses for guests / admins with 0 enrollments)
  useEffect(() => {
    let isMounted = true;
    async function loadCourses() {
      let enrolledCourses: CourseOption[] = [];
      if (user?.id) {
        enrolledCourses = await fetchUserEnrolledCourses(user.id);
        // Fallback for single cohort lookup if fetchUserEnrolledCourses returned empty
        if (enrolledCourses.length === 0) {
          const singleCohort = await fetchUserEnrolledCohort(user.id);
          if (singleCohort) {
            enrolledCourses = [{ id: singleCohort.id, title: singleCohort.title }];
          }
        }
      }

      // If user is enrolled in courses, ONLY list their enrolled courses in the dropdown!
      if (enrolledCourses.length > 0) {
        if (!isMounted) return;
        setCourses(enrolledCourses);

        // Preselect the first enrolled course if needed
        setSelectedCohortId((prev) => {
          if (prev === 'all' && enrolledCourses.length === 1) {
            return enrolledCourses[0].id;
          }
          if (prev !== 'all' && !enrolledCourses.some((c) => c.id === prev)) {
            return enrolledCourses[0].id;
          }
          return prev;
        });
        setInitialCohortResolved(true);
        return;
      }

      // Fallback: If user has 0 enrollments (e.g., admin exploring catalog, or guest), fetch available courses
      const courseList = await fetchAvailableCourses();
      if (!isMounted) return;
      setCourses(courseList);

      if (courseList.length > 0) {
        setSelectedCohortId((prev) => (prev === 'all' && courseList.length === 1 ? courseList[0].id : prev));
      }
      setInitialCohortResolved(true);
    }
    void loadCourses();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Fetch enrolled students and their live XP points whenever selected cohort changes
  useEffect(() => {
    let isMounted = true;
    async function loadMembers() {
      setLoadingMembers(true);
      const data = await fetchEnrolledLeaderboard(
        selectedCohortId !== 'all' ? selectedCohortId : undefined,
        user?.id
      );
      if (isMounted) {
        setMembers(data);
        setLoadingMembers(false);
      }
    }
    if (initialCohortResolved || selectedCohortId !== 'all') {
      loadMembers();
    }
    return () => {
      isMounted = false;
    };
  }, [selectedCohortId, user?.id, initialCohortResolved]);

  // Dynamic live today reference (defaults to real current Date)
  // Dynamic reference for Today (supports testing with initialDate or live clock)
  const [currentLiveDate, setCurrentLiveDate] = useState<Date>(() => initialDate || new Date());
  const today = currentLiveDate;
  const todayDateKey = useMemo(() => formatDateKey(today), [today]);

  // Midnight rollover listener: checks every 15s if local date has rolled over past 12:00 AM midnight
  useEffect(() => {
    if (initialDate) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (formatDateKey(now) !== formatDateKey(currentLiveDate)) {
        setCurrentLiveDate(now);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentLiveDate, initialDate]);

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

  // Dynamic Habits Calendar state based on live current date
  const [calendarDate, setCalendarDate] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [completedHabitDates, setCompletedHabitDates] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cutcraft_completed_habits');
      if (saved) {
        return new Set<string>(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    const initial = new Set<string>();
    // Pre-populate today and recent streak days dynamically
    for (let offset = 0; offset <= 7; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      initial.add(formatDateKey(d));
    }
    return initial;
  });

  // Sync completed habits to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cutcraft_completed_habits', JSON.stringify(Array.from(completedHabitDates)));
    } catch {
      // ignore
    }
  }, [completedHabitDates]);
  const todayHabitCompleted = completedHabitDates.has(todayDateKey);
  const [todayHabitDismissed, setTodayHabitDismissed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User's current rank data & dynamic points derived from real enrolled students
  const currentUserMember = members.find((m) => m.id === user?.id || m.isCurrentUser);
  const userRank = currentUserMember ? currentUserMember.rank : (members.length > 0 ? members.length + 1 : 1);
  const basePoints = currentUserMember ? currentUserMember.points : 0;
  const userPoints = basePoints + (todayHabitCompleted ? 10 : 0);
  const userDisplayName =
    profile?.full_name?.trim() ||
    currentUserMember?.name ||
    profile?.email?.split('@')[0] ||
    'Enrolled Student';
  const userInitials = (userDisplayName || 'ES')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Dynamic Challenges state per course (Zero hardcoded arrays, pure live database records)
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState<boolean>(true);
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'all' | 'completed' | 'upcoming'>('active');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const queryChallengeId = searchParams.get('challenge');
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeItem | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'brief' | 'assets' | 'submit' | 'peers'>('brief');
  const [submittedChallengeIds, setSubmittedChallengeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Joined challenges state (tracks whether current user has joined the challenge)
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);

  // Checkin Modal state (Matching user's reference image for Task check-in)
  const [showCheckinModal, setShowCheckinModal] = useState<boolean>(false);
  const [checkinScreenshotUrl, setCheckinScreenshotUrl] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [showCheckinSubmitForm, setShowCheckinSubmitForm] = useState(false);
  const [submittedCheckinIds, setSubmittedCheckinIds] = useState<string[]>([]);
  const [proTransactions, setProTransactions] = useState<ProHistoryTransaction[]>([]);
  const [challengeParticipants, setChallengeParticipants] = useState<ChallengeParticipantProfile[]>([]);
  const [challengeSubmissions, setChallengeSubmissions] = useState<ChallengeSubmissionDetail[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  // Load dynamic challenges whenever selectedCohortId or selected course changes
  useEffect(() => {
    let isMounted = true;
    async function loadChallenges() {
      setLoadingChallenges(true);
      const data = await fetchCourseChallenges(
        selectedCohortId !== 'all' ? selectedCohortId : undefined,
        selectedCourse?.title,
        user?.id
      );
      if (!isMounted) return;
      setChallenges(data);
      setLoadingChallenges(false);

      // Populate joined and submitted challenge ids from live relational records
      const joined = data.filter((c) => c.isJoined).map((c) => c.id);
      setJoinedChallengeIds(joined);
      const submitted = data.filter((c) => c.hasSubmitted).map((c) => c.id);
      setSubmittedChallengeIds(submitted);

      // Sync selected challenge if requested in URL
      if (queryChallengeId) {
        const found = data.find((c) => c.id === queryChallengeId);
        if (found) {
          setSelectedChallenge(found);
        }
      }
    }
    loadChallenges();
    return () => {
      isMounted = false;
    };
  }, [selectedCohortId, selectedCourse?.title, queryChallengeId, user?.id]);

  // Load real user PRO history transactions from Supabase
  useEffect(() => {
    if (user?.id) {
      void fetchUserProHistory(user.id).then(setProTransactions);
    }
  }, [user?.id]);

  // Load participants and submissions for the currently selected challenge
  useEffect(() => {
    if (selectedChallenge?.id) {
      void fetchChallengeParticipants(selectedChallenge.id).then(setChallengeParticipants);
      setLoadingSubmissions(true);
      void fetchChallengeSubmissions(selectedChallenge.id)
        .then((subs) => {
          setChallengeSubmissions(subs);
          if (user?.id && subs.some((s) => s.userId === user.id)) {
            setSubmittedChallengeIds((prev) => Array.from(new Set([...prev, selectedChallenge.id])));
          }
        })
        .finally(() => setLoadingSubmissions(false));
    } else {
      setChallengeParticipants([]);
      setChallengeSubmissions([]);
    }
  }, [selectedChallenge?.id, user?.id]);

  const handleJoinChallenge = (challengeId: string) => {
    void joinCourseChallenge(challengeId, user?.id);
    setJoinedChallengeIds((prev) => (prev.includes(challengeId) ? prev : [...prev, challengeId]));
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === challengeId
          ? {
              ...c,
              isJoined: true,
              participantsJoined: c.participantsJoined + 1,
              participants: [
                ...(c.participants || []),
                {
                  userId: user?.id || 'me',
                  fullName: userDisplayName,
                  avatarUrl: currentUserMember?.avatarUrl || (user?.user_metadata?.avatar_url as string | undefined),
                  joinedAt: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );
    setSelectedChallenge((prev) =>
      prev && prev.id === challengeId
        ? {
            ...prev,
            isJoined: true,
            participantsJoined: prev.participantsJoined + 1,
            participants: [
              ...(prev.participants || []),
              {
                userId: user?.id || 'me',
                fullName: userDisplayName,
                avatarUrl: currentUserMember?.avatarUrl || (user?.user_metadata?.avatar_url as string | undefined),
                joinedAt: new Date().toISOString(),
              },
            ],
          }
        : prev
    );
    setShowCheckinModal(true);
    setToastMessage('🎉 Successfully joined challenge! Check-ins are now unlocked.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    try {
      await leaveCourseChallenge(challengeId, user?.id);
    } catch (err) {
      console.warn('Failed to unjoin challenge from database:', err);
    }
    setJoinedChallengeIds((prev) => prev.filter((id) => id !== challengeId));
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === challengeId
          ? {
              ...c,
              isJoined: false,
              participantsJoined: Math.max(0, c.participantsJoined - 1),
              participants: c.participants ? c.participants.filter((p) => p.userId !== user?.id) : [],
            }
          : c
      )
    );
    setSelectedChallenge((prev) =>
      prev && prev.id === challengeId
        ? {
            ...prev,
            isJoined: false,
            participantsJoined: Math.max(0, prev.participantsJoined - 1),
            participants: prev.participants ? prev.participants.filter((p) => p.userId !== user?.id) : [],
          }
        : prev
    );
    setToastMessage('You have left the challenge.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSelectChallenge = (challenge: ChallengeItem | null) => {
    setSelectedChallenge(challenge);
    setShowCheckinModal(false);
    const newParams = new URLSearchParams(searchParams);
    if (challenge) {
      newParams.set('challenge', challenge.id);
    } else {
      newParams.delete('challenge');
    }
    setSearchParams(newParams);
  };

  const isSelectedChallengeJoined = selectedChallenge
    ? joinedChallengeIds.includes(selectedChallenge.id)
    : false;

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

  // Filter dynamic enrolled members
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

  // Dynamic Month title
  const currentMonthName = useMemo(() => {
    return calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarDate]);

  const handlePrevMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleToggleHabitDate = (dateKey: string) => {
    // 1. Upcoming days cannot be ticked in advance (disabled until 12:00 AM midnight)
    if (dateKey > todayDateKey) {
      setToastMessage(`⏳ Upcoming Day: Habits unlock at 12:00 AM midnight on ${dateKey}.`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    // 2. Past days cannot be modified (permanently locked once 12:00 AM midnight passes)
    if (dateKey < todayDateKey) {
      setToastMessage(`🔒 Day Ended at 12:00 AM: Past habit records are sealed and cannot be modified.`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    // 3. Today only: editable, awards or deducts points in real-time
    setCompletedHabitDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
        setToastMessage(`Today's habit marked incomplete (-10 PRO)`);
      } else {
        next.add(dateKey);
        setToastMessage(`🎉 Today's habit completed! +10 PRO Points earned.`);
      }
      return next;
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleTodayHabit = () => {
    handleToggleHabitDate(todayDateKey);
  };

  // Dynamic Calendar cells generation based on currently selected month and year
  const calendarCells = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      dateKey: string;
      dateNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
      isFuture: boolean;
      isCompleted: boolean;
      habitTitle: string;
    }[] = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateKey = formatDateKey(prevDate);

      cells.push({
        dateKey,
        dateNum: d,
        isCurrentMonth: false,
        isToday: dateKey === todayDateKey,
        isPast: dateKey < todayDateKey,
        isFuture: dateKey > todayDateKey,
        isCompleted: completedHabitDates.has(dateKey),
        habitTitle: 'EDIT for 20 minutes',
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateKey = formatDateKey(currDate);

      cells.push({
        dateKey,
        dateNum: d,
        isCurrentMonth: true,
        isToday: dateKey === todayDateKey,
        isPast: dateKey < todayDateKey,
        isFuture: dateKey > todayDateKey,
        isCompleted: completedHabitDates.has(dateKey),
        habitTitle: 'EDIT for 20 minutes',
      });
    }

    // Leading days from next month to complete standard grid (35 or 42 cells)
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remainingSlots = totalSlots - cells.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateKey = formatDateKey(nextDate);

      cells.push({
        dateKey,
        dateNum: d,
        isCurrentMonth: false,
        isToday: dateKey === todayDateKey,
        isPast: dateKey < todayDateKey,
        isFuture: dateKey > todayDateKey,
        isCompleted: completedHabitDates.has(dateKey),
        habitTitle: 'EDIT for 20 minutes',
      });
    }

    return cells;
  }, [calendarDate, completedHabitDates, todayDateKey]);

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
                        onClick={handleGoToToday}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        Today
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={handlePrevMonth}
                          aria-label="Previous Month"
                          title="Previous Month"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={handleNextMonth}
                          aria-label="Next Month"
                          title="Next Month"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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

                  {/* Monthly Grid Cells with Interactive Habit Checkboxes */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarCells.map((cell) => {
                      const isEditable = cell.isToday;
                      const isUpcoming = cell.isFuture;
                      const isPastDay = cell.isPast;

                      return (
                        <div
                          key={cell.dateKey}
                          onClick={() => handleToggleHabitDate(cell.dateKey)}
                          title={
                            isUpcoming
                              ? `Upcoming day (${cell.dateKey}) — Unlocks at 12:00 AM`
                              : isPastDay
                              ? `Past day (${cell.dateKey}) — Locked at 12:00 AM (${cell.isCompleted ? 'Completed' : 'Missed'})`
                              : `Today (${cell.dateKey}) — Click to toggle habit (+10 PRO Points)`
                          }
                          className={`min-h-[74px] sm:min-h-[84px] rounded-xl border p-1.5 sm:p-2 flex flex-col justify-between transition-all min-w-0 overflow-hidden ${
                            cell.isToday
                              ? 'border-amber-400 bg-amber-50/50 dark:border-amber-500/80 dark:bg-amber-950/25 shadow-xs ring-2 ring-amber-400/30 cursor-pointer hover:shadow-sm'
                              : isUpcoming
                              ? 'border-slate-150 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-950/30 opacity-60 cursor-not-allowed'
                              : cell.isCurrentMonth
                              ? 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 cursor-not-allowed opacity-90'
                              : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-950/30 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {/* Date Number Header */}
                          <div className="flex items-start justify-between gap-1 min-w-0">
                            {/* Left Badge Indicator (Moved up to align with top of date number) */}
                            <div className="min-w-0 flex items-center">
                              {cell.isToday ? (
                                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-slate-950 shadow-2xs shrink-0 inline-flex items-center leading-none">
                                  TODAY
                                </span>
                              ) : isUpcoming ? (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                                  <Lock size={10} />
                                  <span className="hidden sm:inline text-[8px]">12 AM</span>
                                </span>
                              ) : cell.isCompleted ? (
                                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 inline-flex items-center leading-none">
                                  ✓ Done
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-600 shrink-0 inline-block leading-none">
                                  Closed
                                </span>
                              )}
                            </div>

                            {/* Right Column: Date number (e.g. 24) on top, with +10 PRO placed below it */}
                            <div className="flex flex-col items-end shrink-0 leading-none">
                              <span
                                className={`text-xs font-bold leading-none ${
                                  cell.isToday
                                    ? 'text-amber-600 dark:text-amber-400 font-black'
                                    : cell.isCurrentMonth
                                    ? 'text-slate-700 dark:text-slate-300'
                                    : 'text-slate-400 dark:text-slate-600'
                                }`}
                              >
                                {cell.dateNum}
                              </span>
                              {cell.isToday && (
                                <span className="mt-1 rounded-xs bg-amber-500/20 px-1 py-0.5 text-[7.5px] sm:text-[8px] font-black text-amber-800 dark:text-amber-300 leading-none">
                                  +10 PRO
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Interactive Habit Badge with Checkbox */}
                          <label
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isEditable) {
                                handleToggleHabitDate(cell.dateKey);
                              }
                            }}
                            className={`rounded-md border p-1 sm:p-1.5 text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1.5 border-l-[3px] sm:border-l-4 select-none transition-all w-full min-w-0 overflow-hidden ${
                              cell.isToday
                                ? cell.isCompleted
                                  ? 'border-l-amber-500 border-amber-300 dark:border-amber-700/60 bg-amber-100/60 dark:bg-amber-900/40 text-amber-950 dark:text-amber-200 cursor-pointer shadow-2xs'
                                  : 'border-l-amber-400 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer hover:border-amber-400'
                                : isUpcoming
                                ? 'border-l-slate-300 dark:border-l-slate-700 border-slate-150 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
                                : cell.isCompleted
                                ? 'border-l-emerald-500 border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 cursor-not-allowed'
                                : 'border-l-slate-300 dark:border-l-slate-700 border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/40 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={cell.isCompleted}
                              disabled={!isEditable}
                              onChange={() => isEditable && handleToggleHabitDate(cell.dateKey)}
                              aria-label={`Habit checkbox for ${cell.dateKey}`}
                              className="sr-only"
                            />
                            <span
                              className={`flex size-3.5 sm:size-4 items-center justify-center rounded-xs transition-colors shrink-0 ${
                                cell.isToday
                                  ? cell.isCompleted
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                                    : 'border-2 border-amber-500 bg-white dark:bg-slate-800 hover:bg-amber-50'
                                  : isUpcoming
                                  ? 'border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 text-slate-400'
                                  : cell.isCompleted
                                  ? 'bg-emerald-500 text-white font-black'
                                  : 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-300'
                              }`}
                            >
                              {cell.isCompleted ? (
                                <Check size={11} className="stroke-[3]" />
                              ) : isUpcoming ? (
                                <Lock size={8} className="text-slate-400" />
                              ) : null}
                            </span>
                            <span className="truncate leading-tight flex-1 min-w-0">{cell.habitTitle}</span>
                          </label>
                        </div>
                      );
                    })}
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
                !isSelectedChallengeJoined ? (
                  /* =============================================================== */
                  /* PAGE FOR PERSON WHO IS YET TO JOIN (media_1790247422003.png)    */
                  /* =============================================================== */
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
                    {/* Back Navigation Link */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleSelectChallenge(null)}
                        aria-label="Back to challenges list"
                        className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition group"
                      >
                        <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                        <span>Back to challenges</span>
                      </button>
                    </div>

                    {/* Dark Hero Card Banner (Exact match to media_1790247422003.png) */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-[#0c0d12] text-white p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
                      <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Left Badge: 3D Laptop with Glowing Amber Border & PROJECT WEEK 3 */}
                        <div className="relative shrink-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 border border-amber-500/40 p-6 sm:p-7 shadow-[0_0_35px_rgba(245,158,11,0.18)] min-w-[210px]">
                          {/* Glowing Laptop SVG */}
                          <svg width="84" height="60" viewBox="0 0 84 60" fill="none" className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                            <rect x="14" y="6" width="56" height="38" rx="4" stroke="currentColor" strokeWidth="2.5" />
                            <rect x="22" y="12" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                            <polygon points="30,17 38,20 30,23" fill="currentColor" />
                            <line x1="48" y1="14" x2="62" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="48" y1="20" x2="58" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="48" y1="26" x2="62" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="22" y1="36" x2="62" y2="36" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="26" y1="33" x2="26" y2="39" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="34" y1="33" x2="34" y2="39" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="42" y1="33" x2="42" y2="39" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="50" y1="33" x2="50" y2="39" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="58" y1="33" x2="58" y2="39" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M4 46H80C81.1 46 82 46.9 82 48V49C82 50.1 81.1 51 80 51H4C2.9 51 2 50.1 2 49V48C2 46.9 2.9 46 4 46Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
                            <rect x="36" y="46" width="12" height="3" rx="1.5" fill="currentColor" />
                          </svg>

                          {/* Typography */}
                          <div className="mt-3 text-center">
                            <div className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">
                              {selectedChallenge.type}
                            </div>
                            <div className="text-sm sm:text-base font-black tracking-wider text-amber-300 uppercase">
                              {selectedChallenge.week}
                            </div>
                          </div>
                        </div>

                        {/* Right Details: Title, Dates, Participant Avatars */}
                        <div className="space-y-3 flex-1 text-center md:text-left">
                          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                            {selectedChallenge.title}
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-400 font-medium">
                            {selectedChallenge.startDate} - {selectedChallenge.endDate} • {selectedChallenge.durationLabel}
                          </p>

                          {/* Overlapping Participant Avatars */}
                          <div className="flex items-center justify-center md:justify-start -space-x-2 pt-1">
                            {challengeParticipants.length > 0 ? (
                              challengeParticipants.slice(0, 3).map((p, idx) => (
                                p.avatarUrl ? (
                                  <img
                                    key={p.userId || idx}
                                    src={p.avatarUrl}
                                    alt={p.fullName}
                                    className="size-8 rounded-full object-cover ring-2 ring-slate-900 shadow-xs"
                                  />
                                ) : (
                                  <div
                                    key={p.userId || idx}
                                    className={`flex size-8 items-center justify-center rounded-full text-[11px] font-black ring-2 ring-slate-900 text-slate-950 ${
                                      idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-blue-400' : 'bg-emerald-400'
                                    }`}
                                  >
                                    {p.fullName.slice(0, 2).toUpperCase()}
                                  </div>
                                )
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                Be the first participant to join
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Bar: Happening Now / Day 1 / Join CTA */}
                      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-2xl bg-black/50 border border-white/10 p-3 sm:p-4 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white shrink-0">
                            <Clock size={18} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Happening Now</span>
                              <span className="text-sm font-black text-white">{selectedChallenge.week}</span>
                            </div>
                            <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-xs font-black text-rose-400">
                              {formatChallengeCountdown(selectedChallenge.endDate)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <span>Join &amp; stand a chance to earn</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-black text-amber-300">
                              🪙 {selectedChallenge.proReward} PRO
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleJoinChallenge(selectedChallenge.id)}
                            className="rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-400 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                          >
                            Join Now
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content Card below Hero: Checkins & Description */}
                    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs space-y-8">
                      {/* Row 1: Checkins */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 pb-6 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="sm:w-36 shrink-0">
                          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                            {selectedChallenge.participantsJoined} {selectedChallenge.participantsJoined === 1 ? 'Checkin' : 'Checkins'}
                          </h3>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                              <Lock size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {selectedChallenge.title.replace(/^B\d+\s+W\d+\s+/, '')}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {selectedChallenge.startDate} - {selectedChallenge.endDate} • {selectedChallenge.durationLabel}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Description */}
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                        <div className="sm:w-36 shrink-0">
                          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                            Description
                          </h3>
                        </div>

                        <div className="flex-1 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          <p className="whitespace-pre-line">
                            {selectedChallenge.description?.trim() ||
                              `In this ${selectedChallenge.type.toLowerCase()} challenge, complete the assigned deliverables for "${selectedChallenge.title}". Once you click Join Now, the challenge brief, starter files, and submission workspace will unlock immediately.`}
                          </p>

                          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3">
                            <span className="text-lg">🔒</span>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-xs">
                                Check-ins and submissions are locked for non-participants
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Join the challenge to access deliverables, earn up to 🪙 {selectedChallenge.proReward} PRO Points, and get constructive mentor critique.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* =============================================================== */
                  /* Challenge Detail / Workspace Page (Joined Participants)         */
                  /* =============================================================== */
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
                      <button
                        type="button"
                        onClick={() => void handleLeaveChallenge(selectedChallenge.id)}
                        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-bold text-slate-500 hover:text-rose-500 hover:border-rose-400 transition cursor-pointer"
                        title="Leave this challenge"
                      >
                        Leave Challenge
                      </button>
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
                          {formatChallengeCountdown(selectedChallenge.endDate)}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                        {selectedChallenge.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400">
                        {selectedChallenge.cohortTitle || selectedCourse?.title || 'Cohort Challenge'} •{' '}
                        {selectedChallenge.description
                          ? selectedChallenge.description.length > 95
                            ? `${selectedChallenge.description.slice(0, 95)}...`
                            : selectedChallenge.description
                          : `${selectedChallenge.type} Challenge`}
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
                        {challengeSubmissions.length} {challengeSubmissions.length === 1 ? 'submission' : 'submissions'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {challengeSubmissions.length > 0 ? (
                        challengeSubmissions.slice(0, 3).map((sub, idx) => (
                          <div
                            key={sub.id || idx}
                            className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-3 hover:bg-slate-100/70 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-black text-slate-400 w-5 text-center shrink-0">
                                #{idx + 1}
                              </span>
                              {sub.avatarUrl ? (
                                <img
                                  src={sub.avatarUrl}
                                  alt={sub.fullName}
                                  className="size-8 rounded-full object-cover ring-2 ring-amber-400/40 shrink-0"
                                />
                              ) : (
                                <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-white font-black text-xs ring-2 ring-amber-400/40 shrink-0">
                                  {sub.fullName ? sub.fullName.slice(0, 2).toUpperCase() : 'ST'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {sub.fullName || 'Student'} {sub.userId === user?.id && <span className="text-amber-500 font-bold">(You)</span>}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Recent'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
                                🪙 {sub.score !== undefined && sub.score !== null ? `${sub.score} PRO` : `${selectedChallenge.proReward} PRO`}
                              </span>
                              <span className="text-base" title={idx === 0 ? 'Top Submission' : 'Submitted'}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '✅'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            No submissions yet for this challenge.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Be the first cohort member to submit and claim 🪙 {selectedChallenge.proReward} PRO Points!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation Sub-Tabs & Detailed Workspace */}
                  <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 overflow-x-auto gap-4">
                      {[
                        { id: 'brief', label: 'Brief & Instructions', icon: FileText },
                        { id: 'assets', label: 'Assets & Files', icon: Download },
                        { id: 'submit', label: 'Submit Entry', icon: Upload },
                        { id: 'peers', label: `Peer Submissions (${challengeSubmissions.length})`, icon: Trophy },
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
                            Challenge Objectives &amp; Brief
                          </h3>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedChallenge.description?.trim() ||
                              `In this ${selectedChallenge.type.toLowerCase()} challenge, complete the assigned deliverables for "${selectedChallenge.title}". Ensure your work adheres to cohort standards, passes validation, and is submitted before the deadline to receive mentor review and claim your PRO reward.`}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                            Deliverables &amp; Requirements
                          </h4>
                          <div className="space-y-2">
                            {getChallengeDeliverables(selectedChallenge, selectedCourse?.title).map((req, idx) => (
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
                          <span className="text-xs text-slate-500">Ready to upload your entry?</span>
                          <button
                            onClick={() => setActiveDetailTab('submit')}
                            className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-95 transition cursor-pointer"
                          >
                            Proceed to Submission →
                          </button>
                        </div>
                      </div>

                      {/* Right Sidebar: Dynamic Evaluation Rubric */}
                      <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          Grading Rubric ({selectedChallenge.proReward} Pts)
                        </h3>

                        <div className="space-y-3">
                          {getChallengeRubric(selectedChallenge, selectedCourse?.title).map((item, idx) => (
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

                  {/* Tab 2: Assets & Files */}
                  {activeDetailTab === 'assets' && (
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Challenge Starter Files &amp; Resources
                      </h3>
                      <p className="text-xs text-slate-500">
                        Download the files and project resources prepared for this challenge.
                      </p>

                      {selectedChallenge.assets && selectedChallenge.assets.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                          {selectedChallenge.assets.map((asset, i) => (
                            <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 flex flex-col justify-between">
                              <div>
                                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mb-2">
                                  <Download size={18} />
                                </span>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">{asset.title}</h4>
                                <p className="text-[10px] text-slate-400">{asset.type} • {asset.size}</p>
                              </div>
                              {asset.url && (
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition"
                                >
                                  <Download size={13} />
                                  <span>Open / Download Asset</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                            <Download size={20} />
                          </div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            No external asset downloads required
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            All necessary instructions and guidelines for this challenge are outlined in the Brief tab.
                          </p>
                          <button
                            onClick={() => setActiveDetailTab('brief')}
                            className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            View Brief &amp; Requirements →
                          </button>
                        </div>
                      )}
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
                          Submit your deliverable link or project files to unlock {selectedChallenge.proReward} PRO points and receive mentor review
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
                            className="rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-black dark:bg-white dark:text-slate-950 hover:bg-slate-800 transition cursor-pointer"
                          >
                            Return to Challenges
                          </button>
                        </div>
                      ) : (
                        <DynamicChallengeSubmissionBox
                          userId={user?.id || 'student-user'}
                          challengeId={selectedChallenge.id}
                          initialUrl=""
                          initialNotes=""
                          isExistingSubmission={submittedChallengeIds.includes(selectedChallenge.id)}
                          submitting={isSubmitting}
                          trackType={selectedCourse?.title?.toLowerCase().includes('code') ? 'coding' : 'video'}
                          studentName={userDisplayName}
                          cohortName={selectedCourse?.title || 'Creative Sprint'}
                          dayTitle={selectedChallenge.title}
                          onSubmit={async ({ submissionUrl: newUrl, notes: newNotes }) => {
                            setIsSubmitting(true);
                            try {
                              await submitCourseChallenge(
                                selectedChallenge.id,
                                user?.id || 'student-user',
                                newUrl,
                                newNotes
                              );
                              setSubmittedChallengeIds((prev) => Array.from(new Set([...prev, selectedChallenge.id])));
                              setToastMessage(`🎉 Entry Submitted! +${selectedChallenge.proReward} PRO Points Claimed!`);
                              if (user?.id) {
                                void fetchUserProHistory(user.id).then(setProTransactions);
                              }
                              void fetchChallengeSubmissions(selectedChallenge.id).then(setChallengeSubmissions);
                            } catch (err) {
                              console.warn('Submission record error:', err);
                              setSubmittedChallengeIds((prev) => Array.from(new Set([...prev, selectedChallenge.id])));
                              setToastMessage(`🎉 Entry Submitted! +${selectedChallenge.proReward} PRO Points Claimed!`);
                            } finally {
                              setIsSubmitting(false);
                            }
                            setTimeout(() => setToastMessage(null), 4000);
                          }}
                          onCancel={() => setActiveDetailTab('brief')}
                        />
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
                            Explore work submitted by fellow cohort members for this challenge
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {challengeSubmissions.length} {challengeSubmissions.length === 1 ? 'submission' : 'submissions'}
                        </span>
                      </div>

                      {loadingSubmissions ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                          <Loader2 className="size-5 animate-spin text-amber-500" />
                          <span className="text-xs font-semibold">Loading cohort submissions...</span>
                        </div>
                      ) : challengeSubmissions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                          {challengeSubmissions.map((sub, i) => (
                            <div
                              key={sub.id || i}
                              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-2.5">
                                  {sub.avatarUrl ? (
                                    <img
                                      src={sub.avatarUrl}
                                      alt={sub.fullName}
                                      className="size-8 rounded-full object-cover ring-2 ring-amber-400/30"
                                    />
                                  ) : (
                                    <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-white font-black text-xs ring-2 ring-amber-400/30">
                                      {sub.fullName ? sub.fullName.slice(0, 2).toUpperCase() : 'ST'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                      {sub.fullName || 'Student'}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Recently'}
                                    </p>
                                  </div>
                                </div>

                                {sub.notes && (
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 italic bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                    "{sub.notes}"
                                  </p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                                  {sub.score !== undefined && sub.score !== null ? `${sub.score} Pts` : sub.status}
                                </span>
                                {sub.submissionUrl && (
                                  <a
                                    href={sub.submissionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                                  >
                                    <span>View Entry</span>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            No peer submissions yet
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Be the first in your cohort to submit an entry and set the standard!
                          </p>
                          <button
                            onClick={() => setActiveDetailTab('submit')}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            Submit Your Entry →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )
              ) : (
                /* ================================================================= */
                /* Challenges 2.0 List Grid (Matching User Reference Image Exactly) */
                /* ================================================================= */
                <>
                  {/* Header with Title, Course Selector, Filter Dropdown, and Upload Challenge Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        Challenges
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedCourse
                          ? `Showing weekly challenges for ${selectedCourse.title}`
                          : 'Showing challenges across all enrolled tracks'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Course Selector Dropdown */}
                      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 shadow-2xs">
                        <BookOpen size={14} className="text-amber-500 shrink-0" />
                        <select
                          value={selectedCohortId}
                          onChange={(e) => setSelectedCohortId(e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer max-w-[170px] truncate"
                          aria-label="Filter challenges by enrolled course"
                        >
                          <option value="all">
                            {courses.length > 1 ? 'All Enrolled Courses' : 'All Tracks & Courses'}
                          </option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status Filter Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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

                      {/* Manage in Course Studio Link for Admins & Mentors */}
                      {(profile?.role === 'admin' || profile?.role === 'mentor') && (
                        <Link
                          to="/admin/courses"
                          className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                          title="Author, manage and upload course challenges in Course Studio"
                        >
                          <BookOpen size={13} className="text-amber-600 dark:text-amber-400" />
                          <span>Course Studio</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Loading State vs Empty State vs Challenge Cards Grid */}
                  {loadingChallenges && challenges.length === 0 ? (
                    <ChallengeListSkeleton count={3} />
                  ) : filteredChallenges.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4 bg-white/50 dark:bg-slate-900/40">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mx-auto">
                        <Upload size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          No Challenges Found for this Filter
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          There are no {challengeFilter !== 'all' ? challengeFilter : ''} challenges for{' '}
                          {selectedCourse ? selectedCourse.title : 'this course track'} yet.
                        </p>
                      </div>
                      {(profile?.role === 'admin' || profile?.role === 'mentor') ? (
                        <Link
                          to="/admin/courses"
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-slate-950 px-5 py-2.5 text-xs font-black shadow-md transition cursor-pointer"
                        >
                          <Upload size={14} />
                          <span>Manage Challenges in Course Studio</span>
                        </Link>
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">
                          Check back soon or switch course tracks using the filter above!
                        </p>
                      )}
                    </div>
                  ) : (
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
                                {/* Course Badge if viewing all courses */}
                                {challenge.cohortTitle && selectedCohortId === 'all' && (
                                  <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider block truncate">
                                    {challenge.cohortTitle}
                                  </span>
                                )}

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
                                    {challenge.participants && challenge.participants.length > 0 ? (
                                      challenge.participants.slice(0, 3).map((p, idx) =>
                                        p.avatarUrl ? (
                                          <img
                                            key={p.userId || idx}
                                            className="inline-block size-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                                            src={p.avatarUrl}
                                            alt={p.fullName}
                                          />
                                        ) : (
                                          <div
                                            key={p.userId || idx}
                                            className="flex size-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-[10px] font-black ring-2 ring-white dark:ring-slate-900"
                                          >
                                            {p.fullName.slice(0, 2).toUpperCase()}
                                          </div>
                                        )
                                      )
                                    ) : null}
                                  </div>
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {challenge.participantsJoined === 0
                                      ? 'Be the first to join'
                                      : `${challenge.participantsJoined} joined`}
                                  </span>
                                </div>
                              </div>

                              {/* Divider & Footer (Matching Screenshot Exactly) */}
                              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                                {joinedChallengeIds.includes(challenge.id) ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="flex size-2 rounded-full bg-emerald-500" />
                                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        Joined
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleLeaveChallenge(challenge.id);
                                      }}
                                      className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                      title="Leave challenge"
                                    >
                                      Leave
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">
                                      Join &amp; stand a chance to earn
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleJoinChallenge(challenge.id);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300 hover:bg-amber-100 active:scale-95 transition shadow-2xs cursor-pointer"
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
                  )}
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
                    <p className="text-[11px] text-slate-400">
                      {selectedCourse ? `Course: ${selectedCourse.title}` : 'Ranked by points'}
                    </p>
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

                {/* Course Selection Dropdown */}
                {courses.length > 0 && (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 p-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <BookOpen size={14} className="text-amber-500 shrink-0" />
                      <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
                        Course:
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {selectedCourse ? selectedCourse.title : 'All Courses'}
                      </span>
                    </div>
                    <select
                      value={selectedCohortId}
                      onChange={(e) => setSelectedCohortId(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                      aria-label="Filter leaderboard by enrolled course"
                    >
                      <option value="all">
                        {courses.length > 1 ? 'All Enrolled Courses' : 'All Courses'}
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                          {course.enrolledCount ? ` (${course.enrolledCount})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {userDisplayName}
                        </p>
                        <span className="inline-block rounded-sm bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black text-amber-800 dark:text-amber-300">
                          YOU
                        </span>
                      </div>
                      {currentUserMember?.cohortTitle && (
                        <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 truncate">
                          {currentUserMember.cohortTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-black text-amber-900 dark:text-amber-300">
                    {userPoints} PRO
                  </span>
                </div>

                {/* Top 3 Podium Highlights */}
                <div className="space-y-1.5 mb-3">
                  {loadingMembers ? (
                    <div className="py-4 text-center text-xs text-slate-400">Loading enrolled members...</div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">No enrolled students found</div>
                  ) : (
                    filteredMembers.slice(0, 3).map((member, idx) => {
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                      const borderBg =
                        idx === 0
                          ? 'border-yellow-200/80 bg-yellow-500/10 dark:border-yellow-600/30 dark:bg-yellow-500/5'
                          : idx === 1
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40'
                          : 'border-amber-200/60 bg-amber-700/5 dark:border-amber-800/30 dark:bg-amber-900/10';
                      const pointsColor =
                        idx === 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : idx === 1
                          ? 'text-slate-600 dark:text-slate-400'
                          : 'text-amber-700 dark:text-amber-500';

                      return (
                        <div
                          key={member.id}
                          className={`rounded-xl border ${borderBg} p-2.5 flex items-center justify-between transition`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{medal}</span>
                            <div className="min-w-0 truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {member.name}
                                </span>
                                {member.isCurrentUser && (
                                  <span className="rounded-sm bg-amber-500/20 px-1 py-0.2 text-[8px] font-black text-amber-800 dark:text-amber-300 shrink-0">
                                    YOU
                                  </span>
                                )}
                              </div>
                              {member.cohortTitle && selectedCohortId === 'all' && (
                                <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {member.cohortTitle}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-extrabold shrink-0 ${pointsColor}`}>
                            {member.points.toLocaleString()} PRO
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Scrollable Members List */}
                <div className="flex-1 overflow-y-auto max-h-72 space-y-1 pr-1">
                  {filteredMembers.length > 3 ? (
                    filteredMembers.slice(3).map((member) => (
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
                          <div className="min-w-0 truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                {member.name}
                              </span>
                              {member.isCurrentUser && (
                                <span className="rounded-sm bg-amber-500/20 px-1 py-0.2 text-[8px] font-black text-amber-800 dark:text-amber-300 shrink-0">
                                  YOU
                                </span>
                              )}
                            </div>
                            {member.cohortTitle && selectedCohortId === 'all' && (
                              <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {member.cohortTitle}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-black text-slate-800 dark:text-slate-200 shrink-0">
                          {member.points.toLocaleString()} PRO
                        </span>
                      </div>
                    ))
                  ) : null}
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
                {proTransactions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No points activity recorded yet.
                  </div>
                ) : (
                  proTransactions.map((tx) => (
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
                  ))
                )}
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
                      <span className="text-xs font-black text-rose-500">
                        {formatChallengeCountdown(selectedChallenge.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Step-by-Step Instructions */}
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 1 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Review the brief and requirements for <strong className="text-slate-900 dark:text-white">{selectedChallenge.title}</strong>
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 2 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedChallenge.assets && selectedChallenge.assets.length > 0 && selectedChallenge.assets[0].url ? (
                          <span>
                            Download the project starter files:{' '}
                            <a
                              href={selectedChallenge.assets[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 underline decoration-blue-400/50"
                            >
                              {selectedChallenge.assets[0].title || 'Download Asset'}
                            </a>
                          </span>
                        ) : (
                          <span>Prepare your project workspace and creative development environment</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 3 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Build and test your deliverable according to the grading rubric
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 4 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Export your final work, repository, or shared Cloud Drive folder
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white shrink-0">Step 5 :</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Submit your deliverable link or proof below to claim <strong className="text-amber-600 dark:text-amber-400 font-bold">🪙 {selectedChallenge.proReward} PRO Points</strong>
                      </span>
                    </div>
                  </div>

                  {/* Bottom Submission Link Notice */}
                  <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="font-black">Submission :</span> Upload the link or screenshot proof of your work{' '}
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
                            Deliverable / Proof URL *
                          </label>
                          <input
                            type="url"
                            value={checkinScreenshotUrl}
                            onChange={(e) => setCheckinScreenshotUrl(e.target.value)}
                            placeholder="https://drive.google.com/... or https://github.com/..."
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
                            placeholder="Deliverable details and notes..."
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
                            // Complete checkin with live database record
                            if (user?.id) {
                              void submitCourseChallenge(
                                selectedChallenge.id,
                                user.id,
                                checkinScreenshotUrl.trim() || 'https://drive.google.com/checkin-proof',
                                checkinNotes.trim() || undefined
                              ).then(() => {
                                void fetchChallengeSubmissions(selectedChallenge.id).then(setChallengeSubmissions);
                                void fetchUserProHistory(user.id).then(setProTransactions);
                              });
                            }
                            setSubmittedCheckinIds((prev) => Array.from(new Set([...prev, selectedChallenge.id])));
                            setSubmittedChallengeIds((prev) => Array.from(new Set([...prev, selectedChallenge.id])));
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
