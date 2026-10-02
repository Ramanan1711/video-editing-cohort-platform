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

    soundFx.playSweep(260, 600, 0.1, 0.05);

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
    <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
      {/* Custom Magnetic Cursor */}
      <CustomCursor />

      {/* Atmospheric crimson & amber volumetric lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          {/* Logo Header */}
          <Link
            to="/"
            data-cursor="HOME"
            className="mx-auto mb-8 flex items-center justify-center gap-2 group w-fit"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Sparkles size={19} />
            </div>
            <div className="flex items-center gap-1 leading-none font-sans">
              <span className="text-2xl font-black tracking-tight text-white">
                Growbytee
              </span>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Global
              </span>
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
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060913]/90 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-orange-400 font-mono shadow-md backdrop-blur-xl"
            >
              <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
              <span>Welcome Back · Production Portal</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Return to the room.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Your next production task is waiting for you.
            </p>

            {/* Unconfirmed Email Alert Box */}
            {isEmailUnconfirmed && (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-3 backdrop-blur-xl">
                <div className="flex items-start gap-2.5">
                  <Mail size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-300">Email Confirmation Required</p>
                    <p className="text-slate-300">{error}</p>
                  </div>
                </div>

                {resendSuccess ? (
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300 bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Confirmation link sent to {email}. Check your inbox!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading || resendCooldown > 0}
                    onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                    className="inline-flex items-center gap-1.5 font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer disabled:opacity-50"
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
                        onClick={() => handleLogin()}
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

            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <FormField
                id="email"
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300" htmlFor="password">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                    className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors"
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
                  className="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                data-cursor="SIGN IN"
                onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>

            <div className="mt-7 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-slate-400">
                New to Growbytee Global Academy?{' '}
                <Link
                  to="/register"
                  onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                  className="font-bold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 transition-colors"
                >
                  <span>Create an account</span>
                  <ArrowRight size={13} />
                </Link>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>256-Bit Encrypted Database Authentication</span>
            </div>
          </TiltCard>
        </div>
      </main>

      {/* Fixed Junca Studio Bottom Bar */}
      <StudioBar />
    </div>
  );
};