import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Calendar,
  RotateCw,
  Info,
  MoreHorizontal,
  ExternalLink,
  Copy,
  CalendarPlus,
  Check,
  X,
} from 'lucide-react';
import { CommunityTopNav } from '../components/community/CommunityTopNav';
import { LevelUpModal } from '../components/community/LevelUpModal';
import {
  listStudentLiveSessions,
  type StudentLiveSession,
} from '../lib/courseService';

interface WorkshopItem {
  id: string;
  title: string;
  dateStr: string; // e.g. '2026-09-13'
  dateHeading: string; // e.g. 'Sep 13, 2026'
  timeRange: string; // e.g. '11:00 AM – 1:30 PM'
  platform: string; // e.g. 'Zoom Meeting'
  meetingUrl: string;
  status: 'upcoming' | 'completed';
  isLive?: boolean;
  description?: string;
  speaker?: string;
}

const DEFAULT_WORKSHOPS: WorkshopItem[] = [
  {
    id: 'ws-1',
    title: "B15 W3 MC's Live Session",
    dateStr: '2026-09-13',
    dateHeading: 'Sep 13, 2026',
    timeRange: '11:00 AM – 1:30 PM',
    platform: 'Zoom Meeting',
    meetingUrl: 'https://zoom.us',
    status: 'upcoming',
    isLive: false,
    description: 'Week 3 Masterclass: Kinetic typography, pacing drills, and live timeline critiques.',
    speaker: 'Shibin (Lead Mentor)',
  },
  {
    id: 'ws-2',
    title: "B15 W4 MC's Live Session",
    dateStr: '2026-09-20',
    dateHeading: 'Sep 20, 2026',
    timeRange: '11:00 AM – 1:30 PM',
    platform: 'Zoom Meeting',
    meetingUrl: 'https://zoom.us',
    status: 'upcoming',
    isLive: false,
    description: 'Week 4 Masterclass: Advanced sound design, audio bus routing, and SFX dynamics.',
    speaker: 'Meshak (Sound & Foley Artist)',
  },
  {
    id: 'ws-3',
    title: "B15 W5 MC's Live Session",
    dateStr: '2026-09-27',
    dateHeading: 'Sep 27, 2026',
    timeRange: '11:00 AM – 1:30 PM',
    platform: 'Zoom Meeting',
    meetingUrl: 'https://zoom.us',
    status: 'upcoming',
    isLive: false,
    description: 'Week 5 Masterclass: Client pitch simulations, commercial deliverables, and portfolio review.',
    speaker: 'Shibin & Guest Agency Director',
  },
  {
    id: 'ws-past-1',
    title: "B15 W2 MC's Live Session",
    dateStr: '2026-09-06',
    dateHeading: 'Sep 6, 2026',
    timeRange: '11:00 AM – 1:30 PM',
    platform: 'Zoom Meeting',
    meetingUrl: 'https://zoom.us/rec/w2',
    status: 'completed',
    isLive: false,
    description: 'Week 2 Masterclass: Color grading workflows, ACES color management, and tone curves.',
    speaker: 'Lead Colorist',
  },
  {
    id: 'ws-past-2',
    title: "B15 W1 MC's Live Session",
    dateStr: '2026-08-30',
    dateHeading: 'Aug 30, 2026',
    timeRange: '11:00 AM – 1:30 PM',
    platform: 'Zoom Meeting',
    meetingUrl: 'https://zoom.us/rec/w1',
    status: 'completed',
    isLive: false,
    description: 'Week 1 Masterclass: Foundation sprint, keyboard shortcut drills, and narrative arc setup.',
    speaker: 'Shibin (Lead Mentor)',
  },
];

