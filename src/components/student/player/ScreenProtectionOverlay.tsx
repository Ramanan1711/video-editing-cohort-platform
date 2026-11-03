import { ShieldAlert, Play, Lock } from 'lucide-react';

export interface ScreenProtectionOverlayProps {
  isRestricted: boolean;
  restrictionReason: string | null;
  watermarkText: string;
  watermarkPosition: { x: number; y: number };
  onDismissRestriction: () => void;
  showWatermark?: boolean;
}

export function ScreenProtectionOverlay({
  isRestricted,
  restrictionReason,
  watermarkText,
  watermarkPosition,
  onDismissRestriction,
  showWatermark = true,
}: ScreenProtectionOverlayProps) {
  return (
    <>
      {/* 1. Dynamic Forensic Watermark (Drifts across the video surface during playback) */}
      {!isRestricted && showWatermark && (
        <div
          data-testid="student-forensic-watermark"
          aria-hidden="true"
          style={{
            top: `${watermarkPosition.y}%`,
            left: `${watermarkPosition.x}%`,
            transition: 'top 1.8s ease-in-out, left 1.8s ease-in-out',
          }}
          className="pointer-events-none absolute z-20 select-none opacity-25 dark:opacity-30 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-mono font-medium text-white/90 backdrop-blur-xs border border-white/10 shadow-sm whitespace-nowrap">
            <Lock size={10} className="text-orange-400 shrink-0" />
            <span>{watermarkText}</span>
          </div>
        </div>
      )}

      {/* 2. Full-Screen Anti-Recording / Anti-Share Protection Shield */}
      {isRestricted && (
        <div
          data-testid="screen-protection-shield"
          role="alert"
          aria-live="assertive"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-lg animate-in fade-in zoom-in-95 duration-200 select-none"
        >
          {/* Animated Warning Emblem */}
          <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-2xl shadow-red-500/20">
            <ShieldAlert size={32} className="animate-pulse" />
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
            <div className="my-3.5 inline-flex items-center gap-1.5 rounded-full bg-red-950/60 border border-red-500/30 px-3 py-1 text-[11px] font-mono text-red-300">
              <span className="size-1.5 rounded-full bg-red-400" />
              <span>{restrictionReason}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 max-w-sm mb-5 leading-normal">
            Please stop any active screen share (Zoom, Meet, Discord) or close recording software to continue viewing this proprietary lesson.
          </p>

          <button
            type="button"
            onClick={onDismissRestriction}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 transition active:scale-95 cursor-pointer"
          >
            <Play size={14} fill="currentColor" />
            <span>I Have Stopped Recording — Resume Playback</span>
          </button>
        </div>
      )}
    </>
  );
}
