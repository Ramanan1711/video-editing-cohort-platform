import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
  Play,
  X,
  Flame,
  Video,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

export interface CelebrationOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortName: string;
  cohortId?: string;
  studentName?: string;
  whatsappGroupUrl?: string;
  onLaunchLesson1?: () => void;
}

export const CelebrationOnboardingModal: React.FC<CelebrationOnboardingModalProps> = ({
  isOpen,
  onClose,
  cohortName,
  studentName = 'Editor',
  whatsappGroupUrl,
  onLaunchLesson1,
}) => {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  const defaultWhatsappUrl =
    whatsappGroupUrl || 'https://chat.whatsapp.com/sample-cohort-group';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Darkened backdrop with blur */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-orange-500/30 bg-slate-900 text-slate-100 shadow-2xl shadow-orange-500/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow ambient background accents */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close onboarding modal"
          className="absolute top-4 right-4 z-10 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          <X size={18} />
        </button>

        {/* Header Hero Banner */}
        <div className="relative border-b border-white/10 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/30 animate-bounce">
            <Sparkles size={32} />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-orange-400">
            <Flame size={13} className="text-orange-500" />
            Enrollment Confirmed
          </span>

          <h2 id="celebration-title" className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight">
            Welcome to the Sprint, {studentName}!
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 font-medium">
            You are officially enrolled in{' '}
            <strong className="text-orange-400 font-bold">{cohortName}</strong>.
            Your editing terminal is primed and ready.
          </p>
        </div>

        {/* 3-Step Kickoff Orientation */}
        <div className="p-6 sm:p-8 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Sprint Kickoff Checklist
          </h3>

          <div className="space-y-3">
            {/* Step 1: Verified Seat */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-white/5 bg-white/5 p-4 transition">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Production Seat Reserved &amp; Active</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your seat in this 15-day cohort is officially secured. Full access to raw footage, project files, and timeline templates is granted.
                </p>
              </div>
            </div>

            {/* Step 2: WhatsApp Mentorship */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 transition">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                <MessageCircle size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white">Join Private WhatsApp Mentorship</h4>
                  <a
                    href={defaultWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white transition shadow-xs"
                  >
                    <span>Connect</span>
                    <ArrowRight size={10} />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Daily feedback, live call links, and timeline critiques happen directly in our private mentor channel.
                </p>
              </div>
            </div>

            {/* Step 3: Day 1 Mission */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-orange-500/20 bg-orange-950/20 p-4 transition">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
                <Video size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Day 1 Production Mission</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Watch Lesson 1 (reach ≥80% progress to unlock milestone credit) and download the raw footage package.
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition order-2 sm:order-1 text-center"
            >
              Explore Catalog First
            </button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose();
                onLaunchLesson1?.();
              }}
              className="w-full sm:w-auto shadow-xl shadow-orange-500/25 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold order-1 sm:order-2 justify-center"
            >
              <Play size={14} fill="currentColor" />
              <span>Let&apos;s Cut! Launch Lesson 1</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
