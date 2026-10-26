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
    },
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
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
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
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('successfully updates password via supabase auth and emits audit event', async () => {
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

    await waitFor(() => {
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

  it('displays API error when supabase auth fails', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Auth session expired. Please sign in again.' } as any,
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
        'Auth session expired. Please sign in again.'
      );
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
