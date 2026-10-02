import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { CustomCursor } from '../components/home/CustomCursor';
import { StudioBar } from '../components/home/StudioBar';
import { TiltCard } from '../components/home/TiltCard';
import { soundFx } from '../lib/soundFx';

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
    soundFx.playSweep(260, 600, 0.1, 0.05);

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
      soundFx.playChime();
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
    soundFx.playSweep(260, 600, 0.1, 0.05);

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
        soundFx.playChime();
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
                Iunoware
              </span>
              {/* <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Global
              </span> */}
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
            {/* State 1: Verification in Progress */}
            {isVerifying ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/15 text-orange-400 animate-spin shadow-lg shadow-orange-500/10">
                  <RefreshCw size={26} />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Verifying reset link...
                </h1>
                <p className="mt-2 text-xs text-slate-400">
                  Please wait a moment while we establish your secure recovery session.
                </p>
              </div>
            ) : success ? (
              /* State 2: Password Successfully Reset */
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 size={26} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Password updated
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  Your password has been successfully reset. You can now use your new password to sign in.
                </p>

                <div className="mt-7">
                  <Button
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                    onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    onClick={() => navigate('/login')}
                  >
                    Continue to log in
                  </Button>
                </div>
              </div>
            ) : linkError ? (
              /* State 3: Link Expired or Invalid Error */
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-lg shadow-amber-500/10">
                  <AlertCircle size={26} />
                </div>
                <div
                  data-cursor="ALERT"
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono"
                >
                  Link Expired or Invalid
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                  Password reset link invalid
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  {linkError}
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#060913]/90 p-4 text-xs text-slate-400 text-left space-y-2 backdrop-blur-xl">
                  <p className="font-mono font-bold uppercase tracking-wider text-amber-300">Common causes:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
                    <li>Security filters or anti-virus link scanners opened and consumed the one-time link.</li>
                    <li>The link has expired (recovery links are time-limited).</li>
                    <li>The link was already clicked or used previously.</li>
                  </ul>
                </div>

                {/* Optional Manual OTP Verification Accordion */}
                {showManualOtp ? (
                  <form onSubmit={handleManualOtpVerify} className="mt-6 space-y-4 text-left">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
                      Enter recovery code from email:
                    </p>
                    {otpError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
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
                      labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                      inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                    />
                    <FormField
                      id="otp-token"
                      label="Recovery Code / Token"
                      type="text"
                      required
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value)}
                      placeholder="6-digit code or token from email"
                      labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                      inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                    />
                    <Button
                      type="submit"
                      className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3 hover:scale-[1.01] transition-all"
                      loading={otpLoading}
                      onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    >
                      {otpLoading ? 'Verifying code...' : 'Verify recovery code'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowManualOtp(false)}
                      className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white transition-colors pt-1"
                    >
                      Cancel manual entry
                    </button>
                  </form>
                ) : (
                  <div className="mt-7 flex flex-col gap-3">
                    <Button
                      className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                      onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                      onClick={() => navigate('/forgot-password')}
                    >
                      Request a new reset link
                    </Button>

                    <button
                      type="button"
                      onClick={() => setShowManualOtp(true)}
                      onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors py-1"
                    >
                      <KeyRound size={13} /> Enter recovery code manually
                    </button>

                    <Link
                      to="/login"
                      onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                      className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors mt-1"
                    >
                      <ArrowLeft size={14} /> Back to log in
                    </Link>
                  </div>
                )}
              </div>
            ) : !hasValidSession ? (
              /* State 4: Direct Access Without Session or Token */
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/15 text-orange-400 shadow-lg shadow-orange-500/10">
                  <Lock size={26} />
                </div>
                <div
                  data-cursor="ALERT"
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-[#060913]/90 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400 font-mono"
                >
                  Recovery Session Missing
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                  No reset session found
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  To reset your password, please click the recovery link sent to your email address or request a new one below.
                </p>

                <div className="mt-7 flex flex-col gap-3">
                  <Button
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                    onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    onClick={() => navigate('/forgot-password')}
                  >
                    Request a password reset link
                  </Button>
                  <Link
                    to="/login"
                    onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                    className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to log in
                  </Link>
                </div>
              </div>
            ) : (
              /* State 5: Active Recovery Session - Set New Password */
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060913]/90 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-orange-400 font-mono shadow-md backdrop-blur-xl">
                  <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
                  <span>Credential Update · Iunoware Studio</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Choose a new password.
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Create a strong password with at least 6 characters to secure your account.
                </p>

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 backdrop-blur-xl flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed flex-1">{error}</p>
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
                    labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                    inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                  />

                  <FormField
                    id="confirm-password"
                    label="Confirm new password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                    inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                  />

                  <Button
                    type="submit"
                    size="lg"
                    loading={loading}
                    data-cursor="UPDATE"
                    onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                  >
                    {loading ? 'Updating password...' : 'Update password'}
                  </Button>
                </form>

                <div className="mt-7 pt-6 border-t border-white/10 text-center">
                  <Link
                    to="/login"
                    onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                    className="text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> Back to log in
                  </Link>
                </div>

                <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>256-Bit Encrypted Database Authentication</span>
                </div>
              </>
            )}
          </TiltCard>
        </div>
      </main>

      {/* Fixed Junca Studio Bottom Bar */}
      <StudioBar />
    </div>
  );
};

