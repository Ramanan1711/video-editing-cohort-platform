import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchNotification,
  sendCohortNotification,
  listUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../lib/notificationService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Notification Service: Event Dispatcher & Cohort Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dispatchNotification', () => {
    it('calls dispatch_notification RPC when available and returns generated id', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: 'notif-100',
        error: null,
      });

      const id = await dispatchNotification(
        'user-1',
        'Submission Received',
        'Your cut has been queued for mentor review.',
        'review',
        '/student/dashboard?tab=assignments'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('dispatch_notification', {
        p_user_id: 'user-1',
        p_title: 'Submission Received',
        p_body: 'Your cut has been queued for mentor review.',
        p_category: 'review',
        p_action_url: '/student/dashboard?tab=assignments',
      });
      expect(id).toBe('notif-100');
    });

    it('falls back to direct table insertion when RPC is unmigrated or fails', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function dispatch_notification does not exist' },
      });

      const singleMock = vi.fn().mockResolvedValueOnce({
        data: { id: 'notif-fallback-1' },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        insert: insertMock,
      });

      const id = await dispatchNotification(
        'user-2',
        'Critique Ready',
        'Mentor approved your cut.',
        'review'
      );

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-2',
        title: 'Critique Ready',
        body: 'Mentor approved your cut.',
        category: 'review',
        action_url: null,
      });
      expect(id).toBe('notif-fallback-1');
    });
  });

  describe('sendCohortNotification', () => {
    it('calls send_cohort_notification RPC with cohort scoping and returns dispatched count', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: 12,
        error: null,
      });

      const count = await sendCohortNotification({
        cohortId: 'cohort-alpha',
        title: 'Live Workshop in 30 Mins',
        body: 'Join the Zoom room for audio mastering.',
        category: 'deadline',
        actionUrl: '/workshops',
        targetRole: 'students',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('send_cohort_notification', {
        p_cohort_id: 'cohort-alpha',
        p_title: 'Live Workshop in 30 Mins',
        p_body: 'Join the Zoom room for audio mastering.',
        p_category: 'deadline',
        p_action_url: '/workshops',
        p_target_role: 'students',
      });
      expect(count).toBe(12);
    });

    it('falls back to querying cohort enrollments and mentor_cohorts on RPC failure', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function send_cohort_notification does not exist' },
      });

      // 1. Mock enrollments query
      const inMock = vi.fn().mockResolvedValueOnce({
        data: [{ user_id: 'student-1' }, { user_id: 'student-2' }],
      });
      const eqEnrollMock = vi.fn().mockReturnValue({ in: inMock });
      const selectEnrollMock = vi.fn().mockReturnValue({ eq: eqEnrollMock });

      // 2. Mock mentor_cohorts query (strictly scoped by cohort_id)
      const eqMentorMock = vi.fn().mockResolvedValueOnce({
        data: [{ mentor_id: 'mentor-10' }],
      });
      const selectMentorMock = vi.fn().mockReturnValue({ eq: eqMentorMock });

      // 3. Mock notifications batch insert
      const insertNotifMock = vi.fn().mockResolvedValueOnce({ error: null });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'enrollments') return { select: selectEnrollMock };
        if (table === 'mentor_cohorts') return { select: selectMentorMock };
        if (table === 'notifications') return { insert: insertNotifMock };
        return {};
      });

      const count = await sendCohortNotification({
        cohortId: 'cohort-beta',
        title: 'Timeline Sync Notice',
        body: 'New audio stems available.',
        category: 'system',
        targetRole: 'all',
      });

      expect(eqEnrollMock).toHaveBeenCalledWith('cohort_id', 'cohort-beta');
      expect(selectMentorMock).toHaveBeenCalledWith('mentor_id');
      expect(insertNotifMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'student-1', title: 'Timeline Sync Notice' }),
          expect.objectContaining({ user_id: 'student-2', title: 'Timeline Sync Notice' }),
          expect.objectContaining({ user_id: 'mentor-10', title: 'Timeline Sync Notice' }),
        ])
      );
      expect(count).toBe(3);
    });
  });

  describe('listUserNotifications, markNotificationAsRead & markAllNotificationsAsRead', () => {
    it('fetches notifications sorted descending by created_at', async () => {
      const orderMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'n-1',
            user_id: 'u-1',
            title: 'New Critique',
            body: 'Feedback on cut.',
            read_at: null,
            created_at: '2026-09-29T11:00:00Z',
          },
        ],
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: selectMock,
      });

      const notifs = await listUserNotifications('u-1');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'u-1');
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(notifs).toHaveLength(1);
    });

    it('marks an individual notification as read', async () => {
      const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        update: updateMock,
      });

      await markNotificationAsRead('n-1');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ read_at: expect.any(String) })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'n-1');
    });

    it('marks all unread notifications for a user as read', async () => {
      const isMock = vi.fn().mockResolvedValueOnce({ error: null });
      const eqMock = vi.fn().mockReturnValue({ is: isMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        update: updateMock,
      });

      await markAllNotificationsAsRead('u-1');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'u-1');
      expect(isMock).toHaveBeenCalledWith('read_at', null);
    });
  });
});
