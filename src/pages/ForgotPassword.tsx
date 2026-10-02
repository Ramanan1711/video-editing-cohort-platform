import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Mail,
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

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      soundFx.playChime();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
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
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/15 text-orange-400 shadow-lg shadow-orange-500/10">
                  <Mail size={26} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Check your inbox
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  We sent a password recovery link to{' '}
                  <span className="font-bold text-orange-300 font-mono">{email}</span>. Click the link in the email to recover your password.
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#060913]/90 p-4 text-xs text-slate-400 text-left space-y-1 backdrop-blur-xl">
                  <p className="font-mono font-bold uppercase tracking-wider text-amber-300">Important tip:</p>
                  <p className="leading-relaxed">
                    Recovery links expire quickly and can only be used once. Please open the link promptly in this browser.
                  </p>
                </div>

                <div className="mt-7 flex flex-col gap-3">
                  <Button
                    variant="secondary"
                    className="w-full justify-center bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3"
                    onMouseEnter={() => soundFx.playBlip(440, 0.02, 'sine', 0.02)}
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                  >
                    Try another email
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
                  Don't worry, happens to all of us. Enter your email below to recover your password.
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
                    data-cursor="SEND LINK"
                    onMouseEnter={() => soundFx.playBlip(480, 0.025, 'sine', 0.03)}
                    className="w-full justify-center bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black border-none shadow-xl shadow-orange-500/25 py-3.5 hover:scale-[1.01] transition-all"
                  >
                    {loading ? 'Sending link...' : 'Send Recovery Link'}
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

