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

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  // Email confirmation verification handling
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();

  // Cooldown timer for resend confirmation button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setIsNetworkError(false);
    setIsEmailUnconfirmed(false);
    setResendSuccess(false);

    // Pre-flight client offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNetworkError(true);
      setError('You appear to be offline. Please check your network connection and try again.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('email not confirmed') || (signInError.status === 400 && msg.includes('confirmed'))) {
          setIsEmailUnconfirmed(true);
          setError('Your email has not been confirmed yet. Please verify your account using the confirmation link sent to your inbox.');
        } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
          setIsNetworkError(true);
          setError('Unable to reach the authentication server. Please check your internet connection.');
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setError('Invalid email or password. Please double-check your credentials or reset your password.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Role-aware redirect: send mentors to the review room, admins to admin console, students to dashboard
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();

          const userRole = profile?.role || 'student';

          if (userRole === 'admin') {
            navigate('/admin');
          } else if (userRole === 'mentor') {
            navigate('/mentor');
          } else {
            navigate('/student/dashboard');
          }
        } catch {
          // Graceful fallback if database profile query experiences degraded connectivity
          navigate('/student/dashboard');
        }
      } else {
        navigate('/student/dashboard');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network')) {
        setIsNetworkError(true);
        setError('Unable to reach the authentication server. Please check your internet connection and try again.');
      } else {
        setError(errMsg || 'An unexpected error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim() || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);

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
            Welcome Back
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Return to the room.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Your next production task is waiting for you.
          </p>

          {/* Unconfirmed Email Alert Box */}
          {isEmailUnconfirmed && (
            <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-950 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <Mail size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Email Confirmation Required</p>
                  <p>{error}</p>
                </div>
              </div>

              {resendSuccess ? (
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 p-2 rounded-lg">
                  <CheckCircle2 size={14} />
                  <span>Confirmation link sent to {email}. Check your inbox!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading || resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 underline hover:no-underline cursor-pointer disabled:opacity-50"
                >
                  {resendLoading ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Sending link...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    'Resend confirmation email →'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Network Failure / General Error Banner */}
          {error && !isEmailUnconfirmed && (
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
                      onClick={() => handleLogin()}
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

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <FormField
              id="email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
            <Button type="submit" className="w-full justify-center" loading={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            New to ProCut Hub?{' '}
            <Link to="/register" className="font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};