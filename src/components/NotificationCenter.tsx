import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  LoaderCircle,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  listStudentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type StudentNotification,
} from '../lib/courseService';

interface NotificationCenterProps {
  userId: string;
}

export type NotificationTab = 'all' | 'reviews' | 'community' | 'deadlines' | 'unread';

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<NotificationTab>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listStudentNotifications(userId)
      .then((items) => {
        if (active) setNotifications(items);
      })
      .catch((err: unknown) => {
        console.warn('Failed to load notifications:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Realtime notification sync
    const channel = supabase
      .channel(`student-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'student_notifications',
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as StudentNotification;
          setNotifications((prev) => {
            if (prev.some((item) => item.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const refreshNotifications = () => {
    setLoading(true);
    listStudentNotifications(userId)
      .then((items) => setNotifications(items))
      .catch((err: unknown) => console.warn('Failed to load notifications:', err))
      .finally(() => setLoading(false));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.read_at);
      case 'reviews':
        return notifications.filter(
          (n) =>
            n.category === 'review' ||
            n.title.toLowerCase().includes('feedback') ||
            n.title.toLowerCase().includes('critique') ||
            n.title.toLowerCase().includes('grade') ||
            n.title.toLowerCase().includes('reviewed')
        );
      case 'community':
        return notifications.filter(
          (n) =>
            n.category === 'community' ||
            n.title.toLowerCase().includes('comment') ||
            n.title.toLowerCase().includes('reply') ||
            n.title.toLowerCase().includes('reaction')
        );
      case 'deadlines':
        return notifications.filter(
          (n) =>
            n.category === 'deadline' ||
            n.category === 'system' ||
            n.title.toLowerCase().includes('due') ||
            n.title.toLowerCase().includes('deadline') ||
            n.title.toLowerCase().includes('reminder')
        );
      case 'all':
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      setActionLoading(true);
      await markAllNotificationsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            refreshNotifications();
          }
        }}
        className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Open notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-extrabold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer / Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-950">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => void handleMarkAllRead()}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-orange-600 disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-100 px-3 pt-2 text-[11px] font-bold gap-1 scrollbar-none">
            {[
              { id: 'all' as const, label: 'All', count: notifications.length },
              {
                id: 'reviews' as const,
                label: 'Reviews',
                count: notifications.filter((n) => n.category === 'review' || n.title.toLowerCase().includes('feedback')).length,
              },
              {
                id: 'community' as const,
                label: 'Community',
                count: notifications.filter((n) => n.category === 'community' || n.title.toLowerCase().includes('comment')).length,
              },
              {
                id: 'deadlines' as const,
                label: 'Deadlines',
                count: notifications.filter((n) => n.category === 'deadline' || n.title.toLowerCase().includes('due')).length,
              },
              { id: 'unread' as const, label: 'Unread', count: unreadCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`pb-2 px-2 border-b-2 whitespace-nowrap transition ${
                  filter === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-slate-400">
                <LoaderCircle size={20} className="animate-spin text-orange-500" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications in this category'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const isRead = Boolean(notification.read_at);
                const category = notification.category || 'system';

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start justify-between gap-3 p-4 transition ${
                      isRead ? 'bg-white hover:bg-slate-50/80' : 'bg-orange-50/40 hover:bg-orange-50/70'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {!isRead && (
                          <span className="size-2 shrink-0 rounded-full bg-orange-500" />
                        )}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            category === 'review'
                              ? 'bg-emerald-100 text-emerald-800'
                              : category === 'community'
                              ? 'bg-violet-100 text-violet-800'
                              : category === 'deadline'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {category === 'review'
                            ? 'Review & Grade'
                            : category === 'community'
                            ? 'Community'
                            : category === 'deadline'
                            ? 'Deadline'
                            : 'Notification'}
                        </span>
                        <h4 className={`text-xs leading-tight truncate ${isRead ? 'font-bold text-slate-800' : 'font-black text-slate-950'}`}>
                          {notification.title}
                        </h4>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {notification.body}
                      </p>

                      {notification.action_url && (
                        <a
                          href={notification.action_url}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          <span>Open details</span>
                          <ExternalLink size={10} />
                        </a>
                      )}

                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock size={11} />
                        <span>{formatRelativeTime(notification.created_at)}</span>
                      </div>
                    </div>

                    {!isRead && (
                      <button
                        onClick={() => void handleMarkAsRead(notification.id)}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-orange-100 hover:text-orange-700"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Recently';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
