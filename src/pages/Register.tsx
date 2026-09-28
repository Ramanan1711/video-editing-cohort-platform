import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  // Email confirmation states
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [existingAccountNotice, setExistingAccountNotice] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();

  // Handle countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setIsNetworkError(false);

    // Pre-flight client offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNetworkError(true);
      setError('You appear to be offline. Please check your network connection and try again.');
      setLoading(false);
      return;
    }

    try {
      // Secure Production Flow: All public registrations are strictly assigned 'student' role.
      // Mentors are promoted exclusively by administrators through the Admin Console.
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/student/dashboard`
        : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'student',
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
          setIsNetworkError(true);
          setError('Unable to reach the authentication service. Please check your internet connection.');
        } else if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          setError('Too many registration attempts. Please wait a few minutes before trying again.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      // Supabase email-enumeration protection check:
      // If user already exists, Supabase returns a user object with an empty identities array.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setExistingAccountNotice(true);
        setLoading(false);
        return;
      }

      // If email confirmation is enabled on the project, data.session will be null.
      if (data?.user && !data.session) {
        setConfirmationRequired(true);
        setLoading(false);
        return;
      }

      // If session is active immediately (e.g. email confirmation disabled in dev), route directly.
      navigate('/student/dashboard');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network')) {
        setIsNetworkError(true);
        setError('Unable to connect to the authentication server. Please check your internet connection and try again.');
      } else {
        setError(errMsg || 'An unexpected error occurred during registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setError('');

    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/student/dashboard`
        : undefined;

      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendErr) {
        setError(resendErr.message);
      } else {
        setResendSuccess(true);
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // View 1: Email Confirmation Required Screen
  // ---------------------------------------------------------------------------
  if (confirmationRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] dark:bg-slate-950 px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mx-auto mb-8 flex items-center justify-center gap-2 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Sparkles size={18} />
            </div>
            <div className="flex items-center gap-1 leading-none font-sans">
              <span className="text-xl font-black tracking-tight text-orange-600 dark:text-orange-500">
                ProCut
              </span>
              <span className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Hub
              </span>
            </div>
          </Link>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl shadow-slate-900/5 sm:p-9 text-center space-y-5">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
              <Mail size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Confirm your email
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                We've dispatched a verification link to{' '}
                <strong className="text-slate-900 dark:text-white font-mono break-all">{email}</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 text-xs text-slate-600 dark:text-slate-400 text-left space-y-2">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Next Steps:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                <li>Check your inbox (and junk / spam folder).</li>
                <li>Click the confirmation link to activate your student workspace.</li>
                <li>Return here to log in once verified.</li>
              </ul>
            </div>

            {resendSuccess && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-950 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>Verification link resent! Please check your inbox.</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleResendConfirmation}
                disabled={resendLoading || resendCooldown > 0}
                className="w-full justify-center"
              >
                {resendLoading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    Sending link...
                  </span>
                ) : resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <span>Resend verification email</span>
                )}
              </Button>

              <Button href="/login" className="w-full justify-center">
                <span>Proceed to Log In</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: Account Already Exists Screen
  // ---------------------------------------------------------------------------
  if (existingAccountNotice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] dark:bg-slate-950 px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mx-auto mb-8 flex items-center justify-center gap-2 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Sparkles size={18} />
            </div>
            <div className="flex items-center gap-1 leading-none font-sans">
              <span className="text-xl font-black tracking-tight text-orange-600 dark:text-orange-500">
                ProCut
              </span>
              <span className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Hub
              </span>
            </div>
          </Link>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl shadow-slate-900/5 sm:p-9 text-center space-y-5">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertCircle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Account Already Exists
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                An account with <strong className="text-slate-900 dark:text-white font-mono break-all">{email}</strong> is already registered on ProCut Hub.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button href="/login" className="w-full justify-center">
                <span>Sign in with this account</span>
              </Button>
              <Button href="/forgot-password" variant="secondary" className="w-full justify-center">
                <span>Reset password</span>
              </Button>
              <button
                type="button"
                onClick={() => setExistingAccountNotice(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                ← Use a different email address
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 3: Standard Registration Form
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] dark:bg-slate-950 px-5 py-12 transition-colors">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 flex items-center justify-center gap-2 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Sparkles size={18} />
          </div>
          <div className="flex items-center gap-1 leading-none font-sans">
            <span className="text-xl font-black tracking-tight text-orange-600 dark:text-orange-500">
              ProCut
            </span>
            <span className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Hub
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl shadow-slate-900/5 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600 dark:text-orange-500">
            Join the Next Sprint Cohort
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Create your account.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Start your 15-day intensive production internship.
          </p>

          {/* Network Failure / General Error Banner */}
          {error && (
            <div className={`mt-6 rounded-xl border p-3.5 text-xs ${
              isNetworkError
                ? 'border-amber-200 dark:border-amber-950 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                : 'border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
            }`}>
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className={`shrink-0 mt-0.5 ${isNetworkError ? 'text-amber-600' : 'text-red-600'}`} />
                <div className="space-y-2 flex-1">
                  <p>{error}</p>
                  {isNetworkError && (
                    <button
                      type="button"
                      onClick={() => handleRegister()}
                      className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 underline hover:no-underline cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      Retry connection
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="mt-7 space-y-5">
            <FormField
              id="full-name"
              label="Full name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Editor"
            />
            <FormField
              id="register-email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <FormField
              id="register-password"
              label="Password"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Cohort Role:</span> All candidate registrations join as students. Senior mentors are approved and assigned by administrators.
            </div>
            <Button type="submit" className="w-full justify-center" loading={loading}>
              {loading ? 'Creating account...' : 'Create my account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already enrolled?{' '}
            <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};