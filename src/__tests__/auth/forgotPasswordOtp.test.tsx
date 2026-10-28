import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPassword } from '../../pages/ForgotPassword';
import { supabase } from '../../lib/supabaseClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

vi.mock('../../lib/soundFx', () => ({
  soundFx: {
    playSweep: vi.fn(),
    playChime: vi.fn(),
    playBlip: vi.fn(),
    playClick: vi.fn(),
    isEnabled: vi.fn(() => false),
    toggle: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

describe('ForgotPassword.tsx - 6-Digit OTP Recovery Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: editor@example.com is a verified registered active user
    (supabase.rpc as any).mockImplementation(async (proc: string, args: any) => {
      if (proc === 'check_user_registration_status') {
        const email = args?.p_email?.toLowerCase();
        if (email === 'unregistered@example.com') {
          return {
            data: {
              is_registered: false,
              status: 'unregistered',
              message: 'No account found with this email address. Please check your email or register.',
            },
            error: null,
          } as any;
        }
        if (email === 'suspended@example.com') {
          return {
            data: {
              is_registered: true,
              status: 'suspended',
              message: 'This account has been suspended. Please contact platform support.',
            },
            error: null,
          } as any;
        }
        return {
          data: {
            is_registered: true,
            status: 'active',
            message: 'User account verified.',
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });
  });

  it('submits email and transitions to 6-digit OTP recovery screen', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email address/i);
    fireEvent.change(emailInput, { target: { value: 'editor@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Send Recovery Code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'editor@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password'),
        })
      );
      expect(screen.getByText(/Verify recovery code/i)).toBeInTheDocument();
      expect(screen.getByText(/editor@example.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/6-digit verification code/i)).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('verifies 6-digit code via supabase.auth.verifyOtp (type: recovery) and redirects to /reset-password', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-recover-1', email: 'editor@example.com' },
        session: { access_token: 'valid-recovery-session', refresh_token: 'refresh-tok' },
      },
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    // Initial email submission
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Recovery Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Verify recovery code/i)).toBeInTheDocument();
    });

    // Enter 6-digit code
    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '987654',
      },
    });

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'editor@example.com',
        token: '987654',
        type: 'recovery',
      });
      expect(screen.getByText(/Code verified! Redirecting to set your new password.../i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/reset-password');
    }, { timeout: 1500 });
  });

  it('displays user-friendly error message when OTP is invalid or expired', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired' },
    } as any);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Recovery Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Verify recovery code/i)).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '111111',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/This recovery code has expired/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('allows user to resend code and switches to countdown timer', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Recovery Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Verify recovery code/i)).toBeInTheDocument();
    });

    // Check resend button is in cooldown state
    const resendBtn = screen.getByRole('button', { name: /Resend in/i });
    expect(resendBtn).toBeDisabled();

    // Allows returning to initial email view
    const changeEmailBtn = screen.getByRole('button', { name: /Try another email/i });
    fireEvent.click(changeEmailBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send Recovery Code/i })).toBeInTheDocument();
    });
  });

  it('blocks unregistered users from receiving recovery OTP and displays registration error & link', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email address/i);
    fireEvent.change(emailInput, { target: { value: 'unregistered@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Send Recovery Code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('check_user_registration_status', {
        p_email: 'unregistered@example.com',
      });
      expect(
        screen.getByText(/No account found with this email address. Please check your email or register./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Create a new account now/i })).toHaveAttribute(
        'href',
        '/register?email=unregistered%40example.com'
      );
    });

    // Ensures resetPasswordForEmail is NEVER called for unregistered users
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    // Ensures recovery code screen is NOT rendered
    expect(screen.queryByText(/Verify recovery code/i)).not.toBeInTheDocument();
  });

  it('blocks suspended users from recovery flow and shows suspension notice', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email address/i);
    fireEvent.change(emailInput, { target: { value: 'suspended@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Send Recovery Code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('check_user_registration_status', {
        p_email: 'suspended@example.com',
      });
      expect(
        screen.getByText(/This account has been suspended. Please contact platform support./i)
      ).toBeInTheDocument();
    });

    // Ensures resetPasswordForEmail is NEVER called for suspended accounts
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(screen.queryByText(/Verify recovery code/i)).not.toBeInTheDocument();
  });
});
