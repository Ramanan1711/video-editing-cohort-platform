import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { CustomCursor } from '../components/home/CustomCursor';
import { StudioBar } from '../components/home/StudioBar';
import { TiltCard } from '../components/home/TiltCard';
import { soundFx } from '../lib/soundFx';

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

    soundFx.playSweep(260, 600, 0.1, 0.05);

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
      <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
        <CustomCursor />

        {/* Atmospheric lighting */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
        <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

        <main className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md">
            <Link to="/" data-cursor="HOME" className="mx-auto mb-8 flex items-center justify-center gap-2 group w-fit">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
                <Sparkles size={19} />
              </div>
              <div className="flex items-center gap-1 leading-none font-sans">
                <span className="text-2xl font-black tracking-tight text-white">Iunoware</span>
                {/* <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Global</span> */}
                <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-400">
                Academy
              </span>
              </div>
            </Link>

            <TiltCard
              maxTilt={3}
              scale={1.01}
              perspective={1200}
              glareOpacity={0.16}
              glareColor="rgba(249, 115, 22, 0.25)"
              className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl text-center space-y-5"
            >
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/20">
                <Mail size={26} />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Confirm your email
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  We've dispatched a verification link to{' '}
                  <strong className="text-white font-mono break-all">{email}</strong>.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#060913]/90 p-4 text-xs text-slate-300 text-left space-y-2.5">
                <p className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  Next Steps:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Check your inbox (and junk / spam folder).</li>
                  <li>Click the confirmation link to activate your student workspace.</li>
                  <li>Return here to log in once verified.</li>
                </ul>
              </div>

              {resendSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Verification link resent! Please check your inbox.</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading || resendCooldown > 0}
                  onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl"
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

                <Button
                  href="/login"
                  onMouseEnter={() => soundFx.playBlip(480, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3"
                >
                  <span>Proceed to Log In</span>
                </Button>
              </div>
            </TiltCard>
          </div>
        </main>

        <StudioBar />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: Account Already Exists Screen
  // ---------------------------------------------------------------------------
  if (existingAccountNotice) {
    return (
      <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
        <CustomCursor />

        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
        <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

        <main className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md">
            <Link to="/" data-cursor="HOME" className="mx-auto mb-8 flex items-center justify-center gap-2 group w-fit">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
                <Sparkles size={19} />
              </div>
              <div className="flex items-center gap-1 leading-none font-sans">
                <span className="text-2xl font-black tracking-tight text-white">Iunoware</span>
                {/* <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Global</span> */}
                <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-400">
                Academy
              </span>
              </div>
            </Link>

            <TiltCard
              maxTilt={3}
              scale={1.01}
              perspective={1200}
              glareOpacity={0.16}
              glareColor="rgba(249, 115, 22, 0.25)"
              className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl text-center space-y-5"
            >
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/20">
                <AlertCircle size={26} />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Account Already Exists
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  An account with <strong className="text-white font-mono break-all">{email}</strong> is already registered on Iunoware Academy.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  href="/login"
                  onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3"
                >
                  <span>Sign in with this account</span>
                </Button>
                <Button
                  href="/forgot-password"
                  variant="secondary"
                  onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl"
                >
                  <span>Reset password</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setExistingAccountNotice(false)}
                  onMouseEnter={() => soundFx.playBlip(380, 0.02, 'sine', 0.02)}
                  className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer pt-2 block mx-auto"
                >
                  ← Use a different email address
                </button>
              </div>
            </TiltCard>
          </div>
        </main>

        <StudioBar />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 3: Standard Registration Form
  // ---------------------------------------------------------------------------
  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
      <CustomCursor />

      {/* Atmospheric crimson & amber volumetric lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          {/* Logo Header */}
          <Link to="/" data-cursor="HOME" className="mx-auto mb-8 flex items-center justify-center gap-2 group w-fit">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Sparkles size={19} />
            </div>
            <div className="flex items-center gap-1 leading-none font-sans">
              <span className="text-2xl font-black tracking-tight text-white">Iunoware</span>
              {/* <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Global</span> */}
              <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-400">
                Academy
              </span>
            </div>
          </Link>

          {/* Interactive 3D Obsidian Tilt Card */}
          <TiltCard
            maxTilt={3}
            scale={1.01}
            perspective={1200}
            glareOpacity={0.16}
            glareColor="rgba(249, 115, 22, 0.25)"
            className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-7 sm:p-9 shadow-2xl backdrop-blur-2xl"
          >
            {/* Telemetry Status Pill */}
            <div
              data-cursor="TELEMETRY"
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060913]/90 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-orange-400 font-mono shadow-md backdrop-blur-xl"
            >
              <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
              <span>Join Batch 15 Cohort Sprint</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Create your account.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Start your 15-day intensive production internship.
            </p>

            {/* Network Failure / General Error Banner */}
            {error && (
              <div className={`mt-6 rounded-2xl border p-4 text-xs backdrop-blur-xl ${
                isNetworkError
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className={`shrink-0 mt-0.5 ${isNetworkError ? 'text-amber-400' : 'text-red-400'}`} />
                  <div className="space-y-2 flex-1">
                    <p className="leading-relaxed">{error}</p>
                    {isNetworkError && (
                      <button
                        type="button"
                        onClick={() => handleRegister()}
                        onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                        className="inline-flex items-center gap-1.5 font-bold text-amber-300 underline hover:no-underline cursor-pointer"
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
                labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />
              <FormField
                id="register-email"
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
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
                labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />

              <div className="rounded-2xl border border-white/10 bg-[#060913]/80 p-3.5 text-xs text-slate-400">
                <span className="font-semibold text-white">Cohort Role:</span> All candidate registrations join as students. Senior mentors are approved and assigned by administrators.
              </div>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                data-cursor="CREATE ACCOUNT"
                onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
              >
                {loading ? 'Creating account...' : 'Create my account'}
              </Button>
            </form>

            <div className="mt-7 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-slate-400">
                Already enrolled?{' '}
                <Link
                  to="/login"
                  onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                  className="font-bold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 transition-colors"
                >
                  <span>Log in</span>
                  <ArrowRight size={13} />
                </Link>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Verified Candidate Enrolment Pipeline</span>
            </div>
          </TiltCard>
        </div>
      </main>

      {/* Fixed Junca Studio Bottom Bar */}
      <StudioBar />
    </div>
  );
};