import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Verification & Session Detection State
  const [isVerifying, setIsVerifying] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);

  // Manual OTP fallback state
  const [showManualOtp, setShowManualOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndUrl() {
      if (typeof window === 'undefined') return;

      // 1. Inspect URL hash fragment and query search parameters for errors
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);

      const errorParam = hashParams.get('error') || searchParams.get('error');
      const errorCodeParam = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDescParam = hashParams.get('error_description') || searchParams.get('error_description');

      if (errorParam || errorCodeParam || errorDescParam) {
        if (!isMounted) return;

        let friendlyMessage = 'This password reset link is invalid or has expired.';
        if (
          errorCodeParam === 'otp_expired' ||
          errorDescParam?.toLowerCase().includes('expired') ||
          errorDescParam?.toLowerCase().includes('invalid')
        ) {
          friendlyMessage =
            'This password reset link has expired or has already been used. Password reset links are single-use for security reasons.';
        } else if (errorDescParam) {
          friendlyMessage = decodeURIComponent(errorDescParam.replace(/\+/g, ' '));
        }

        setLinkError(friendlyMessage);
        setIsVerifying(false);
        return;
      }

      // 2. Inspect if a PKCE authorization code is present in query parameters
      const code = searchParams.get('code');
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!isMounted) return;
            setLinkError(exchangeError.message);
            setIsVerifying(false);
            return;
          }
          if (data.session && isMounted) {
            setHasValidSession(true);
            setIsVerifying(false);
            return;
          }
        } catch (err) {
          if (!isMounted) return;
          setLinkError(err instanceof Error ? err.message : 'Failed to verify recovery link.');
          setIsVerifying(false);
          return;
        }
      }

      // 3. Inspect existing Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
        setHasValidSession(true);
        setIsVerifying(false);
        return;
      }

      const hasHashToken =
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=recovery');

      if (!hasHashToken) {
        if (isMounted) setIsVerifying(false);
        return;
      }

      // If hash token is present, allow a brief window for Supabase client to finish parsing
      const timer = setTimeout(async () => {
        if (!isMounted) return;
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setHasValidSession(true);
        }
        setIsVerifying(false);
      }, 300);

      return () => clearTimeout(timer);
    }

    void checkAuthAndUrl();

    // 4. Subscribe to auth changes to immediately catch PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasValidSession(true);
        setLinkError(null);
        setIsVerifying(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields match.');
      return;
    }

    setLoading(true);

    try {
      // Re-verify that an active authenticated session exists before attempting update
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(
          'Your password reset session has expired or is missing. Please request a new password reset email.'
        );
        setHasValidSession(false);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        if (
          updateError.message.toLowerCase().includes('session') ||
          updateError.message.toLowerCase().includes('auth')
        ) {
          setError(
            'Your password reset session has expired. Please request a new password reset email.'
          );
          setHasValidSession(false);
        } else {
          setError(updateError.message);
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail.trim() || !otpToken.trim()) return;

    setOtpLoading(true);
    setOtpError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: otpEmail.trim(),
        token: otpToken.trim(),
        type: 'recovery',
      });

      if (verifyError) {
        setOtpError(verifyError.message);
        setOtpLoading(false);
        return;
      }

      if (data.session) {
        setHasValidSession(true);
        setLinkError(null);
        setShowManualOtp(false);
      } else {
        setOtpError('Verification succeeded, but session could not be established.');
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to verify recovery code.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 block w-fit text-sm font-black tracking-tight text-slate-950">
          CUT / CRAFT
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
          {/* State 1: Verification in Progress */}
          {isVerifying ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 animate-spin">
                <RefreshCw size={24} />
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-950">Verifying reset link...</h1>
              <p className="mt-2 text-xs text-slate-500">
                Please wait a moment while we establish your secure recovery session.
              </p>
            </div>
          ) : success ? (
            /* State 2: Password Successfully Reset */
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Password updated</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Your password has been successfully reset. You can now use your new password to sign in.
              </p>

              <div className="mt-6">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Continue to log in
                </Button>
              </div>
            </div>
          ) : linkError ? (
            /* State 3: Link Expired or Invalid Error */
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertCircle size={24} />
              </div>
              <p className="eyebrow text-amber-600">Link Expired or Invalid</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Password reset link invalid</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {linkError}
              </p>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-500 text-left space-y-1.5">
                <p className="font-bold text-slate-700">Common causes:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Security filters or anti-virus link scanners opened and consumed the one-time link.</li>
                  <li>The link has expired (recovery links are time-limited).</li>
                  <li>The link was already clicked or used previously.</li>
                </ul>
              </div>

              {/* Optional Manual OTP Verification Accordion */}
              {showManualOtp ? (
                <form onSubmit={handleManualOtpVerify} className="mt-6 space-y-4 text-left">
                  <p className="text-xs font-bold text-slate-800">Enter recovery code from email:</p>
                  {otpError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                      {otpError}
                    </div>
                  )}
                  <FormField
                    id="otp-email"
                    label="Email address"
                    type="email"
                    required
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="name@domain.com"
                  />
                  <FormField
                    id="otp-token"
                    label="Recovery Code / Token"
                    type="text"
                    required
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="6-digit code or token from email"
                  />
                  <Button type="submit" className="w-full" loading={otpLoading}>
                    {otpLoading ? 'Verifying code...' : 'Verify recovery code'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowManualOtp(false)}
                    className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Cancel manual entry
                  </button>
                </form>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    className="w-full justify-center"
                    onClick={() => navigate('/forgot-password')}
                  >
                    Request a new reset link
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowManualOtp(true)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    <KeyRound size={13} /> Enter recovery code manually
                  </button>

                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950 mt-1"
                  >
                    <ArrowLeft size={14} /> Back to log in
                  </Link>
                </div>
              )}
            </div>
          ) : !hasValidSession ? (
            /* State 4: Direct Access Without Session or Token */
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Lock size={24} />
              </div>
              <p className="eyebrow">Recovery Session Missing</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">No reset session found</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                To reset your password, please click the recovery link sent to your email address or request a new one below.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <Button
                  className="w-full justify-center"
                  onClick={() => navigate('/forgot-password')}
                >
                  Request a password reset link
                </Button>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950"
                >
                  <ArrowLeft size={14} /> Back to log in
                </Link>
              </div>
            </div>
          ) : (
            /* State 5: Active Recovery Session - Set New Password */
            <>
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Lock size={20} />
              </div>
              <p className="eyebrow">Set new password</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Choose a new password.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create a strong password with at least 6 characters to secure your account.
              </p>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="mt-7 space-y-5">
                <FormField
                  id="new-password"
                  label="New password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />

                <FormField
                  id="confirm-password"
                  label="Confirm new password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Updating password...' : 'Update password'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Link to="/login" className="font-bold text-slate-500 hover:text-slate-900">
                  Back to log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
