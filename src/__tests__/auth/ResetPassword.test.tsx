import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResetPassword } from '../../pages/ResetPassword';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      exchangeCodeForSession: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

describe('ResetPassword Page Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    window.location.search = '';
  });

  it('detects error in URL hash (otp_expired) and displays invalid link error view', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Password reset link invalid')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This password reset link has expired or has already been used/i)
    ).toBeInTheDocument();

    const requestNewBtn = screen.getByRole('button', { name: /request a new reset link/i });
    expect(requestNewBtn).toBeInTheDocument();

    fireEvent.click(requestNewBtn);
    expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
  });

  it('shows no reset session view when arriving directly without session or token', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No reset session found')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /request a password reset link/i })).toBeInTheDocument();
  });

  it('renders password update form when an authenticated recovery session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id', email: 'test@example.com' },
          access_token: 'fake-token',
        },
      },
      error: null,
    } as any);

    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Choose a new password.')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm new password$/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    // Test password too short
    fireEvent.change(newPasswordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Password must be at least 6 characters long.')).toBeInTheDocument();

    // Test password mismatch
    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Passwords do not match. Please ensure both fields match.')).toBeInTheDocument();

    // Successful update
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Password updated')).toBeInTheDocument();
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpassword123',
    });
  });

  it('handles manual OTP code verification fallback when link is expired', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired';

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: {
        session: { access_token: 'token-from-otp' },
        user: { id: 'user-123' },
      },
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Password reset link invalid')).toBeInTheDocument();
    });

    // Click enter recovery code manually
    const manualBtn = screen.getByRole('button', { name: /enter recovery code manually/i });
    fireEvent.click(manualBtn);

    const emailInput = screen.getByLabelText(/email address/i);
    const tokenInput = screen.getByLabelText(/recovery code \/ token/i);
    const verifyBtn = screen.getByRole('button', { name: /verify recovery code/i });

    fireEvent.change(emailInput, { target: { value: 'studtesting1@gmail.com' } });
    fireEvent.change(tokenInput, { target: { value: '123456' } });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'studtesting1@gmail.com',
        token: '123456',
        type: 'recovery',
      });
      expect(screen.getByText('Choose a new password.')).toBeInTheDocument();
    });
  });
});
