import { useState, useEffect } from 'react';
import { ShieldAlert, Play, Lock, AlertTriangle } from 'lucide-react';

export interface ScreenProtectionOverlayProps {
  isRestricted: boolean;
  restrictionReason: string | null;
  watermarkText: string;
  watermarkPosition?: { x: number; y: number };
  onDismissRestriction: () => void;
  showWatermark?: boolean;
}

export function ScreenProtectionOverlay({
  isRestricted,
  restrictionReason,
  watermarkText,
  onDismissRestriction,
  showWatermark = true,
}: ScreenProtectionOverlayProps) {
  // Verification cooldown to prevent rapid bypassing of security shields
  const [cooldown, setCooldown] = useState<number>(() =>
    import.meta.env?.MODE === 'test' ? 0 : 3
  );

  useEffect(() => {
    if (!isRestricted) return;

    if (import.meta.env?.MODE !== 'test') {
      setCooldown(3);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isRestricted]);

  return (
    <>
      {/* Discrete Corner Forensic Watermark (Clean Enterprise LMS Style: ~20-25% opacity, anchored to corner, completely unobstructed viewing in normal and fullscreen) */}
      {!isRestricted && showWatermark && (
        <div
          data-testid="student-forensic-watermark"
          aria-hidden="true"
          className="pointer-events-none absolute bottom-12 right-4 z-40 select-none opacity-25 sm:opacity-30 transition-opacity"
        >
          <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2.5 py-1 text-[11px] font-mono text-white/95 backdrop-blur-xs border border-white/15 shadow-md">
            <Lock size={11} className="text-orange-400 shrink-0" />
            <span>{watermarkText}</span>
          </div>
        </div>
      )}

      {/* Full-Screen Anti-Recording / Anti-Share Protection Shield */}
      {isRestricted && (
        <div
          data-testid="screen-protection-shield"
          role="alert"
          aria-live="assertive"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black p-6 text-center select-none"
        >
          {/* Animated Warning Emblem */}
          <div className="relative mb-3 flex size-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-2xl shadow-red-500/20">
            <ShieldAlert size={28} className="animate-pulse" />
            <span className="absolute -top-1 -right-1 flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-red-500" />
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
            Content Protection Active
          </h3>
          <p className="mt-1 text-xs text-slate-300 max-w-md leading-relaxed">
            Screen recording, display capture, and unauthorized screen sharing are restricted for Iunoware Academy video streams.
          </p>

          {restrictionReason && (
            <div className="my-2.5 inline-flex items-center gap-1.5 rounded-full bg-red-950/60 border border-red-500/30 px-3 py-1 text-[11px] font-mono text-red-300">
              <span className="size-1.5 rounded-full bg-red-400" />
              <span>{restrictionReason}</span>
            </div>
          )}

          {/* Forensic Legal Accountability Notice */}
          <div className="my-3 max-w-md rounded-xl bg-slate-900/90 border border-white/10 p-3 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 mb-1">
              <AlertTriangle size={13} className="shrink-0" />
              <span>Forensic Attribution Active</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed font-mono truncate">
              Session watermarked to: <span className="text-white font-bold">{watermarkText}</span>
            </p>
            <p className="mt-1 text-[9px] text-slate-400 leading-normal">
              All playback frames are indelibly watermarked with your student credentials. Any unauthorized recording or distribution is strictly prohibited and subject to immediate account termination.
            </p>
          </div>

          <button
            type="button"
            disabled={cooldown > 0}
            onClick={onDismissRestriction}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95 ${
              cooldown > 0
                ? 'bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-500/25 cursor-pointer'
            }`}
          >
            <Play size={14} fill="currentColor" />
            <span>
              {cooldown > 0
                ? `Verifying System Security (${cooldown}s)...`
                : 'I Have Stopped Recording — Resume Playback'}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
