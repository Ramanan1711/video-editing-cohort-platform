import React, { useState, useEffect } from 'react';
import { MessageCircle, ExternalLink, X, Sparkles, Phone, Users } from 'lucide-react';
import {
  DEFAULT_ACADEMY_WHATSAPP,
  DEFAULT_WHATSAPP_GROUP_FALLBACK_URL,
  generateWhatsAppClickToChatUrl,
} from '../../lib/whatsappService';

export interface WhatsAppBatchGroupBannerProps {
  cohortId?: string;
  cohortName?: string;
  whatsappGroupUrl?: string | null;
  mentorPhone?: string | null;
  studentName?: string;
}

export const WhatsAppBatchGroupBanner: React.FC<WhatsAppBatchGroupBannerProps> = ({
  cohortId,
  cohortName = 'Production Batch',
  whatsappGroupUrl,
  mentorPhone = DEFAULT_ACADEMY_WHATSAPP,
  studentName = 'Editor',
}) => {
  const storageKey = cohortId ? `dismissed_wa_group_${cohortId}` : null;
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (!storageKey || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (storageKey) {
      try {
        setIsMinimized(localStorage.getItem(storageKey) === 'true');
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  const targetGroupUrl = whatsappGroupUrl?.trim() || DEFAULT_WHATSAPP_GROUP_FALLBACK_URL;
  const targetMentorPhone = mentorPhone?.trim() || DEFAULT_ACADEMY_WHATSAPP;

  const handleDismiss = () => {
    setIsMinimized(true);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {
        // ignore
      }
    }
  };

  const handleRestore = () => {
    setIsMinimized(false);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  };

  const mentorChatUrl = generateWhatsAppClickToChatUrl(
    targetMentorPhone,
    `Hi Mentor! I am ${studentName} from ${cohortName}. I have a question regarding the batch schedule and lessons.`
  );

  // If minimized, display a sleek floating / inline pill to re-open the WhatsApp community link
  if (isMinimized) {
    return (
      <aside aria-label="WhatsApp Community Links" className="px-4 sm:px-6 py-1.5 bg-emerald-950/40 border-b border-emerald-900/40 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-200">
            {cohortName} WhatsApp Community:
          </span>
          <a
            href={targetGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            <span>Batch Group</span>
            <ExternalLink size={11} />
          </a>
          <span className="text-emerald-600/70">•</span>
          <a
            href={mentorChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-300 hover:text-emerald-300"
          >
            <Phone size={10} className="text-emerald-400" />
            <span>Ask Mentor</span>
          </a>
        </div>
        <button
          onClick={handleRestore}
          aria-label="Expand Batch Community banner"
          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-200 transition"
        >
          Show Details
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Official Batch WhatsApp Group Announcement"
      className="relative overflow-hidden border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 px-4 sm:px-6 py-3.5 text-white shadow-md shadow-emerald-950/20"
    >
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-12 -left-12 size-36 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-12 size-36 rounded-full bg-teal-500/10 blur-2xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Banner Left Info */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Users size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                <Sparkles size={11} className="text-emerald-400" />
                Official Cohort Group
              </span>
              <h2 className="text-xs sm:text-sm font-black text-white tracking-tight">
                🎉 You are enrolled in {cohortName}!
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-300 font-medium">
              Join your private batch channel for midnight challenge drops, peer timelines, and direct mentor critiques.
            </p>
          </div>
        </div>

        {/* Action Buttons & Dismiss */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {/* Direct Mentor Support */}
          <a
            href={mentorChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 transition"
            title="Chat 1-on-1 with Academy Mentor"
          >
            <Phone size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">1-on-1</span>
            <span>Mentor Help</span>
          </a>

          {/* Join Group CTA */}
          <a
            href={targetGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3.5 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <MessageCircle size={14} fill="currentColor" />
            <span>Join WhatsApp Batch Group</span>
            <ExternalLink size={12} />
          </a>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss WhatsApp Batch Group banner"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition ml-1"
            title="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
