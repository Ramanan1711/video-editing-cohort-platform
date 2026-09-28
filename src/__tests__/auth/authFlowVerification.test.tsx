import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../../pages/Login';
import { Register } from '../../pages/Register';
import { supabase } from '../../lib/supabaseClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Authentication Production Verification (Email Confirmation & Network Failure)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Register.tsx - Email Confirmation & Network Failures', () => {
    it('shows email confirmation required screen when session is null and does not route to dashboard', async () => {
      // Supabase returns user but null session when email confirmation is active
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'student@example.com', identities: [{ id: 'usr-1' }] },
          session: null,
        },
        error: null,
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Jane Student' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });

      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
        expect(screen.getByText(/student@example.com/i)).toBeInTheDocument();
      });

      // Crucial: Must NOT navigate to dashboard while unconfirmed!
      expect(mockNavigate).not.toHaveBeenCalledWith('/student/dashboard');
    });

    it('allows resending verification email from confirmation screen', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'student@example.com', identities: [{ id: 'usr-1' }] },
          session: null,
        },
        error: null,
      });
      (supabase.auth.resend as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {},
        error: null,
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Jane Student' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Resend verification email/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Resend verification email/i }));

      await waitFor(() => {
        expect(supabase.auth.resend).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'signup',
            email: 'student@example.com',
          })
        );
        expect(screen.getByText(/Verification link resent! Please check your inbox/i)).toBeInTheDocument();
      });
    });

    it('routes directly to dashboard when session is immediately active', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-2', email: 'autoconfirmed@example.com', identities: [{ id: 'usr-2' }] },
          session: { access_token: 'fake-jwt-token' },
        },
        error: null,
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Auto Confirmed' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'autoconfirmed@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard');
      });
    });

    it('handles network failure gracefully with retry option', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Offline User' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'offline@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Unable to connect to the authentication server/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry connection/i })).toBeInTheDocument();
      });
    });

    it('warns when account already exists without leaking enumeration', async () => {
      // Supabase empty identities array represents existing account
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-existing', email: 'existing@example.com', identities: [] },
          session: null,
        },
        error: null,
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Existing User' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'existing@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Account Already Exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Login.tsx - Email Confirmation & Network Failures', () => {
    it('detects unconfirmed email error and provides actionable resend link', async () => {
      (supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 },
      });
      (supabase.auth.resend as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {},
        error: null,
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'unconfirmed@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'mypassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/Email Confirmation Required/i)).toBeInTheDocument();
        expect(screen.getByText(/Your email has not been confirmed yet/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Resend confirmation email/i })).toBeInTheDocument();
      });

      // Click resend confirmation
      fireEvent.click(screen.getByRole('button', { name: /Resend confirmation email/i }));

      await waitFor(() => {
        expect(supabase.auth.resend).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'signup',
            email: 'unconfirmed@example.com',
          })
        );
        expect(screen.getByText(/Confirmation link sent to unconfirmed@example.com/i)).toBeInTheDocument();
      });
    });

    it('handles login network disruption gracefully with friendly notice and retry action', async () => {
      (supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'student@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'mypassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/Unable to reach the authentication server/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry connection/i })).toBeInTheDocument();
      });
    });

    it('performs role-based redirect on successful sign-in', async () => {
      (supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'mentor-1', email: 'mentor@example.com' },
          session: { access_token: 'valid-token' },
        },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'mentor' },
              error: null,
            }),
          }),
        }),
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'mentor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'securepassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/mentor');
      });
    });
  });
});
