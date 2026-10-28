import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUserRegistrationStatus } from '../../lib/services/authRegistrationService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('authRegistrationService - checkUserRegistrationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty or malformed email addresses early without calling RPC', async () => {
    const emptyRes = await checkUserRegistrationStatus('');
    expect(emptyRes.isRegistered).toBe(false);
    expect(emptyRes.status).toBe('invalid_input');
    expect(supabase.rpc).not.toHaveBeenCalled();

    const invalidRes = await checkUserRegistrationStatus('not-an-email');
    expect(invalidRes.isRegistered).toBe(false);
    expect(invalidRes.status).toBe('invalid_input');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('identifies registered active user via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        is_registered: true,
        status: 'active',
        role: 'student',
        message: 'User account verified.',
      },
      error: null,
    } as any);

    const res = await checkUserRegistrationStatus('Student@Example.Com');

    expect(supabase.rpc).toHaveBeenCalledWith('check_user_registration_status', {
      p_email: 'student@example.com',
    });
    expect(res.isRegistered).toBe(true);
    expect(res.status).toBe('active');
    expect(res.role).toBe('student');
  });

  it('identifies unregistered user via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        is_registered: false,
        status: 'unregistered',
        message: 'No account found with this email address. Please check your email or register.',
      },
      error: null,
    } as any);

    const res = await checkUserRegistrationStatus('unknown@example.com');

    expect(supabase.rpc).toHaveBeenCalledWith('check_user_registration_status', {
      p_email: 'unknown@example.com',
    });
    expect(res.isRegistered).toBe(false);
    expect(res.status).toBe('unregistered');
    expect(res.message).toContain('No account found');
  });

  it('identifies suspended user account via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        is_registered: true,
        status: 'suspended',
        message: 'This account has been suspended. Please contact platform support.',
      },
      error: null,
    } as any);

    const res = await checkUserRegistrationStatus('banned@example.com');

    expect(res.isRegistered).toBe(true);
    expect(res.status).toBe('suspended');
    expect(res.message).toContain('suspended');
  });

  it('falls back gracefully to profiles table query if RPC throws an exception', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('RPC function not found on remote'));

    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: { id: 'prof-123', email: 'fallback@example.com', status: 'active', role: 'student' },
      error: null,
    });
    const mockIlike = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const res = await checkUserRegistrationStatus('fallback@example.com');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('id, email, status, role');
    expect(mockIlike).toHaveBeenCalledWith('email', 'fallback@example.com');
    expect(res.isRegistered).toBe(true);
    expect(res.status).toBe('active');
  });

  it('reports unregistered if fallback query yields no matching profile', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('RPC function not found'));

    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const mockIlike = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const res = await checkUserRegistrationStatus('ghost@example.com');

    expect(res.isRegistered).toBe(false);
    expect(res.status).toBe('unregistered');
  });
});

