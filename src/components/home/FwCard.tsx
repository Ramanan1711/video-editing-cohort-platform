import React, { useState } from 'react';
import { ArrowUpRight, Play, ShieldCheck, Layers, Award } from 'lucide-react';
import { FwFigure, type FwFigureProps } from './FwFigure';
import { soundFx } from '../../lib/soundFx';

export interface FwCardProps {
  figure: FwFigureProps;
  kicker: string;
  title: string;
  description: string;
  href?: string;
  className?: string;
  cursorLabel?: string;
  onClick?: () => void;
  timecode?: string;
  codec?: string;
  rubricScore?: string;
  software?: string[];
  accentColor?: string;
  isExpanded?: boolean;
  isActive?: boolean;
  onHover?: () => void;
}

/**
 * FwCard - Junca Studio Showcase Card Enhanced with:
 * - Authentic 4K Cinema Viewfinder HUD (REC ●, timecode, codec, framerate)
 * - Animated Audio Waveform / Frequency Equalizer on hover
 * - Cryptographic Senior Mentor Rubric Score badge
 * - Software stack tech pills (AE, Premiere, DaVinci, Audition)
 * - Dynamic kinetic text displacement and expanding arrow action trigger
 */
export const FwCard: React.FC<FwCardProps> = ({
  figure,
  kicker,
  title,
  description,
  href = '#active-cohorts',
  className = '',
  cursorLabel = 'INSPECT DELIVERABLE',
  onClick,
  timecode = '00:14:22:18',
  codec = '4K PRORES 422 HQ',
  rubricScore = '99% RUBRIC MATCH',
  software = [],
  accentColor = '#B92B27',
  isExpanded: _isExpanded = true,
  isActive = false,
  onHover,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    soundFx.playBlip(540, 0.025, 'sine', 0.02);
    onHover?.();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <li
      className={`fw__card group relative transition-all duration-500 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <a
        href={href}
        data-cursor={cursorLabel}
        onClick={(e) => {
          soundFx.playSweep(280, 640, 0.1, 0.04);
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        className="fw__link flex flex-col items-start gap-4 text-decoration-none cursor-pointer w-full"
        aria-label={`${title} - ${kicker}`}
      >
        {/* Cinema Viewfinder & Figure Container */}
        <div
          className={`relative w-full rounded-2xl overflow-hidden border transition-all duration-500 shadow-xl bg-[#030712] ${
            isActive
              ? 'border-white/40 ring-1 ring-white/20 shadow-2xl'
              : 'border-white/10 group-hover:border-white/30'
          }`}
          style={{
            borderColor: isActive ? `${accentColor}80` : undefined,
          }}
        >
          {/* Subtle Ambient Accent Glow on Hover / Active */}
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-700 blur-xl ${
              isActive ? 'opacity-25' : 'opacity-0 group-hover:opacity-20'
            }`}
            style={{ backgroundColor: accentColor }}
          />

          {/* Top Glowing Edge Accent Line */}
          <div
            className="absolute top-0 inset-x-0 h-1 transition-opacity duration-500 z-30 pointer-events-none"
            style={{
              backgroundColor: accentColor,
              opacity: isActive || isHovered ? 1 : 0.35,
            }}
          />

          {/* Top Cinema HUD Bar */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between text-[10px] font-mono tracking-widest pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 border border-white/15 backdrop-blur-md text-white">
              <span
                className="size-1.5 rounded-full animate-ping"
                style={{ backgroundColor: accentColor }}
              />
              <span className="font-bold text-red-400">REC ●</span>
              <span className="text-white/80">{timecode}</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 border border-white/15 backdrop-blur-md text-slate-300">
              <span>{codec}</span>
            </div>
          </div>

          {/* Viewfinder Framing Crosshairs */}
          <div className="absolute top-2.5 left-2.5 size-3 border-t border-l border-white/40 pointer-events-none z-20" />
          <div className="absolute top-2.5 right-2.5 size-3 border-t border-r border-white/40 pointer-events-none z-20" />
          <div className="absolute bottom-2.5 left-2.5 size-3 border-b border-l border-white/40 pointer-events-none z-20" />
          <div className="absolute bottom-2.5 right-2.5 size-3 border-b border-r border-white/40 pointer-events-none z-20" />

          {/* Image Figure */}
          <FwFigure {...figure} />

          {/* Center Play Indicator on Hover */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div
              className={`flex size-14 items-center justify-center rounded-full bg-black/60 border border-white/30 backdrop-blur-md text-white shadow-2xl transition-all duration-300 ${
                isHovered || isActive
                  ? 'scale-110 opacity-100'
                  : 'scale-90 opacity-0 sm:opacity-40'
              }`}
            >
              <Play size={20} className="fill-white translate-x-0.5" />
            </div>
          </div>

          {/* Bottom Floating Bar: Rubric Score + Audio Equalizer */}
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 border border-[#38B44A]/30 backdrop-blur-md text-[#38B44A] text-[10px] font-mono font-bold">
              <Award size={12} />
              <span>{rubricScore}</span>
            </div>

            {/* Dynamic Equalizer Waveform */}
            <div className="flex items-end gap-0.5 h-3.5 px-2 py-1 rounded-md bg-black/75 border border-white/15 backdrop-blur-md">
              {[4, 11, 7, 13, 6, 12, 5].map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full transition-all duration-300"
                  style={{
                    height: isHovered || isActive ? `${h}px` : '3px',
                    backgroundColor: accentColor,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Text & Interactive Trigger Bar */}
        <div className="fw__art w-full flex items-start justify-between gap-4 pt-1">
          <div className="fw__txt flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="fw__kicker text-[11px] font-mono tracking-wider uppercase text-slate-400 font-bold">
                {kicker}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[10px] font-mono text-[#38B44A] flex items-center gap-1">
                <ShieldCheck size={11} /> 100% SLA Defended
              </span>
            </div>

            <h3 className="fw__title text-lg sm:text-xl font-black text-white group-hover:text-[#F2B705] transition-colors">
              {title}
            </h3>

            <p className="fw__text text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
              {description}
            </p>

            {/* Software badges */}
            {software.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                {software.map((sw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300"
                  >
                    <Layers size={10} className="text-[#F2B705]" />
                    {sw}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className="fw__ic size-10 rounded-full flex items-center justify-center shrink-0 border border-white/15 group-hover:border-white text-white transition-all group-hover:scale-110"
            style={{
              backgroundColor: isHovered || isActive ? accentColor : 'rgba(255,255,255,0.08)',
            }}
            aria-hidden="true"
          >
            <ArrowUpRight size={18} />
          </div>
        </div>
      </a>
    </li>
  );
};
