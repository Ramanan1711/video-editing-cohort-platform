import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCohort,
  updateCohort,
  mentorCreateCohort,
  listCohorts,
} from '../../lib/services/curriculumService';
import { supabase } from '../../lib/supabaseClient';
import { queryCache } from '../../lib/queryCache';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Cohort Schedule & Duration Persistence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
  });

  describe('createCohort', () => {
    it('persists start_date, end_date, and duration_days into payload and maps them', async () => {
      const mockInserted = {
        id: 'cohort-123',
        title: 'Cinematic Editing Masterclass',
        description: 'Comprehensive 15-day sprint',
        status: 'draft',
        capacity: 35,
        visibility: 'public',
        enrollment_start: '2026-11-01T00:00:00.000Z',
        enrollment_end: '2026-11-10T23:59:59.000Z',
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-29T23:59:59.000Z',
        duration_days: 15,
        price_inr: 4999,
        currency: 'INR',
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockInserted, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await createCohort({
        name: 'Cinematic Editing Masterclass',
        description: 'Comprehensive 15-day sprint',
        capacity: 35,
        duration_days: 15,
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-29T23:59:59.000Z',
        enrollment_start: '2026-11-01T00:00:00.000Z',
        enrollment_end: '2026-11-10T23:59:59.000Z',
        price_inr: 4999,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cinematic Editing Masterclass',
          duration_days: 15,
          sprint_duration_days: 15,
          start_date: '2026-11-15T00:00:00.000Z',
          end_date: '2026-11-29T23:59:59.000Z',
        })
      );
      expect(result.start_date).toBe('2026-11-15T00:00:00.000Z');
      expect(result.end_date).toBe('2026-11-29T23:59:59.000Z');
      expect(result.duration_days).toBe(15);
    });
  });

  describe('updateCohort', () => {
    it('updates start_date, end_date, and duration_days', async () => {
      const mockUpdated = {
        id: 'cohort-123',
        title: 'Updated Cohort Schedule',
        start_date: '2026-12-01T00:00:00.000Z',
        end_date: '2026-12-30T23:59:59.000Z',
        duration_days: 30,
        price_inr: 4999,
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockUpdated, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await updateCohort('cohort-123', {
        name: 'Updated Cohort Schedule',
        duration_days: 30,
        start_date: '2026-12-01T00:00:00.000Z',
        end_date: '2026-12-30T23:59:59.000Z',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Cohort Schedule',
          duration_days: 30,
          sprint_duration_days: 30,
          start_date: '2026-12-01T00:00:00.000Z',
          end_date: '2026-12-30T23:59:59.000Z',
        })
      );
      expect(result.start_date).toBe('2026-12-01T00:00:00.000Z');
      expect(result.end_date).toBe('2026-12-30T23:59:59.000Z');
      expect(result.duration_days).toBe(30);
    });
  });

  describe('mentorCreateCohort', () => {
    it('creates draft proposal with start_date and end_date', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'mentor-123' } as any },
        error: null,
      });

      // Mock RPC fail so it uses table insert fallback
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('RPC not found'));

      const mockInserted = {
        id: 'cohort-mentor-1',
        title: 'Color Grading Masterclass',
        status: 'draft',
        duration_days: 21,
        start_date: '2026-11-20T00:00:00.000Z',
        end_date: '2026-12-10T23:59:59.000Z',
        created_by: 'mentor-123',
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockInserted, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return { insert: mockInsert } as any;
        }
        if (table === 'mentor_cohorts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        }
        return {} as any;
      });

      const result = await mentorCreateCohort({
        name: 'Color Grading Masterclass',
        duration_days: 21,
        start_date: '2026-11-20T00:00:00.000Z',
        end_date: '2026-12-10T23:59:59.000Z',
        price_inr: 4999,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Color Grading Masterclass',
          duration_days: 21,
          sprint_duration_days: 21,
          start_date: '2026-11-20T00:00:00.000Z',
          end_date: '2026-12-10T23:59:59.000Z',
          status: 'draft',
        })
      );
      expect(result.start_date).toBe('2026-11-20T00:00:00.000Z');
      expect(result.end_date).toBe('2026-12-10T23:59:59.000Z');
      expect(result.duration_days).toBe(21);
    });
  });

  describe('listCohorts', () => {
    it('retrieves cohorts and maps start_date and end_date', async () => {
      const mockRows = [
        {
          id: 'cohort-1',
          title: 'Premiere Pro Sprint',
          start_date: '2026-11-01T00:00:00.000Z',
          end_date: '2026-11-15T23:59:59.000Z',
          duration_days: 15,
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockRows, error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const cohorts = await listCohorts();
      expect(cohorts).toHaveLength(1);
      expect(cohorts[0].start_date).toBe('2026-11-01T00:00:00.000Z');
      expect(cohorts[0].end_date).toBe('2026-11-15T23:59:59.000Z');
      expect(cohorts[0].duration_days).toBe(15);
    });
  });
});