export function WorkshopsPage() {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [workshops, setWorkshops] = useState<WorkshopItem[]>(DEFAULT_WORKSHOPS);
  const [loading, setLoading] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedInfoWorkshop, setSelectedInfoWorkshop] = useState<WorkshopItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Date filtering state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const loadLiveSessions = async () => {
    try {
      setLoading(true);
      const data: StudentLiveSession[] = await listStudentLiveSessions();
      if (data && data.length > 0) {
        const now = new Date();
        const mapped: WorkshopItem[] = data.map((s, idx) => {
          const dateObj = new Date(s.starts_at);
          const isPast = dateObj < now;

          const dateHeading = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          const startTimeStr = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          // 2.5 hour duration typical for workshops
          const endDateObj = new Date(dateObj.getTime() + 150 * 60 * 1000);
          const endTimeStr = endDateObj.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          return {
            id: s.id || `live-${idx}`,
            title: s.title,
            dateStr: dateObj.toISOString().slice(0, 10),
            dateHeading,
            timeRange: `${startTimeStr} – ${endTimeStr}`,
            platform: s.meeting_url?.toLowerCase().includes('zoom') ? 'Zoom Meeting' : 'Google Meet',
            meetingUrl: s.meeting_url || 'https://zoom.us',
            status: isPast ? 'completed' : 'upcoming',
            isLive: Math.abs(now.getTime() - dateObj.getTime()) < 120 * 60 * 1000,
            description: s.description || undefined,
          };
        });

        // Combine with fallback default items if fewer than 2 upcoming
        const combined = [...mapped];
        if (mapped.filter((w) => w.status === 'upcoming').length === 0) {
          combined.push(...DEFAULT_WORKSHOPS.filter((w) => w.status === 'upcoming'));
        }
        if (mapped.filter((w) => w.status === 'completed').length === 0) {
          combined.push(...DEFAULT_WORKSHOPS.filter((w) => w.status === 'completed'));
        }
        setWorkshops(combined);
      } else {
        setWorkshops(DEFAULT_WORKSHOPS);
      }
    } catch {
      setWorkshops(DEFAULT_WORKSHOPS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLiveSessions();
  }, []);

  // Filter workshops by sub-tab and optional date range
  const filteredWorkshops = useMemo(() => {
    return workshops
      .filter((w) => w.status === activeSubTab)
      .filter((w) => {
        if (startDateFilter && w.dateStr < startDateFilter) return false;
        if (endDateFilter && w.dateStr > endDateFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (activeSubTab === 'upcoming') {
          return a.dateStr.localeCompare(b.dateStr);
        }
        return b.dateStr.localeCompare(a.dateStr);
      });
  }, [workshops, activeSubTab, startDateFilter, endDateFilter]);

  // Group filtered workshops by date heading
  const groupedWorkshops = useMemo(() => {
    const groups: { heading: string; items: WorkshopItem[] }[] = [];
    const map = new Map<string, WorkshopItem[]>();

    for (const item of filteredWorkshops) {
      const existing = map.get(item.dateHeading);
      if (existing) {
        existing.push(item);
      } else {
        const arr = [item];
        map.set(item.dateHeading, arr);
        groups.push({ heading: item.dateHeading, items: arr });
      }
    }

    return groups;
  }, [filteredWorkshops]);

  const handleJoinOrWatch = (workshop: WorkshopItem) => {
    if (workshop.meetingUrl) {
      window.open(workshop.meetingUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = (workshop: WorkshopItem) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(workshop.meetingUrl);
      setCopiedId(workshop.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    setOpenMenuId(null);
  };

  const handleAddToCalendar = (workshop: WorkshopItem) => {
    const title = encodeURIComponent(workshop.title);
    const details = encodeURIComponent(workshop.description || 'ProCut Hub Cohort Live Session');
    const location = encodeURIComponent(workshop.meetingUrl);
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(gCalUrl, '_blank', 'noopener,noreferrer');
    setOpenMenuId(null);
  };

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Top Application Bar with Workshops active tab */}
      <CommunityTopNav
        activeTab="workshops"
        onTabChange={(tab) => {
          if (tab === 'community') navigate('/community?tab=feed');
          else if (tab === 'messages') navigate('/community?tab=messages');
          else if (tab === 'levelup') navigate('/community?tab=levelup');
          else if (tab === 'courses') navigate('/student/dashboard');
        }}
        onOpenLevelUpModal={() => setShowLevelUpModal(true)}
      />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-1">
        {/* Page Header matching reference image */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Workshops
            </h1>
          </div>

          {/* Right Controls: Date Range Filter Pill + Refresh Button */}
          <div className="flex items-center gap-3">
            {/* Date Range Filter Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold shadow-2xs transition ${
                  startDateFilter || endDateFilter
                    ? 'border-orange-300 bg-orange-50/80 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>
                  {startDateFilter || endDateFilter
                    ? `${startDateFilter || 'Start'} – ${endDateFilter || 'End'}`
                    : 'Start date – End date'}
                </span>
                <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
              </button>

              {/* Date Filter Dropdown */}
              {showDatePicker && (
                <div className="absolute right-0 mt-2 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Filter by Date
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStartDateFilter('');
                          setEndDateFilter('');
                          setShowDatePicker(false);
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sync & Refresh Button */}
            <button
              type="button"
              onClick={loadLiveSessions}
              title="Sync and refresh workshops"
              aria-label="Sync and refresh workshops"
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition active:scale-95"
            >
              <RotateCw size={15} className={loading ? 'animate-spin text-orange-500' : ''} />
            </button>
          </div>
        </div>

        {/* Sub-tabs: Upcoming vs Completed */}
        <div className="flex items-center gap-8 border-b border-slate-200/80 dark:border-slate-800 mt-6 mb-8">
          <button
            type="button"
            onClick={() => setActiveSubTab('upcoming')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeSubTab === 'upcoming'
                ? 'text-slate-950 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            Upcoming
            {activeSubTab === 'upcoming' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('completed')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeSubTab === 'completed'
                ? 'text-slate-950 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            Completed
            {activeSubTab === 'completed' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Workshops Grouped by Date */}
        {groupedWorkshops.length > 0 ? (
          <div className="space-y-8">
            {groupedWorkshops.map((group) => (
              <section key={group.heading}>
                {/* Date Heading matching screenshot (e.g. Sep 13, 2026) */}
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 mb-3.5 tracking-tight">
                  {group.heading}
                </h2>

                <div className="space-y-4">
                  {group.items.map((workshop) => (
                    <article
                      key={workshop.id}
                      className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-6 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                    >
                      {/* Left: Thumbnail & Session Info */}
                      <div className="flex items-center gap-5 sm:gap-6 min-w-0">
                        {/* Rounded Pale Green / Sage Placeholder with Video Icon */}
                        <div className="w-28 h-20 sm:w-36 sm:h-22 rounded-xl bg-[#eef1e6] dark:bg-slate-800/90 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                          <Video
                            size={24}
                            className="text-slate-400 dark:text-slate-400"
                            strokeWidth={1.75}
                          />
                        </div>

                        {/* Text Details */}
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white leading-snug line-clamp-1">
                            {workshop.title}
                          </h3>

                          {/* Time Range with Info Icon */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                            <span>{workshop.timeRange}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedInfoWorkshop(workshop)}
                              title="Session details"
                              aria-label="Session details"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            >
                              <Info size={13} strokeWidth={2.2} />
                            </button>
                          </div>

                          {/* Meeting Platform */}
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {workshop.platform}
                          </p>
                        </div>
                      </div>

                      {/* Right: Join Button & More Options */}
                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleJoinOrWatch(workshop)}
                          className={`rounded-full px-5 py-2 text-xs font-bold transition shadow-2xs active:scale-95 ${
                            workshop.isLive
                              ? 'bg-[#ea580c] hover:bg-orange-600 text-white shadow-sm'
                              : 'bg-[#faf6ef] hover:bg-[#f3ede1] text-[#977348] border border-[#f3e7d6] dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40'
                          }`}
                        >
                          {activeSubTab === 'completed' ? 'Watch Recording' : 'Join'}
                        </button>

                        {/* Options Menu Button (•••) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === workshop.id ? null : workshop.id)
                            }
                            title="More options"
                            aria-label="More options"
                            className="flex size-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuId === workshop.id && (
                            <div className="absolute right-0 mt-2 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(workshop)}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                {copiedId === workshop.id ? (
                                  <>
                                    <Check size={14} className="text-emerald-500" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    <span>Copy meeting link</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddToCalendar(workshop)}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <CalendarPlus size={14} />
                                <span>Add to Google Calendar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInfoWorkshop(workshop);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Info size={14} />
                                <span>View session info</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-20 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-6">
            <Video className="mx-auto size-10 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {activeSubTab === 'upcoming'
                ? 'No upcoming workshops scheduled'
                : 'No completed workshops yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {activeSubTab === 'upcoming'
                ? 'Check back soon for new live timeline breakdowns, masterclasses, and cohort critique sessions.'
                : 'Workshops you attend will appear here along with full recorded replay streams.'}
            </p>
            {(startDateFilter || endDateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="mt-4 text-xs font-bold text-orange-600 hover:text-orange-700 underline"
              >
                Clear date filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Workshop Details Modal (Triggered by ⓘ icon) */}
      {selectedInfoWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                  <Video size={17} />
                </span>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  Session Information
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfoWorkshop(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {selectedInfoWorkshop.title}
                </h4>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                  {selectedInfoWorkshop.dateHeading} • {selectedInfoWorkshop.timeRange}
                </p>
              </div>

              {selectedInfoWorkshop.description && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Agenda & Focus
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {selectedInfoWorkshop.description}
                  </p>
                </div>
              )}

              {selectedInfoWorkshop.speaker && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Session Lead / Host
                  </label>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {selectedInfoWorkshop.speaker}
                  </p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Platform
                </label>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {selectedInfoWorkshop.platform}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInfoWorkshop(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleJoinOrWatch(selectedInfoWorkshop)}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-xs font-bold shadow-sm"
                >
                  <span>Join Session</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Modal */}
      <LevelUpModal isOpen={showLevelUpModal} onClose={() => setShowLevelUpModal(false)} />
    </div>
  );
}
