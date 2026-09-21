import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Plus,
  Radio,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  listStudentCalendarEvents,
  createStudentStudyReminder,
  toggleStudyReminder,
  deleteStudentStudyReminder,
  type CalendarEvent,
} from '../lib/courseService';

interface StudentCalendarProps {
  userId: string;
  cohortId?: string | null;
}

export function StudentCalendar({ userId, cohortId }: StudentCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assignment' | 'live_session' | 'reminder'>('all');
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda');
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderDesc, setReminderDesc] = useState('');
  const [reminderType, setReminderType] = useState<'study_block' | 'assignment_prep' | 'review_session' | 'custom'>('study_block');
  const [savingReminder, setSavingReminder] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [nowTimestamp] = useState(() => Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    listStudentCalendarEvents(userId, cohortId || undefined)
      .then((data) => {
        if (active) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load events:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, cohortId, refreshKey]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDate) return;

    setSavingReminder(true);
    try {
      await createStudentStudyReminder({
        user_id: userId,
        cohort_id: cohortId || null,
        title: reminderTitle.trim(),
        description: reminderDesc.trim() || null,
        scheduled_at: new Date(reminderDate).toISOString(),
        reminder_type: reminderType,
        is_completed: false,
      });

      setShowAddReminder(false);
      setReminderTitle('');
      setReminderDate('');
      setReminderDesc('');
      setReminderType('study_block');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.warn('Failed to add study reminder:', err);
    } finally {
      setSavingReminder(false);
    }
  };

  const handleToggleReminder = async (id: string, isCompleted: boolean) => {
    // Optimistic update
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, isCompleted } : e)));
    try {
      await toggleStudyReminder(id, isCompleted, userId);
    } catch (err) {
      console.warn('Failed to toggle study reminder:', err);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteStudentStudyReminder(id, userId);
    } catch (err) {
      console.warn('Failed to delete reminder:', err);
      setRefreshKey((k) => k + 1);
    }
  };

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const urgentDeadlines = useMemo(() => {
    return events.filter((e) => {
      if (e.type !== 'assignment') return false;
      if (e.status === 'reviewed') return false;
      const t = new Date(e.date).getTime();
      const diffHours = (t - nowTimestamp) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 48;
    });
  }, [events, nowTimestamp]);

  // Export event as .ics
  const downloadIcs = (event: CalendarEvent) => {
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CUT CRAFT Cohort//Student Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@cutcraft.platform`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      event.actionUrl ? `URL:${event.actionUrl}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.slice(0, 20).replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Month grid calculations
  const monthYearStr = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();

  const handlePrevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header Toolbar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Master Schedule</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Student Studio Calendar</h2>
          <p className="mt-1 text-xs text-slate-500">
            Track assignment deadlines, mentor review rooms, live streams, and study checkpoints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold">
            <button
              onClick={() => setViewMode('agenda')}
              className={`rounded-lg px-3 py-1.5 transition ${
                viewMode === 'agenda' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Agenda
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`rounded-lg px-3 py-1.5 transition ${
                viewMode === 'month' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Month Grid
            </button>
          </div>

          <Button size="sm" onClick={() => setShowAddReminder(true)}>
            <Plus size={14} /> Add Reminder
          </Button>
        </div>
      </div>

      {/* Urgent Deadlines Alert Banner (<48h) */}
      {urgentDeadlines.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs text-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-amber-950">
                    Urgent Submission Window ({urgentDeadlines.length} {urgentDeadlines.length === 1 ? 'task' : 'tasks'} due &lt;48h)
                  </h4>
                  <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                    Priority Alert
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800">
                  {urgentDeadlines.map((task) => {
                    const hoursLeft = Math.max(1, Math.round((new Date(task.date).getTime() - nowTimestamp) / (1000 * 60 * 60)));
                    return (
                      <span key={task.id} className="inline-flex items-center gap-1 font-semibold">
                        • <strong className="text-amber-950">{task.title}</strong> (due in ~{hoursLeft} hrs)
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setFilter('assignment')}
                className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100/60"
              >
                Focus Deadlines
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Badges */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-xl px-3 py-1.5 transition ${
            filter === 'all'
              ? 'bg-orange-500 text-white shadow-2xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Items ({events.length})
        </button>
        <button
          onClick={() => setFilter('assignment')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
            filter === 'assignment'
              ? 'bg-orange-500 text-white shadow-2xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BookOpen size={13} /> Deadlines ({events.filter((e) => e.type === 'assignment').length})
        </button>
        <button
          onClick={() => setFilter('live_session')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
            filter === 'live_session'
              ? 'bg-orange-500 text-white shadow-2xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Radio size={13} /> Live Streams ({events.filter((e) => e.type === 'live_session').length})
        </button>
        <button
          onClick={() => setFilter('reminder')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
            filter === 'reminder'
              ? 'bg-orange-500 text-white shadow-2xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bell size={13} /> Personal Reminders ({events.filter((e) => e.type === 'reminder').length})
        </button>
      </div>

      {/* VIEW: Agenda List */}
      {viewMode === 'agenda' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-white border border-slate-200/60" />
              ))}
            </div>
          ) : filteredEvents.length ? (
            filteredEvents.map((item) => {
              const eventDate = new Date(item.date);
              const isPast = eventDate.getTime() < nowTimestamp;

              return (
                <Card
                  key={item.id}
                  className="flex flex-col justify-between gap-4 p-5 transition hover:border-slate-300 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        item.type === 'assignment'
                          ? 'bg-orange-100 text-orange-600'
                          : item.type === 'live_session'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {item.type === 'assignment' ? (
                        <BookOpen size={18} />
                      ) : item.type === 'live_session' ? (
                        <Radio size={18} />
                      ) : (
                        <Bell size={18} />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.type === 'reminder' && (
                          <button
                            type="button"
                            onClick={() => void handleToggleReminder(item.id, !item.isCompleted)}
                            className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition ${
                              item.isCompleted
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 bg-white text-transparent hover:border-orange-500'
                            }`}
                            title={item.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            <Check size={12} className="stroke-[3]" />
                          </button>
                        )}
                        <h4
                          className={`text-sm font-black transition ${
                            item.type === 'reminder' && item.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-950'
                          }`}
                        >
                          {item.title}
                        </h4>
                        {item.type === 'reminder' && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.isCompleted
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-orange-50 text-orange-700'
                            }`}
                          >
                            {item.isCompleted
                              ? '✓ Done'
                              : item.reminderType === 'assignment_prep'
                              ? 'Rough Cut Prep'
                              : item.reminderType === 'review_session'
                              ? 'Critique Review'
                              : item.reminderType === 'study_block'
                              ? 'Study Block'
                              : 'Study Milestone'}
                          </span>
                        )}
                        {item.type === 'assignment' && item.status && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.status === 'reviewed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.status === 'pending'
                                ? 'bg-blue-100 text-blue-700'
                                : item.status === 'resubmit'
                                ? 'bg-amber-100 text-amber-800'
                                : isPast
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status === 'reviewed'
                              ? '✓ Completed'
                              : item.status === 'pending'
                              ? 'Under Review'
                              : item.status === 'resubmit'
                              ? 'Revision Needed'
                              : isPast
                              ? 'Overdue'
                              : 'Pending Submission'}
                          </span>
                        )}
                        {item.type === 'live_session' && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              !isPast ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {!isPast ? 'Upcoming Stream' : 'Concluded'}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2 max-w-xl">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-400">
                        <span className="flex items-center gap-1 text-slate-600">
                          <CalendarIcon size={12} className="text-orange-500" />
                          {eventDate.toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock size={12} className="text-orange-500" />
                          {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    {item.actionUrl && (
                      <a
                        href={item.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-orange-600 transition"
                      >
                        <span>Join Room</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      onClick={() => downloadIcs(item)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:text-slate-900 transition"
                      title="Download .ics Calendar Event"
                      aria-label="Download calendar event"
                    >
                      <Download size={15} />
                    </button>
                    {item.type === 'reminder' && (
                      <button
                        onClick={() => handleDeleteReminder(item.id)}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Delete reminder"
                        aria-label="Delete reminder"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-10 text-center text-slate-400">
              <CalendarIcon size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No scheduled events found</p>
              <p className="mt-1 text-xs text-slate-400">
                You can add personal editing milestones or check back for upcoming live reviews.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* VIEW: Month Grid */}
      {viewMode === 'month' && (
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-950">{monthYearStr}</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400 mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-20 rounded-xl bg-slate-50/50 p-1" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = filteredEvents.filter((e) => e.date.startsWith(dateStr));
              const isToday = new Date().toISOString().startsWith(dateStr);

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-20 rounded-xl border p-1.5 transition text-left flex flex-col justify-between ${
                    isToday ? 'border-orange-400 bg-orange-50/20' : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block text-[11px] font-bold ${
                      isToday ? 'text-orange-600 font-black' : 'text-slate-600'
                    }`}
                  >
                    {dayNum}
                  </span>
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => downloadIcs(ev)}
                        className={`truncate rounded px-1.5 py-0.5 text-[9px] font-bold cursor-pointer transition ${
                          ev.type === 'assignment'
                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            : ev.type === 'live_session'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                        title={`${ev.title} (Click to download .ics)`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="block text-[9px] font-bold text-slate-400">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add Reminder Modal */}
      {showAddReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleAddReminder}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-orange-500" />
                <h3 className="text-base font-black text-slate-950">Add Personal Study Reminder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddReminder(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Reminder Category
                <select
                  value={reminderType}
                  onChange={(e) => setReminderType(e.target.value as typeof reminderType)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400 font-medium"
                >
                  <option value="study_block">📚 Study Block / Deep Work</option>
                  <option value="assignment_prep">✂️ Assignment Rough Cut &amp; Assembly</option>
                  <option value="review_session">🎯 Mentor Critique &amp; Rubric Review</option>
                  <option value="custom">⚡ General Editing Milestone</option>
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Reminder Title
                <input
                  type="text"
                  required
                  placeholder="e.g., Complete color grading pass for scene 2"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Target Date &amp; Time
                <input
                  type="datetime-local"
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Notes / Checklist (Optional)
                <textarea
                  rows={3}
                  placeholder="Key items to wrap up before exporting..."
                  value={reminderDesc}
                  onChange={(e) => setReminderDesc(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-orange-400 resize-none"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowAddReminder(false)} disabled={savingReminder}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={savingReminder}>
                <Check size={14} /> Save Reminder
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
