import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationCenter } from '../../components/NotificationCenter';
import * as notificationService from '../../lib/notificationService';
import type { StudentNotification } from '../../lib/courseService';

let channelSubscriptionCallback: ((status: string) => void) | null = null;
const mockChannelOn = vi.fn().mockReturnThis();
const mockChannelSubscribe = vi.fn().mockImplementation((cb) => {
  channelSubscriptionCallback = cb;
  return { unsubscribe: vi.fn() };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../lib/notificationService', () => ({
  listUserNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

describe('NotificationCenter - Realtime Reconnect & Window Focus Reconciliation', () => {
  const userId = 'student-test-user-42';

  const initialNotifications: StudentNotification[] = [
    {
      id: 'notif-1',
      user_id: userId,
      title: 'Mentor Feedback Published',
      body: 'Your Day 3 cut received detailed pacing critique.',
      category: 'review',
      action_url: '/student/dashboard?tab=reviews',
      read_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: 'notif-2',
      user_id: userId,
      title: 'Workshop Starts in 1 Hour',
      body: 'Color grading masterclass starts at 3 PM.',
      category: 'deadline',
      action_url: null,
      read_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    channelSubscriptionCallback = null;
    mockChannelOn.mockReturnThis();
    mockChannelSubscribe.mockImplementation((cb) => {
      channelSubscriptionCallback = cb;
      return { unsubscribe: vi.fn() };
    });
    vi.mocked(notificationService.listUserNotifications).mockResolvedValue([...initialNotifications]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders notification badge with accurate unread count on initial load', async () => {
    render(<NotificationCenter userId={userId} />);

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledWith(userId);
    });

    // 1 unread notification (notif-1)
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('triggers a reconciliation fetch for unread notifications on window focus event', async () => {
    render(<NotificationCenter userId={userId} />);

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(1);
    });

    const newReconciledNotifications: StudentNotification[] = [
      ...initialNotifications,
      {
        id: 'notif-3',
        user_id: userId,
        title: 'New Sprint Challenge Unlocked',
        body: 'Day 4 speed cutting sprint is now live.',
        category: 'deadline',
        action_url: '/student/dashboard',
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.mocked(notificationService.listUserNotifications).mockResolvedValueOnce(newReconciledNotifications);

    // Fast forward slightly past the 3-second throttle window
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

    // Simulate window focus event (e.g. mobile Wi-Fi restored, user refocuses browser)
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(2);
    });

    // Unread count updated from 1 to 2
    expect(await screen.findByText('2')).toBeInTheDocument();

    nowSpy.mockRestore();
  });

  it('triggers a reconciliation fetch when browser comes back online (network flap recovery)', async () => {
    render(<NotificationCenter userId={userId} />);

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(1);
    });

    const updatedNotifications: StudentNotification[] = [
      {
        ...initialNotifications[0],
        read_at: new Date().toISOString(),
      },
      initialNotifications[1],
    ];

    vi.mocked(notificationService.listUserNotifications).mockResolvedValueOnce(updatedNotifications);

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

    // Simulate network restoration event
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(2);
    });

    // Badge should disappear since unreadCount is now 0
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    nowSpy.mockRestore();
  });

  it('triggers a reconciliation fetch when document visibility changes to visible', async () => {
    render(<NotificationCenter userId={userId} />);

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(1);
    });

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(2);
    });

    nowSpy.mockRestore();
  });

  it('reconciles notifications when Supabase realtime channel reconnects with SUBSCRIBED status', async () => {
    render(<NotificationCenter userId={userId} />);

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(1);
    });

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

    // Simulate realtime channel reconnect status
    expect(channelSubscriptionCallback).toBeDefined();
    await act(async () => {
      channelSubscriptionCallback?.('SUBSCRIBED');
    });

    await waitFor(() => {
      expect(notificationService.listUserNotifications).toHaveBeenCalledTimes(2);
    });

    nowSpy.mockRestore();
  });
});
