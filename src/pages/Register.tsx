import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  ArrowRight,
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
import {
  setPendingCohortCheckout,
  resolveTargetCohortId,
} from '../lib/cohortCheckoutPersistence';
import { listCohorts, type Cohort } from '../lib/courseService';
import { normalizeWhatsAppPhone } from '../lib/whatsappService';
import { checkCohortEnrollmentDeadline } from '../lib/studentAccessService';
import { BRAND_LOGO_URL } from '../constants/branding';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  // Email confirmation & 6-digit OTP states
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [existingAccountNotice, setExistingAccountNotice] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [targetCohort, setTargetCohort] = useState<Cohort | null>(null);
  const targetCohortId = resolveTargetCohortId(searchParams);

  // Synchronize and retain selected cohort for checkout continuation
  useEffect(() => {
    if (targetCohortId) {
      setPendingCohortCheckout(targetCohortId);
      listCohorts()
        .then((all) => {
          const matched = all.find((c) => c.id === targetCohortId);
          if (matched) {
            setTargetCohort(matched);
            setPendingCohortCheckout(matched.id, matched.name, matched.price_inr, matched.currency);
          }
        })
        .catch(() => {});
    }
  }, [targetCohortId]);


  // Allow direct navigation to verification screen via ?verify=true&email=...
  useEffect(() => {
    const shouldVerify = searchParams.get('verify') === 'true';
    const emailParam = searchParams.get('email');
    if (shouldVerify && emailParam) {
      setEmail(emailParam);
      setConfirmationRequired(true);
    }
  }, [searchParams]);

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

    // Client-side validations
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    if (!phone.trim()) {
      setError('Please enter your phone number.');
      setLoading(false);
      return;
    }

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 10) {
      setError('Please enter a valid mobile number (at least 10 digits).');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your password.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      setLoading(false);
      return;
    }

    // Pre-flight client offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNetworkError(true);
      setError('You appear to be offline. Please check your network connection and try again.');
      setLoading(false);
      return;
    }

    const normalizedPhone = normalizeWhatsAppPhone(phone.trim());

    try {
      // Secure Production Flow: All public registrations are strictly assigned 'student' role.
      // Mentors are promoted exclusively by administrators through the Admin Console.
      const redirectPath = targetCohortId
        ? `/student/dashboard?cohort=${encodeURIComponent(targetCohortId)}&checkout=true`
        : '/student/dashboard';
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${redirectPath}`
        : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: normalizedPhone,
            phone_number: normalizedPhone,
            whatsapp_number: normalizedPhone,
            role: 'student',
            ...(targetCohortId ? { preferred_cohort_id: targetCohortId } : {}),
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

      // If session is active immediately (e.g. email confirmation disabled in dev), route directly to checkout.
      navigate(redirectPath);
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

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = (codeOverride || otpToken).trim();
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    soundFx.playSweep(260, 600, 0.1, 0.05);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'signup',
      });

      if (verifyError) {
        soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
        const msg = verifyError.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('token has expired')) {
          setOtpError('This verification code has expired. Please click "Resend verification email" below.');
        } else if (msg.includes('invalid') || msg.includes('token')) {
          setOtpError('Incorrect 6-digit code. Please check your email or request a fresh code.');
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

      const redirectPath = targetCohortId
        ? `/student/dashboard?cohort=${encodeURIComponent(targetCohortId)}&checkout=true`
        : '/student/dashboard';

      setTimeout(() => {
        navigate(redirectPath);
      }, 700);
    } catch (err: unknown) {
      soundFx.playBlip(200, 0.08, 'sawtooth', 0.06);
      setOtpError(err instanceof Error ? err.message : 'Failed to verify code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setOtpError('');
    setResendSuccess(false);

    try {
      const redirectPath = targetCohortId
        ? `/student/dashboard?cohort=${encodeURIComponent(targetCohortId)}&checkout=true`
        : '/student/dashboard';
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${redirectPath}`
        : undefined;

      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendErr) {
        setOtpError(resendErr.message);
      } else {
        setResendSuccess(true);
        setResendCooldown(60);
        soundFx.playBlip(520, 0.04, 'sine', 0.03);
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Failed to resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // View 1: 6-Digit OTP Verification Screen
  // ---------------------------------------------------------------------------
  if (confirmationRequired) {
    return (
      <div className="relative min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden film-grain flex flex-col justify-between">
        {/* Atmospheric lighting */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
        <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

        <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
          <div className="w-full max-w-md">
            <Link to="/" data-cursor="HOME" className="mx-auto mb-4 sm:mb-5 flex items-center justify-center gap-3.5 group w-fit">
              <img
                src={BRAND_LOGO_URL}
                alt="Iunoware Academy Logo"
                className="h-10 w-auto object-contain drop-shadow-[0_4px_14px_rgba(249,115,22,0.35)] group-hover:scale-105 transition-transform"
              />
              <div className="flex items-center gap-2 leading-none font-sans">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white group-hover:text-orange-400 transition-colors">Iunoware</span>
                <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400">
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
              className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl text-center space-y-4"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/20">
                <ShieldCheck size={26} />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Confirm your email
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Enter the 6-digit verification code sent to{' '}
                  <strong className="text-white font-mono break-all">{email}</strong>.
                </p>
              </div>

              {/* 6-Digit OTP Interactive Input */}
              <div className="py-1">
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
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-2.5 text-xs text-red-300 flex items-center justify-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              {otpSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2.5 text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>Email verified! Redirecting to your workspace...</span>
                </div>
              )}

              {resendSuccess && !otpSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2.5 text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Verification code resent! Please check your inbox.</span>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-[#060913]/90 p-3 text-xs text-slate-300 text-left space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 font-mono text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Next Steps:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px] leading-relaxed">
                  <li>Check your inbox (and spam folder) for the 6-digit OTP code.</li>
                  <li>Enter the 6-digit code above to activate your student workspace.</li>
                  {targetCohort ? (
                    <li className="text-orange-300 font-semibold">
                      You will return directly to checkout for <strong>{targetCohort.name}</strong>.
                    </li>
                  ) : (
                    <li>You will be redirected right back to complete cohort checkout.</li>
                  )}
                </ul>
              </div>

              <div className="space-y-2.5 pt-1">
                <Button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={otpLoading || otpToken.length !== 6 || otpSuccess}
                  loading={otpLoading}
                  onMouseEnter={() => soundFx.playBlip(480, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-2.5 hover:scale-[1.01] transition-all disabled:opacity-50"
                >
                  <span>{otpLoading ? 'Verifying code...' : 'Verify & Continue'}</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading || resendCooldown > 0 || otpSuccess}
                  onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl py-2.5"
                >
                  {resendLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      Sending code...
                    </span>
                  ) : resendCooldown > 0 ? (
                    <span>Resend in {resendCooldown}s</span>
                  ) : (
                    <span>Resend verification code</span>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-1.5 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmationRequired(false);
                      setOtpError('');
                      setOtpToken('');
                    }}
                    className="hover:text-orange-400 transition-colors underline cursor-pointer"
                  >
                    ← Change email address
                  </button>

                  <Link
                    to={targetCohortId ? `/login?cohort=${encodeURIComponent(targetCohortId)}` : '/login'}
                    className="hover:text-white transition-colors"
                  >
                    Proceed to Log In →
                  </Link>
                </div>
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
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
        <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

        <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
          <div className="w-full max-w-md">
            <Link to="/" data-cursor="HOME" className="mx-auto mb-4 sm:mb-5 flex items-center justify-center gap-3.5 group w-fit">
              <img
                src={BRAND_LOGO_URL}
                alt="Iunoware Academy Logo"
                className="h-10 w-auto object-contain drop-shadow-[0_4px_14px_rgba(249,115,22,0.35)] group-hover:scale-105 transition-transform"
              />
              <div className="flex items-center gap-2 leading-none font-sans">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white group-hover:text-orange-400 transition-colors">Iunoware</span>
                <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400">
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
              className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl text-center space-y-4"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/20">
                <AlertCircle size={24} />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Account Already Exists
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  An account with <strong className="text-white font-mono break-all">{email}</strong> is already registered on Iunoware Academy.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <Button
                  href={targetCohortId ? `/login?cohort=${encodeURIComponent(targetCohortId)}` : '/login'}
                  onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-2.5"
                >
                  <span>Sign in with this account</span>
                </Button>
                <Button
                  href="/forgot-password"
                  variant="secondary"
                  onMouseEnter={() => soundFx.playBlip(420, 0.02, 'sine', 0.02)}
                  className="w-full justify-center bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-orange-500/40 backdrop-blur-xl py-2.5"
                >
                  <span>Reset password</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setExistingAccountNotice(false)}
                  onMouseEnter={() => soundFx.playBlip(380, 0.02, 'sine', 0.02)}
                  className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer pt-1 block mx-auto"
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
      {/* Atmospheric crimson & amber volumetric lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_70%_35%,rgba(220,38,38,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute top-12 left-1/4 -z-10 size-[500px] rounded-full bg-red-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-12 right-1/4 -z-10 size-[450px] rounded-full bg-orange-500/10 blur-[130px]" />

      <main className="flex-1 flex items-center justify-center px-4 py-5 sm:py-7">
        <div className="w-full max-w-xl">
          {/* Logo Header */}
          <Link to="/" data-cursor="HOME" className="mx-auto mb-3.5 sm:mb-4 flex items-center justify-center gap-3 group w-fit">
            <img
              src={BRAND_LOGO_URL}
              alt="Iunoware Academy Logo"
              className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_4px_14px_rgba(249,115,22,0.35)] group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-2 leading-none font-sans">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white group-hover:text-orange-400 transition-colors">Iunoware</span>
              <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400">
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
            className="relative rounded-3xl border border-white/10 bg-[#090d16]/90 p-5 sm:p-7 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header info row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Create your account.
                </h1>
                <p className="text-xs text-slate-400">
                  Start your 15-day intensive production internship.
                </p>
              </div>

              {/* Telemetry Status Pill */}
              <div
                data-cursor="TELEMETRY"
                className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-[#060913]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400 font-mono shadow-md backdrop-blur-xl shrink-0"
              >
                <span className="flex size-2 rounded-full bg-orange-500 animate-ping" />
                <span>Join Batch 15 Cohort Sprint</span>
              </div>
            </div>

            {/* Target Cohort Reservation Indicator */}
            {targetCohortId && (
              (() => {
                const deadlineCheck = targetCohort ? checkCohortEnrollmentDeadline(targetCohort) : null;
                const isClosed = deadlineCheck?.isClosed;
                return (
                  <div className={`mt-2.5 rounded-xl border p-2.5 text-xs flex items-center justify-between shadow-lg ${
                    isClosed
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 shadow-rose-500/10'
                      : 'border-orange-500/30 bg-orange-500/10 text-orange-200 shadow-orange-500/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`flex size-6 items-center justify-center rounded-lg shrink-0 ${
                        isClosed ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <span className="font-bold text-white block text-xs">
                          {targetCohort?.name ? `Joining ${targetCohort.name}` : 'Cohort Selected for Checkout'}
                        </span>
                        <span className={`text-[10px] ${isClosed ? 'text-rose-300 font-semibold' : 'text-orange-300/80'}`}>
                          {isClosed
                            ? deadlineCheck?.reason
                            : targetCohort?.price_inr
                            ? `₹${targetCohort.price_inr.toLocaleString('en-IN')} ${targetCohort.currency || 'INR'} • Seat held during signup`
                            : 'Seat reserved for checkout after email verification'}
                        </span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider font-bold shrink-0 ${
                      isClosed ? 'bg-rose-500/20 text-rose-300' : 'bg-orange-500/20 text-orange-300'
                    }`}>
                      {isClosed ? 'Closed' : 'Step 1 of 2'}
                    </span>
                  </div>
                );
              })()
            )}

            {/* Network Failure / General Error Banner */}
            {error && (
              <div className={`mt-3 rounded-xl border p-3 text-xs backdrop-blur-xl ${
                isNetworkError
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className={`shrink-0 mt-0.5 ${isNetworkError ? 'text-amber-400' : 'text-red-400'}`} />
                  <div className="space-y-1.5 flex-1">
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

            <form onSubmit={handleRegister} className="mt-3.5 space-y-3">
              {/* Row 1: Full Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  id="full-name"
                  label="Full name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Editor"
                  labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                  inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                />
                <FormField
                  id="register-email"
                  label="Email address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                  inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                />
              </div>

              {/* Row 2: Phone Number */}
              <FormField
                id="register-phone"
                label="Phone number"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                hint="Used for cohort WhatsApp group & critical schedule updates"
                labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />

              {/* Row 3: Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  id="register-password"
                  aria-label="Password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                  inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                  rightElement={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPassword((prev) => !prev);
                      }}
                      className="text-slate-400 hover:text-white transition-colors p-1 focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                />
                <FormField
                  id="register-confirm-password"
                  aria-label="Confirm Password"
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength={6}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  labelClassName="mb-1.5 block text-xs font-mono font-bold uppercase tracking-wider text-slate-300"
                  inputClassName="w-full rounded-xl border border-white/10 bg-[#060913]/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
                  rightElement={
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowConfirmPassword((prev) => !prev);
                      }}
                      className="text-slate-400 hover:text-white transition-colors p-1 focus:outline-none cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide' : 'Show'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-[#060913]/80 px-3 py-2 text-[11px] text-slate-400">
                <span className="font-semibold text-white">Cohort Role:</span> All candidate registrations join as students. Senior mentors are approved and assigned by administrators.
              </div>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                data-cursor="CREATE ACCOUNT"
                onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-2.5 sm:py-3 hover:scale-[1.01] transition-all"
              >
                {loading ? 'Creating account...' : 'Create my account'}
              </Button>
            </form>

            <div className="mt-4 pt-3 border-t border-white/10 text-center">
              <p className="text-xs sm:text-sm text-slate-400">
                Already enrolled?{' '}
                <Link
                  to={targetCohortId ? `/login?cohort=${encodeURIComponent(targetCohortId)}` : '/login'}
                  onMouseEnter={() => soundFx.playBlip(460, 0.02, 'sine', 0.02)}
                  className="font-bold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 transition-colors"
                >
                  <span>Log in</span>
                  <ArrowRight size={13} />
                </Link>
              </p>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-mono">
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