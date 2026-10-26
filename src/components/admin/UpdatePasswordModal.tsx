import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { logAuditEvent } from '../../lib/adminService';
import { useToast } from '../../context/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface UpdatePasswordModalProps {
  open: boolean;
  onClose: () => void;
  userEmail?: string;
  userId?: string;
}

export function UpdatePasswordModal({
  open,
  onClose,
  userEmail,
  userId,
}: UpdatePasswordModalProps) {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both passwords are identical.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
        return;
      }

      setSuccess(true);
      toast.success('Your password has been updated successfully.');

      // Log audit trail for security tracking
      void logAuditEvent(
        userId || null,
        'user.password_updated',
        'user',
        userId || null,
        { email: userEmail, updated_at: new Date().toISOString() }
      );

      // Auto-close after 1.5 seconds on success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Update Password" onClose={handleClose}>
      <div data-testid="update-password-modal" className="space-y-4">
        {userEmail && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <Lock size={13} className="text-orange-500 shrink-0" />
            <span>Account: <strong className="text-slate-800 dark:text-slate-200">{userEmail}</strong></span>
          </div>
        )}

        {error && (
          <div
            data-testid="update-password-error"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            data-testid="update-password-success"
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>Password updated successfully! Closing...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="modal_new_password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              New Password*
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <KeyRound size={15} />
              </div>
              <input
                id="modal_new_password"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="new-password-input"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide new password' : 'Show new password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="modal_confirm_password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Confirm New Password*
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <KeyRound size={15} />
              </div>
              <input
                id="modal_confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                data-testid="confirm-password-input"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading || success}
              data-testid="submit-update-password-btn"
              className="text-xs font-bold"
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
