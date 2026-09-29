import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listAnnouncements,
  listAnnouncementsPaged,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../lib/adminService';
import { listStudentAnnouncements } from '../../lib/courseService';
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

describe('Announcements Service & Cohort Targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'audit_logs') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });
  });

  describe('createAnnouncement', () => {
    it('successfully calls publish_announcement RPC with cohort targeting and returns record', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'ann-1',
          author_id: 'admin-1',
          cohort_id: 'cohort-100',
          title: 'Color Grading Masterclass Live Rushes',
          body: 'The raw RED footage and CDLs for Week 3 are now uploaded.',
          published: true,
          created_at: '2026-09-29T11:00:00Z',
        },
        error: null,
      });

      const result = await createAnnouncement(
        'admin-1',
        'Color Grading Masterclass Live Rushes',
        'The raw RED footage and CDLs for Week 3 are now uploaded.',
        'cohort-100'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('publish_announcement', {
        p_title: 'Color Grading Masterclass Live Rushes',
        p_body: 'The raw RED footage and CDLs for Week 3 are now uploaded.',
        p_cohort_id: 'cohort-100',
        p_published: true,
      });
      expect(result.id).toBe('ann-1');
      expect(result.cohort_id).toBe('cohort-100');
    });

    it('passes null cohort_id for platform broadcasts', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'ann-2',
          author_id: 'admin-1',
          cohort_id: null,
          title: 'Platform Maintenance Notice',
          body: 'Scheduled maintenance will occur tonight at 02:00 UTC.',
          published: true,
          created_at: '2026-09-29T11:00:00Z',
        },
        error: null,
      });

      const result = await createAnnouncement(
        'admin-1',
        'Platform Maintenance Notice',
        'Scheduled maintenance will occur tonight at 02:00 UTC.',
        null
      );

      expect(supabase.rpc).toHaveBeenCalledWith('publish_announcement', {
        p_title: 'Platform Maintenance Notice',
        p_body: 'Scheduled maintenance will occur tonight at 02:00 UTC.',
        p_cohort_id: null,
        p_published: true,
      });
      expect(result.cohort_id).toBeNull();
    });

    it('gracefully falls back to direct table insertion when publish_announcement RPC is not deployed', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function publish_announcement does not exist' },
      });

      const singleMock = vi.fn().mockResolvedValueOnce({
        data: {
          id: 'ann-3',
          author_id: 'admin-1',
          cohort_id: 'cohort-200',
          title: 'Sound Design Stems Released',
          body: 'Pro Tools session templates are available.',
          published: true,
          created_at: '2026-09-29T11:00:00Z',
        },
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'announcements') {
          return { insert: insertMock };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const result = await createAnnouncement(
        'admin-1',
        'Sound Design Stems Released',
        'Pro Tools session templates are available.',
        'cohort-200'
      );

      expect(insertMock).toHaveBeenCalledWith({
        author_id: 'admin-1',
        cohort_id: 'cohort-200',
        title: 'Sound Design Stems Released',
        body: 'Pro Tools session templates are available.',
        published: true,
      });
      expect(result.id).toBe('ann-3');
      expect(result.cohort_id).toBe('cohort-200');
    });
  });

  describe('updateAnnouncement & deleteAnnouncement', () => {
    it('updates announcement with cohort_id targeting', async () => {
      const singleMock = vi.fn().mockResolvedValueOnce({
        data: {
          id: 'ann-1',
          author_id: 'admin-1',
          cohort_id: 'cohort-300',
          title: 'Updated Title',
          body: 'Updated body text here.',
          published: true,
          created_at: '2026-09-29T11:00:00Z',
        },
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'announcements') {
          return { update: updateMock };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const res = await updateAnnouncement('ann-1', {
        title: 'Updated Title',
        body: 'Updated body text here.',
        cohort_id: 'cohort-300',
      });

      expect(updateMock).toHaveBeenCalledWith({
        title: 'Updated Title',
        body: 'Updated body text here.',
        cohort_id: 'cohort-300',
      });
      expect(eqMock).toHaveBeenCalledWith('id', 'ann-1');
      expect(res.cohort_id).toBe('cohort-300');
    });

    it('deletes announcement by id', async () => {
      const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'announcements') {
          return { delete: deleteMock };
        }
        if (table === 'audit_logs') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      await expect(deleteAnnouncement('ann-1')).resolves.not.toThrow();
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 'ann-1');
    });
  });

  describe('listAnnouncements & listAnnouncementsPaged', () => {
    it('fetches announcements with cohort_id included', async () => {
      const orderMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'ann-1',
            author_id: 'admin-1',
            cohort_id: 'cohort-100',
            title: 'Cohort Ann',
            body: 'Body text',
            published: true,
            created_at: '2026-09-29T11:00:00Z',
          },
          {
            id: 'ann-2',
            author_id: 'admin-1',
            cohort_id: null,
            title: 'Global Ann',
            body: 'Body text 2',
            published: true,
            created_at: '2026-09-29T10:00:00Z',
          },
        ],
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: selectMock,
      });

      const announcements = await listAnnouncements();
      expect(announcements).toHaveLength(2);
      expect(announcements[0].cohort_id).toBe('cohort-100');
      expect(announcements[1].cohort_id).toBeNull();
    });

    it('lists paginated announcements', async () => {
      const rangeMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'ann-1',
            author_id: 'admin-1',
            cohort_id: 'cohort-100',
            title: 'Paged Ann',
            body: 'Body',
            published: true,
            created_at: '2026-09-29T11:00:00Z',
          },
        ],
        count: 1,
        error: null,
      });
      const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: selectMock,
      });

      const paged = await listAnnouncementsPaged({ page: 1, pageSize: 10 });
      expect(paged.totalCount).toBe(1);
      expect(paged.data[0].cohort_id).toBe('cohort-100');
    });
  });

  describe('listStudentAnnouncements', () => {
    it('scopes query to specific cohort OR platform broadcast when cohortId is provided', async () => {
      const orMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'ann-1',
            cohort_id: 'cohort-42',
            title: 'Sprint 2 Milestone',
            body: 'Upload cuts by Friday.',
            created_at: '2026-09-29T11:00:00Z',
          },
          {
            id: 'ann-2',
            cohort_id: null,
            title: 'Platform Broadcast',
            body: 'New grading tools live!',
            created_at: '2026-09-29T10:00:00Z',
          },
        ],
        error: null,
      });

      const orderMock = vi.fn().mockReturnValue({ or: orMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: selectMock,
      });

      const list = await listStudentAnnouncements('cohort-42');
      expect(orMock).toHaveBeenCalledWith('cohort_id.is.null,cohort_id.eq.cohort-42');
      expect(list).toHaveLength(2);
      expect(list[0].cohort_id).toBe('cohort-42');
      expect(list[1].cohort_id).toBeNull();
    });

    it('queries published announcements without cohort filter if cohortId is omitted', async () => {
      const orderMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'ann-1',
            cohort_id: null,
            title: 'Welcome All',
            body: 'Welcome to the platform.',
            created_at: '2026-09-29T09:00:00Z',
          },
        ],
        error: null,
      });

      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: selectMock,
      });

      const list = await listStudentAnnouncements();
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Welcome All');
    });
  });
});
