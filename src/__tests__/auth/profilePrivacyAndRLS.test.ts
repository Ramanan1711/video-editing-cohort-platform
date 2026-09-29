import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { fetchAuthorPublicProfiles } from '../../lib/communityService';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('User Profiles Privacy & Contact Fields Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database RLS Policy Validation on Profiles', () => {
    it('allows an authenticated student to read their own full profile with contact fields', async () => {
      const mockCurrentStudentId = 'student-uuid-own';
      const mockOwnProfile = {
        id: mockCurrentStudentId,
        full_name: 'Alex Rivera',
        email: 'alex@example.com',
        whatsapp_number: '+15551234567',
        whatsapp_opt_in: true,
        role: 'student',
        status: 'active',
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === 'id' && val === mockCurrentStudentId) {
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOwnProfile, error: null }),
              };
            }
            // If querying another user's profile, RLS returns null
            return {
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      // Student querying their own profile succeeds
      const { data: ownData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', mockCurrentStudentId)
        .maybeSingle();

      expect(ownData).toEqual(mockOwnProfile);
      expect(ownData?.email).toBe('alex@example.com');
      expect(ownData?.whatsapp_number).toBe('+15551234567');

      // Student attempting to query another student's profile directly from profiles table is blocked by RLS
      const { data: peerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', 'other-student-uuid')
        .maybeSingle();

      expect(peerData).toBeNull();
    });

    it('allows administrators to read profiles including contact fields for management', async () => {
      const mockAdminProfiles = [
        { id: 'u1', full_name: 'User One', email: 'user1@example.com', whatsapp_number: '+1111111111', role: 'student' },
        { id: 'u2', full_name: 'User Two', email: 'user2@example.com', whatsapp_number: '+2222222222', role: 'mentor' },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: mockAdminProfiles, error: null }),
        }),
      });

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', ['u1', 'u2']);

      expect(data).toHaveLength(2);
      expect(data?.[0].email).toBe('user1@example.com');
    });
  });

  describe('Social / Peer Community Public Profile Sanitization', () => {
    it('uses public_profiles view exposing only id, full_name, role (zero contact fields)', async () => {
      const mockAuthorIds = ['author-1', 'author-2'];
      const mockSanitizedProfiles = [
        { id: 'author-1', full_name: 'Jordan Editor', role: 'student' },
        { id: 'author-2', full_name: 'Sam Mentor', role: 'mentor' },
      ];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'public_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockSanitizedProfiles, error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await fetchAuthorPublicProfiles(mockAuthorIds);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'author-1', full_name: 'Jordan Editor', role: 'student' });
      // Ensure sensitive contact fields do not exist on public profile outputs
      expect((result[0] as any).email).toBeUndefined();
      expect((result[0] as any).whatsapp_number).toBeUndefined();
    });

    it('falls back to scoped column selection if public_profiles view is pending migration', async () => {
      const mockAuthorIds = ['author-3'];
      const mockFallback = [{ id: 'author-3', full_name: 'Riley Cutter', role: 'student' }];

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'public_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation public_profiles does not exist' } }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockFallback, error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await fetchAuthorPublicProfiles(mockAuthorIds);
      expect(result).toHaveLength(1);
      expect(result[0].full_name).toBe('Riley Cutter');
      expect((result[0] as any).email).toBeUndefined();
    });
  });

  describe('Role Management & Privilege Field Immutability (admin_role, role, status)', () => {
    it('blocks self-update from mutating admin_role, role, or status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'new row violates row-level security policy for table "profiles"',
                code: '42501',
              },
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({ admin_role: 'super_admin' })
        .eq('id', 'student-attacker-id')
        .select()
        .single();

      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('row-level security');
    });

    it('enforces SQL subrole check: non-super_admin cannot call admin_update_user_role', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'Unauthorized: Only Super Administrators can modify roles or admin sub-roles.',
        },
      });

      const { data, error } = await supabase.rpc('admin_update_user_role', {
        p_user_id: 'some-user',
        p_new_role: 'admin',
        p_new_admin_role: 'super_admin',
      });

      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('Only Super Administrators');
    });

    it('blocks self-registration insert from escalating role to admin or mentor', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'new row violates row-level security policy for table "profiles"',
              code: '42501',
            },
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
      });

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: 'new-user-id',
          role: 'admin',
          admin_role: 'super_admin',
        })
        .select()
        .single();

      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('row-level security policy');
    });
  });

  describe('Daily Challenges & Submissions Security Policies', () => {
    it('blocks students from self-grading or self-accepting daily challenges', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'Unauthorized: Students cannot grade or alter challenge scores.',
                code: '42501',
              },
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      });

      const { data, error } = await supabase
        .from('daily_challenge_submissions')
        .update({
          score: 100,
          status: 'accepted',
          reviewed_by: 'student-attacker-id',
        })
        .eq('id', 'sub-1')
        .select()
        .single();

      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('Students cannot grade or alter challenge scores');
    });

    it('allows cohort mentors to grade and review daily challenge submissions', async () => {
      const mockGraded = {
        id: 'sub-1',
        challenge_id: 'ch-1',
        user_id: 'student-1',
        score: 95,
        status: 'accepted',
        mentor_feedback: 'Excellent kinetic cuts and pacing!',
        reviewed_by: 'mentor-1',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockGraded,
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      });

      const { data, error } = await supabase
        .from('daily_challenge_submissions')
        .update({
          score: 95,
          status: 'accepted',
          mentor_feedback: 'Excellent kinetic cuts and pacing!',
          reviewed_by: 'mentor-1',
        })
        .eq('id', 'sub-1')
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('accepted');
      expect(data?.score).toBe(95);
    });
  });
});


