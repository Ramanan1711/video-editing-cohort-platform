import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Register } from '../../pages/Register';
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
      signUp: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Register.tsx - 6-Digit OTP Email Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions to 6-digit OTP screen after initial signup submission', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-1', email: 'student@example.com', identities: [{ id: 'usr-1' }] },
        session: null,
      },
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Jane Student' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+91 98765 43210' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
      expect(screen.getByText(/student@example.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/6-digit verification code/i)).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('verifies 6-digit code via supabase.auth.verifyOtp and routes to student dashboard on success', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-1', email: 'student@example.com', identities: [{ id: 'usr-1' }] },
        session: null,
      },
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-1', email: 'student@example.com' },
        session: { access_token: 'valid-token', refresh_token: 'valid-refresh' },
      },
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Jane Student' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+91 98765 43210' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    // Paste or type 6 digits
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '654321',
      },
    });

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'student@example.com',
        token: '654321',
        type: 'signup',
      });
      expect(screen.getByText(/Email verified! Redirecting to your workspace.../i)).toBeInTheDocument();
    });
  });

  it('displays error message when 6-digit OTP is invalid', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-1', email: 'student@example.com', identities: [{ id: 'usr-1' }] },
        session: null,
      },
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token is invalid or has expired' },
    } as any);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Jane Student' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+91 98765 43210' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '000000',
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/This verification code has expired/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('allows user to change email address and returns to form', async () => {
    render(
      <MemoryRouter initialEntries={['/register?verify=true&email=typo@example.com']}>
        <Register />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
      expect(screen.getByText(/typo@example.com/i)).toBeInTheDocument();
    });

    const changeEmailBtn = screen.getByRole('button', { name: /Change email address/i });
    fireEvent.click(changeEmailBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create my account/i })).toBeInTheDocument();
    });
  });
});
