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
});
