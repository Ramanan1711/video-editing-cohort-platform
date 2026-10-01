import React, { useEffect, useRef, useState } from 'react';

/**
 * RobotTerminal - Junca Studio signature 3D Robot Character & Workstation Terminal:
 * - Interactive 3D head and eye-tracking following the cursor coordinates
 * - Retro CRT monitor with glowing phosphor text, scanlines, and blinking prompt
 * - Rotating ventilation fan inside recessed cooling cowl
 * - Metallic specular edge highlights and glowing orange status LED
 */
export const RobotTerminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [time, setTime] = useState<string>('v0.1');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Normalized from -1 to 1
      const nx = (e.clientX / innerWidth - 0.5) * 2;
      const ny = (e.clientY / innerHeight - 0.5) * 2;

      // Soft tilt angles (max +/- 12 deg)
      setRotation({
        x: -ny * 10,
        y: nx * 14,
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().getSeconds() % 2 === 0 ? 'ATTENTIF' : 'SCANNING');
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[480px] lg:max-w-[560px] aspect-square flex items-center justify-center select-none pointer-events-none"
      style={{ perspective: 1200 }}
    >
      {/* Volumetric Crimson Atmospheric Smoke Aura */}
      <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-red-600/30 via-red-900/20 to-transparent blur-[90px] animate-pulse-glow-slow" />
      <div className="absolute top-1/4 -right-12 size-72 rounded-full bg-orange-600/20 blur-[100px] pointer-events-none" />

      {/* 3D Tilt Container */}
      <div
        className="relative w-full h-full flex flex-col items-center justify-center transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
      >
        {/* ================= ROBOT HEAD WITH VISOR MONITOR ================= */}
        <div className="relative z-20 w-[280px] sm:w-[320px] transition-transform duration-200">
          {/* Head Canopy / Visor Roof */}
          <div className="relative mx-auto w-[260px] sm:w-[300px] h-[34px] rounded-t-2xl bg-gradient-to-b from-[#3a2020] via-[#221212] to-[#140a0a] border-t border-red-500/40 shadow-2xl flex items-center justify-between px-6">
            <div className="flex items-center gap-1">
              <span className="size-1 rounded-full bg-red-400" />
              <span className="size-1 rounded-full bg-red-400/60" />
            </div>
            <div className="h-1 w-16 rounded-full bg-red-500/30" />
          </div>

          {/* Head Body & Visor Frame */}
          <div className="relative w-full h-[170px] sm:h-[190px] rounded-2xl bg-gradient-to-b from-[#1f1010] via-[#120808] to-[#0a0505] p-3.5 border border-red-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,100,100,0.2)]">
            {/* Side Intake Fins */}
            <div className="absolute -left-3 top-10 flex flex-col gap-1.5 w-3">
              <span className="h-4 bg-[#2a1414] border-l border-red-500/40 rounded-l-xs" />
              <span className="h-4 bg-[#2a1414] border-l border-red-500/40 rounded-l-xs" />
              <span className="h-4 bg-[#2a1414] border-l border-red-500/40 rounded-l-xs" />
            </div>
            <div className="absolute -right-3 top-10 flex flex-col gap-1.5 w-3">
              <span className="h-4 bg-[#2a1414] border-r border-red-500/40 rounded-r-xs" />
              <span className="h-4 bg-[#2a1414] border-r border-red-500/40 rounded-r-xs" />
              <span className="h-4 bg-[#2a1414] border-r border-red-500/40 rounded-r-xs" />
            </div>

            {/* Recessed CRT Terminal Screen */}
            <div className="relative size-full rounded-xl bg-gradient-to-b from-[#0d0404] via-[#050202] to-[#000000] border border-red-950/80 p-5 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Scanlines Effect Overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 60, 60, 0.4) 3px)',
                }}
              />

              {/* CRT Phosphor Glass Curve Glow */}
              <div className="absolute -top-12 -left-12 size-36 rounded-full bg-red-500/10 blur-xl pointer-events-none" />

              {/* Screen Top: Prompt */}
              <div className="relative z-10 font-mono text-[11px] sm:text-xs text-red-400 tracking-wider flex items-center gap-1.5">
                <span className="text-red-500">&gt;</span>
                <span className="font-bold">awaiting input</span>
                <span className="inline-block size-2 bg-red-400 animate-pulse ml-0.5" />
              </div>

              {/* Screen Bottom: Telemetry */}
              <div className="relative z-10 font-mono text-[9px] sm:text-[10px] text-red-500/80 tracking-widest flex items-center justify-between border-t border-red-900/30 pt-2">
                <span>AJAY RAMANAN 01 v0.1</span>
                <span className="text-red-400 font-bold uppercase">{time}</span>
              </div>
            </div>
          </div>

          {/* Neck Joint Pivot */}
          <div className="mx-auto -mt-1 w-20 h-6 bg-gradient-to-r from-[#2a1515] via-[#4d2828] to-[#2a1515] rounded-b-md border-x border-b border-red-500/30 shadow-md" />
        </div>

        {/* ================= ROBOT TORSO CHASSIS WITH FAN & LED ================= */}
        <div className="relative z-10 w-[310px] sm:w-[360px] h-[190px] sm:h-[220px] rounded-3xl bg-gradient-to-b from-[#180a0a] via-[#100606] to-[#080303] border border-red-500/30 shadow-[0_30px_70px_rgba(0,0,0,0.95)] p-5 flex flex-col justify-between overflow-hidden">
          {/* Top Edge Metallic Specular Bevel */}
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          {/* Torso Top Area: Ventilation Turbine Fan */}
          <div className="flex items-center justify-between">
            {/* Ventilation Turbine Cowl */}
            <div className="relative size-16 sm:size-20 rounded-full bg-[#0a0404] border-2 border-red-900/60 p-1 flex items-center justify-center shadow-inner">
              {/* Spinning Fan Blades */}
              <div className="relative size-full animate-spin duration-3000">
                <svg viewBox="0 0 24 24" className="size-full text-red-600/80" fill="currentColor">
                  <path d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z" />
                  <path
                    d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z"
                    transform="rotate(120 12 12)"
                  />
                  <path
                    d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z"
                    transform="rotate(240 12 12)"
                  />
                  <circle cx="12" cy="12" r="2.4" fill="#2d1212" />
                </svg>
              </div>
            </div>

            {/* Glowing Orange Status Indicator Bar */}
            <div className="flex flex-col items-end gap-2">
              <div className="h-3 w-14 rounded-sm bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)] border border-orange-400" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                SYS ONLINE
              </span>
            </div>
          </div>

          {/* Torso Bottom Area: Micro Vent Grill Dots */}
          <div className="pt-4 border-t border-red-950/60 flex items-center justify-between">
            <div className="grid grid-cols-12 gap-1.5 opacity-40">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="size-1 rounded-full bg-red-400" />
              ))}
            </div>
            <div className="font-mono text-[9px] text-red-500/60 uppercase tracking-widest">
              REV 2.06
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
