import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { OtpInput } from '../components/ui/OtpInput';
import { StudioBar } from '../components/home/StudioBar';
import { TiltCard } from '../components/home/TiltCard';
import { soundFx } from '../lib/soundFx';
import { recordSessionEstablished } from '../lib/authSessionService';
import { BRAND_LOGO_URL } from '../constants/branding';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 6-Digit OTP verification states
  const [otpToken, setOtpToken] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    soundFx.playSweep(260, 600, 0.1, 0.05);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setResendCooldown(60);
      soundFx.playChime();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = (codeOverride || otpToken).trim();
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit recovery code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    soundFx.playSweep(260, 600, 0.1, 0.05);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
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

      soundFx.playChime();
      setOtpSuccess(true);

      setTimeout(() => {
        navigate('/reset-password');
      }, 700);
    } catch (err: unknown) {
      soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
      setOtpError(err instanceof Error ? err.message : 'Failed to verify recovery code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim() || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setOtpError('');
    setResendSuccess(false);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
    <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
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
            className="mx-auto mb-8 flex items-center justify-center gap-3.5 group w-fit"
          >
            <img
              src={BRAND_LOGO_URL}
              alt="Iunoware Academy Logo"
              className="h-12 w-auto object-contain drop-shadow-[0_4px_14px_rgba(249,115,22,0.35)] group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-2 leading-none font-sans">
              <span className="text-3xl font-black tracking-tight text-white group-hover:text-orange-400 transition-colors">
                Iunoware
              </span>
              <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400">
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
            {submitted ? (
              <div className="text-center space-y-5">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/20">
                  <ShieldCheck size={28} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Verify recovery code
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Enter the 6-digit recovery code sent to{' '}
                    <strong className="text-white font-mono break-all">{email}</strong>.
                  </p>
                </div>

                {/* 6-Digit OTP Interactive Input */}
                <div className="py-2">
                  <OtpInput
                    value={otpToken}
                    onChange={(val) => {
                      setOtpToken(val);
                      if (otpError) setOtpError('');
                    }}
                    onComplete={(val) => handleVerifyOtp(val)}
                    disabled={otpLoading || otpSuccess}
                    error={Boolean(otpError)}
                  />
                </div>

                {/* Status / Error Alerts */}
                {otpError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-300 flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {otpSuccess && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Code verified! Redirecting to set your new password...</span>
                  </div>
                )}

                {resendSuccess && !otpSuccess && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Recovery code resent! Please check your inbox.</span>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-[#060913]/90 p-4 text-xs text-slate-300 text-left space-y-2.5">
                  <p className="font-bold text-white flex items-center gap-1.5 font-mono">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Next Steps:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Check your inbox (and spam folder) for the 6-digit recovery code.</li>
                    <li>Enter the 6-digit code above to proceed with choosing a new password.</li>
                    <li>This code will expire in 10 minutes for your account security.</li>
                  </ul>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => handleVerifyOtp()}
                    disabled={otpLoading || otpToken.length !== 6 || otpSuccess}
                    loading={otpLoading}
                    onMouseEnter={() => soundFx.playBlip(480, 0.02, 'sine', 0.02)}
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3 hover:scale-[1.01] transition-all disabled:opacity-50"
                  >
                    <span>{otpLoading ? 'Verifying code...' : 'Verify & Set New Password'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleResendCode}
                    disabled={resendLoading || resendCooldown > 0 || otpSuccess}
                    onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                    className="w-full justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl"
                  >
                    {resendLoading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin" />
                        Sending code...
                      </span>
                    ) : resendCooldown > 0 ? (
                      <span>Resend in {resendCooldown}s</span>
                    ) : (
                      <span>Resend recovery code</span>
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setOtpError('');
                        setOtpToken('');
                      }}
                      className="hover:text-orange-400 transition-colors underline cursor-pointer"
                    >
                      ← Try another email
                    </button>

                    <Link
                      to="/login"
                      className="hover:text-white transition-colors"
                    >
                      Back to log in →
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Telemetry Status Pill */}
                <div
                  data-cursor="TELEMETRY"
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060913]/90 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-orange-400 font-mono shadow-md backdrop-blur-xl"
                >
                  <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
                  <span>Account Recovery · Iunoware Studio</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Forgot your password?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Don't worry, happens to all of us. Enter your email below to receive a 6-digit recovery code.
                </p>

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 backdrop-blur-xl flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed flex-1">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  <FormField
                    id="email"
                    label="Email address"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    labelClassName="mb-2 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                    inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                  />

                  <Button
                    type="submit"
                    size="lg"
                    loading={loading}
                    data-cursor="SEND CODE"
                    onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                  >
                    {loading ? 'Sending code...' : 'Send Recovery Code'}
                  </Button>
                </form>

                <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-6 text-sm">
                  <Link
                    to="/login"
                    onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                    className="inline-flex items-center gap-1.5 font-bold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to log in
                  </Link>
                  <Link
                    to="/register"
                    onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                    className="font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Create account
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
