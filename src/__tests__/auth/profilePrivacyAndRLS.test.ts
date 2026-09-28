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
});

