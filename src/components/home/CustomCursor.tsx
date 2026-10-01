import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export const CustomCursor: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [cursorText, setCursorText] = useState<string | null>(null);
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);

  const posRef = useRef({ x: -100, y: -100, targetX: -100, targetY: -100 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Only enable on desktop pointer devices
    if (typeof window === 'undefined') return;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isFinePointer || prefersReducedMotion) {
      return;
    }

    setEnabled(true);

    const handleMouseMove = (e: MouseEvent) => {
      setHasMoved(true);
      posRef.current.targetX = e.clientX;
      posRef.current.targetY = e.clientY;

      // Check if hovering over element with data-cursor attribute
      const target = e.target as HTMLElement | null;
      const cursorTarget = target?.closest('[data-cursor]') as HTMLElement | null;

      if (cursorTarget) {
        const text = cursorTarget.getAttribute('data-cursor');
        setCursorText(text || 'VIEW');
        setIsHoveringInteractive(true);
      } else {
        setCursorText(null);
        setIsHoveringInteractive(false);
      }
    };

    const handleMouseLeave = () => {
      setIsHoveringInteractive(false);
      setCursorText(null);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Smooth Lerp loop (60-120fps)
    const render = () => {
      const p = posRef.current;
      p.x += (p.targetX - p.x) * 0.22;
      p.y += (p.targetY - p.y) * 0.22;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      }

      rafId.current = requestAnimationFrame(render);
    };

    rafId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed top-0 left-0 z-50 will-change-transform -translate-x-1/2 -translate-y-1/2 select-none transition-opacity duration-300"
      style={{
        opacity: hasMoved ? 1 : 0,
      }}
      aria-hidden="true"
    >
      {cursorText ? (
        // Expanded Junca-style action pill
        <div className="flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 px-3.5 py-1.5 text-[11px] font-mono font-bold tracking-widest text-white uppercase shadow-2xl shadow-orange-500/40 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <span>{cursorText}</span>
          <ArrowUpRight size={13} className="shrink-0 text-white" />
        </div>
      ) : isHoveringInteractive ? (
        // Medium glowing reticle dot
        <div className="size-6 rounded-full border border-orange-400/80 bg-orange-500/20 backdrop-blur-xs transition-transform duration-200 scale-125 shadow-lg shadow-orange-500/30" />
      ) : (
        // Subtle ambient cursor beacon
        <div className="relative size-3">
          <span className="absolute inset-0 size-3 rounded-full bg-orange-500/80 shadow-xs shadow-orange-400" />
          <span className="absolute -inset-1 size-5 rounded-full bg-orange-500/20 animate-ping" />
        </div>
      )}
    </div>
  );
};
