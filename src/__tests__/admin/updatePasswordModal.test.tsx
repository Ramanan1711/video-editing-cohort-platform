import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpdatePasswordModal } from '../../components/admin/UpdatePasswordModal';
import { supabase } from '../../lib/supabaseClient';
import * as adminService from '../../lib/adminService';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

// Mock soundFx
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

// Mock logAuditEvent
vi.spyOn(adminService, 'logAuditEvent').mockResolvedValue('log-123' as unknown as void);

// Mock Toast
vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('UpdatePasswordModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with account email when open', () => {
    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
        userId="parent-admin-1"
      />
    );

    expect(screen.getByTestId('update-password-modal')).toBeInTheDocument();
    expect(screen.getByText('ajayramanan17@gmail.com')).toBeInTheDocument();
    expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
  });

  it('validates minimum 8 characters requirement', async () => {
    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('update-password-error')).toHaveTextContent(
        'Password must be at least 8 characters long.'
      );
    });
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('validates password and confirm password match', async () => {
    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'StrongPassword123' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'DifferentPassword456' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('update-password-error')).toHaveTextContent(
        'Passwords do not match'
      );
    });
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('displays API error when sending recovery code fails in step 1', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: { message: 'Email rate limit exceeded. Please try again later.' } as any,
    } as any);

    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
        userId="parent-admin-1"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('update-password-error')).toHaveTextContent(
        'Email rate limit exceeded. Please try again later.'
      );
    });
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('transitions to 6-digit OTP view, verifies OTP, updates password, and emits audit event', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: {
        user: { id: 'parent-admin-1' } as any,
        session: { access_token: 'token-123' } as any,
      },
      error: null,
    } as any);

    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: { id: 'parent-admin-1' } as any },
      error: null,
    } as any);

    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
        userId="parent-admin-1"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    // Step 1 dispatches OTP code
    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'ajayramanan17@gmail.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password'),
        })
      );
      expect(screen.getByText(/Enter 6-Digit Recovery Code/i)).toBeInTheDocument();
    });

    // Step 2 Enter 6-digit code
    const otpBoxes = screen.getAllByRole('textbox');
    expect(otpBoxes).toHaveLength(6);

    fireEvent.paste(otpBoxes[0], {
      clipboardData: {
        getData: () => '852963',
      },
    });

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'ajayramanan17@gmail.com',
        token: '852963',
        type: 'recovery',
      });
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'SuperSecret2026!',
      });
    });

    expect(adminService.logAuditEvent).toHaveBeenCalledWith(
      'parent-admin-1',
      'user.password_updated',
      'user',
      'parent-admin-1',
      expect.objectContaining({ email: 'ajayramanan17@gmail.com' })
    );

    expect(screen.getByTestId('update-password-success')).toHaveTextContent(
      'Password updated successfully!'
    );
  });

  it('displays user-friendly error message when OTP code is incorrect or expired', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired' } as any,
    } as any);

    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
        userId="parent-admin-1"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Enter 6-Digit Recovery Code/i)).toBeInTheDocument();
    });

    const otpBoxes = screen.getAllByRole('textbox');
    fireEvent.paste(otpBoxes[0], {
      clipboardData: {
        getData: () => '000000',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('update-password-error')).toHaveTextContent(
        'This recovery code has expired. Please click "Resend recovery code" below.'
      );
    });

    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('allows user to navigate back and edit their password from OTP view', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: {},
      error: null,
    } as any);

    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
        userId="parent-admin-1"
      />
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'SuperSecret2026!' },
    });
    fireEvent.click(screen.getByTestId('submit-update-password-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Enter 6-Digit Recovery Code/i)).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /Edit password/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('new-password-input')).toHaveValue('SuperSecret2026!');
    });
  });

  it('allows toggling password visibility', () => {
    render(
      <UpdatePasswordModal
        open={true}
        onClose={vi.fn()}
        userEmail="ajayramanan17@gmail.com"
      />
    );

    const newPasswordInput = screen.getByTestId('new-password-input');
    expect(newPasswordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText('Show new password');
    fireEvent.click(toggleBtn);
    expect(newPasswordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide new password'));
    expect(newPasswordInput).toHaveAttribute('type', 'password');
  });
});
