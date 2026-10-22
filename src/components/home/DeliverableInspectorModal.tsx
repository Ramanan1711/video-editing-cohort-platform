import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Award,
  CheckCircle2,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import { soundFx } from '../../lib/soundFx';
import { Button } from '../ui/Button';

export interface DeliverableDetails {
  id: string;
  kicker: string;
  title: string;
  description: string;
  imgSrc: string;
  alt: string;
  tags: string[];
  accentColor: string;
  timecode: string;
  codec: string;
  rubricScore: string;
  duration: string;
  software: string[];
  specs: {
    resolution: string;
    fps: string;
    audio: string;
    files: string;
  };
  rubricBreakdown: {
    pacing: number;
    motion: number;
    audio: number;
    color: number;
  };
  mentorNote: string;
  mentorName: string;
  mentorRole: string;
}

interface DeliverableInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverable: DeliverableDetails | null;
}

export const DeliverableInspectorModal: React.FC<DeliverableInspectorModalProps> = ({
  isOpen,
  onClose,
  deliverable,
}) => {
  useModalScrollLock(isOpen);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(14);

  // Reset or run simulated timecode ticker while modal is playing
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackSeconds((prev) => (prev >= 45 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playBlip(320, 0.03, 'sine', 0.02);
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !deliverable) return null;

  const formattedTime = `00:00:${playbackSeconds.toString().padStart(2, '0')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliverable-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-300"
    >
      {/* Dark Ambient Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-[#030712]/85 backdrop-blur-xl transition-opacity"
        onClick={() => {
          soundFx.playBlip(300, 0.03, 'sine', 0.02);
          onClose();
        }}
      />

      {/* Ambient Volumetric Color Fog */}
      <div
        className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[550px] rounded-full blur-[160px] opacity-25"
        style={{ backgroundColor: deliverable.accentColor }}
      />

      {/* Main Modal Card */}
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e1320] via-[#080c16] to-[#04060c] p-5 sm:p-7 md:p-9 shadow-2xl shadow-black/80 text-white flex flex-col gap-6 custom-scrollbar">
        {/* Top Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-0.5 text-[11px] font-mono font-bold tracking-wider uppercase border border-white/15 bg-white/5">
              <span
                className="size-2 rounded-full animate-pulse"
                style={{ backgroundColor: deliverable.accentColor }}
              />
              <span className="text-slate-300">{deliverable.kicker}</span>
              <span className="text-white/20">•</span>
              <span className="text-[#38B44A] flex items-center gap-1">
                <ShieldCheck size={12} /> Verified Deliverable
              </span>
            </div>
            <h2
              id="deliverable-modal-title"
              className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white"
            >
              {deliverable.title}
            </h2>
          </div>

          <button
            onClick={() => {
              soundFx.playBlip(320, 0.03, 'sine', 0.02);
              onClose();
            }}
            className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Cinema Monitor Player HUD (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl border border-white/15 bg-black group shadow-xl">
              <img
                src={deliverable.imgSrc}
                alt={deliverable.alt}
                className={`size-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />

              {/* CRT Scanline & Grain Scrim */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

              {/* Viewfinder HUD Framing Corners */}
              <div className="absolute top-3 left-3 size-4 border-t-2 border-l-2 border-white/70 pointer-events-none" />
              <div className="absolute top-3 right-3 size-4 border-t-2 border-r-2 border-white/70 pointer-events-none" />
              <div className="absolute bottom-3 left-3 size-4 border-b-2 border-l-2 border-white/70 pointer-events-none" />
              <div className="absolute bottom-3 right-3 size-4 border-b-2 border-r-2 border-white/70 pointer-events-none" />

              {/* Viewfinder Top Telemetry */}
              <div className="absolute top-3 left-8 right-8 flex items-center justify-between text-[11px] font-mono tracking-widest pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold text-red-400">REC ●</span>
                  <span className="text-white/80">{formattedTime}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span>{deliverable.specs.resolution}</span>
                  <span>•</span>
                  <span>{deliverable.specs.fps} FPS</span>
                </div>
              </div>

              {/* Center Play Overlay Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => {
                    soundFx.playSweep(260, 680, 0.1, 0.05);
                    setIsPlaying((p) => !p);
                  }}
                  className="flex size-14 sm:size-16 items-center justify-center rounded-full bg-black/60 border border-white/30 backdrop-blur-md text-white shadow-2xl hover:scale-110 hover:border-white transition-all group-hover:bg-[#B92B27]/80"
                  aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {isPlaying ? (
                    <Pause size={24} className="fill-white" />
                  ) : (
                    <Play size={24} className="fill-white translate-x-0.5" />
                  )}
                </button>
              </div>

              {/* Bottom Scrubber & Audio Controls */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundFx.playBlip(440, 0.03, 'sine', 0.02);
                      setIsMuted((m) => !m);
                    }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-white/20 text-white transition"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                  <span className="text-[11px] text-slate-300 font-mono">
                    {deliverable.specs.audio}
                  </span>
                </div>

                {/* Simulated Audio EQ Visualizer */}
                <div className="flex items-end gap-0.5 h-4">
                  {[4, 12, 8, 14, 6, 11, 7, 13, 9, 5].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full transition-all duration-200"
                      style={{
                        height: isPlaying ? `${Math.max(3, (h * (i % 2 === 0 ? 1.2 : 0.8))) % 16}px` : '3px',
                        backgroundColor: deliverable.accentColor,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Technical Specifications Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Resolution</p>
                <p className="text-slate-200 font-bold mt-0.5">{deliverable.specs.resolution}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Framerate</p>
                <p className="text-slate-200 font-bold mt-0.5">{deliverable.specs.fps} FPS</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Master Audio</p>
                <p className="text-slate-200 font-bold mt-0.5">{deliverable.specs.audio}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Stems / RAW</p>
                <p className="text-slate-200 font-bold mt-0.5">{deliverable.specs.files}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Mentor Audit Rubric & Notes (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Description */}
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              {deliverable.description}
            </p>

            {/* Software Stack Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                Software &amp; Tools Used
              </span>
              <div className="flex flex-wrap gap-2">
                {deliverable.software.map((tool, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-white/5 border border-white/15 text-white"
                  >
                    <Layers size={12} className="text-[#F2B705]" />
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Mentor Rubric Scorecard */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Award size={15} className="text-[#38B44A]" />
                  <span>Senior Mentor Audit Score</span>
                </div>
                <span className="text-xs font-mono font-black text-[#38B44A] bg-[#38B44A]/10 px-2 py-0.5 rounded border border-[#38B44A]/25">
                  {deliverable.rubricScore}
                </span>
              </div>

              {/* Rubric Criteria Bars */}
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Storytelling &amp; Retention Hooks</span>
                    <span className="font-bold">{deliverable.rubricBreakdown.pacing}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B92B27] to-[#F2B705]"
                      style={{ width: `${deliverable.rubricBreakdown.pacing * 10}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Kinetic Easing &amp; Motion Curve</span>
                    <span className="font-bold">{deliverable.rubricBreakdown.motion}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2675EB] to-[#38B44A]"
                      style={{ width: `${deliverable.rubricBreakdown.motion * 10}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Loudness &amp; Multi-Stem Mix</span>
                    <span className="font-bold">{deliverable.rubricBreakdown.audio}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#F2B705] to-[#38B44A]"
                      style={{ width: `${deliverable.rubricBreakdown.audio * 10}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Color primaries &amp; Scope Legibility</span>
                    <span className="font-bold">{deliverable.rubricBreakdown.color}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B92B27] to-[#2675EB]"
                      style={{ width: `${deliverable.rubricBreakdown.color * 10}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mentor Feedback Quote */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent p-3.5 space-y-1.5">
              <p className="text-xs italic text-slate-300 leading-relaxed">
                &quot;{deliverable.mentorNote}&quot;
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono">
                <CheckCircle2 size={13} className="text-[#38B44A]" />
                <span className="font-bold text-white">{deliverable.mentorName}</span>
                <span>•</span>
                <span>{deliverable.mentorRole}</span>
              </div>
            </div>

            {/* Call to action */}
            <div className="pt-2">
              <Button
                href="#active-cohorts"
                size="md"
                withArrow
                onClick={() => {
                  soundFx.playSweep(260, 680, 0.1, 0.05);
                  onClose();
                }}
                className="w-full justify-center bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] text-white font-black border-none shadow-lg shadow-[#B92B27]/25 py-3"
              >
                Enroll to Build Deliverables Like This
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
