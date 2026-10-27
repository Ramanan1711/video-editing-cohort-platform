import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  ArrowLeft,
  Mail,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { logAuditEvent } from '../../lib/adminService';
import { useToast } from '../../context/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { OtpInput } from '../ui/OtpInput';
import { soundFx } from '../../lib/soundFx';
import { recordSessionEstablished } from '../../lib/authSessionService';

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
  const targetEmail = (userEmail || 'ajayramanan17@gmail.com').trim();

  // Steps: 'form' -> 'otp'
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification fields
  const [otpToken, setOtpToken] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Completion state
  const [success, setSuccess] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetForm = () => {
    setStep('form');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setOtpToken('');
    setOtpLoading(false);
    setOtpError(null);
    setResendLoading(false);
    setResendSuccess(false);
    setResendCooldown(0);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Step 1: Validate passwords and send OTP recovery code to targetEmail
  const handleProceedToOtp = async (e: React.FormEvent) => {
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
    soundFx.playSweep(260, 600, 0.1, 0.05);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send verification code. Please try again.');
        return;
      }

      soundFx.playChime();
      setStep('otp');
      setResendCooldown(60);
      setOtpError(null);
      setResendSuccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while requesting verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit OTP code and immediately apply the new password
  const handleVerifyAndApply = async (codeOverride?: string) => {
    const code = (codeOverride || otpToken).trim();
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit recovery code.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    soundFx.playSweep(260, 600, 0.1, 0.05);

    try {
      // 1. Verify 6-digit recovery OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: code,
        type: 'recovery',
      });

      if (verifyError) {
        soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
        const msg = verifyError.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('token has expired')) {
          setOtpError('This recovery code has expired. Please click "Resend recovery code" below.');
        } else if (msg.includes('invalid') || msg.includes('token')) {
          setOtpError('Incorrect 6-digit recovery code. Please check your email or request a fresh code.');
        } else {
          setOtpError(verifyError.message);
        }
        setOtpLoading(false);
        return;
      }

      if (data?.session) {
        recordSessionEstablished();
      }

      // 2. Now update the password for the verified session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
        setOtpError(updateError.message || 'Failed to update password after code verification.');
        setOtpLoading(false);
        return;
      }

      // 3. Success state & audit trail
      soundFx.playChime();
      setSuccess(true);
      toast.success('Your password has been updated successfully.');

      void logAuditEvent(
        userId || null,
        'user.password_updated',
        'user',
        userId || null,
        { email: targetEmail, updated_at: new Date().toISOString(), method: 'otp_recovery_verified' }
      );

      // Auto-close modal after brief delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
      setOtpError(err instanceof Error ? err.message : 'An unexpected error occurred while verifying code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend recovery code
  const handleResendOtp = async () => {
    if (resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setOtpError(null);
    setResendSuccess(false);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setOtpError(resetError.message);
      } else {
        setResendSuccess(true);
        setResendCooldown(60);
        soundFx.playBlip(520, 0.04, 'sine', 0.03);
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Failed to resend recovery code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={step === 'form' ? 'Update Password' : 'Verify Recovery Code'}
      onClose={handleClose}
    >
      <div data-testid="update-password-modal" className="space-y-4">
        {/* Account email badge */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Lock size={13} className="text-orange-500 shrink-0" />
            <span>Account: <strong className="text-slate-800 dark:text-slate-200">{targetEmail}</strong></span>
          </div>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Parent Super Admin
          </span>
        </div>

        {step === 'form' ? (
          <>
            {/* Informational security banner */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
              <Mail size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                For security, a <strong>6-digit recovery code</strong> will be sent to your email to verify your identity before updating your password.
              </span>
            </div>

            {error && (
              <div
                data-testid="update-password-error"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleProceedToOtp} className="space-y-4">
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                  disabled={loading}
                  data-testid="submit-update-password-btn"
                  className="text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {loading ? 'Sending Code...' : 'Send Verification Code →'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          /* Step 2: OTP Verification */
          <div className="space-y-4 pt-1">
            <div className="text-center space-y-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-500 shadow-md">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Enter 6-Digit Recovery Code
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                We sent a 6-digit recovery code to{' '}
                <strong className="text-slate-900 dark:text-white font-mono break-all">{targetEmail}</strong>.
              </p>
            </div>

            {/* 6-Digit OTP Interactive Input */}
            <div className="py-2 flex justify-center">
              <OtpInput
                value={otpToken}
                onChange={(val) => {
                  setOtpToken(val);
                  if (otpError) setOtpError(null);
                }}
                onComplete={(val) => handleVerifyAndApply(val)}
                disabled={otpLoading || success}
                error={Boolean(otpError)}
              />
            </div>

            {otpError && (
              <div
                data-testid="update-password-error"
                className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-600 dark:text-red-300"
              >
                <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {resendSuccess && !success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-600 dark:text-emerald-300 font-medium">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>Fresh recovery code sent to your email.</span>
              </div>
            )}

            {success && (
              <div
                data-testid="update-password-success"
                className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-600 dark:text-emerald-300 font-bold animate-in fade-in zoom-in-95"
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Password updated successfully! Closing...</span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 space-y-1">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono">
                <CheckCircle2 size={12} className="text-emerald-500" />
                Security Note:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500 dark:text-slate-400">
                <li>Check your inbox (and spam folder) for the 6-digit recovery code.</li>
                <li>Code expires in 10 minutes.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={() => handleVerifyAndApply()}
                disabled={otpLoading || otpToken.length !== 6 || success}
                loading={otpLoading}
                data-testid="otp-verify-btn"
                className="w-full justify-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-2.5 text-xs shadow-md shadow-orange-500/20"
              >
                {otpLoading ? 'Verifying & Updating...' : 'Confirm & Update Password'}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setOtpError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={13} /> Edit password
                </button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendOtp}
                  disabled={resendLoading || resendCooldown > 0 || success}
                  data-testid="resend-otp-btn"
                  className="text-[11px] h-8 px-2.5"
                >
                  {resendLoading ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin" /> Sending...
                    </span>
                  ) : resendCooldown > 0 ? (
                    <span>Resend in {resendCooldown}s</span>
                  ) : (
                    <span>Resend code</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
