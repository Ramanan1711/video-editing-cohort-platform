import React, { useEffect, useRef, useState } from 'react';
import { soundFx } from '../../lib/soundFx';

export type SimulatorMode = 'wave' | 'nebula' | 'grid';

interface Particle {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  phase: number;
}

export const HeroCanvasSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<SimulatorMode>('wave');
  const [fps, setFps] = useState<number>(60);
  const [particleCount, setParticleCount] = useState<number>(1000);

  // Mouse tracking state
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number; isInside: boolean; clickBurst: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isInside: false,
    clickBurst: 0,
  });

  const modeRef = useRef<SimulatorMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Handle canvas click to trigger shockwave
  const handleCanvasClick = (_e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.clickBurst = 1.0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    // Color palettes for cinematic amber, fiery orange, and cyber violet
    const colors = [
      '#f97316', // neon orange
      '#fb923c', // light amber
      '#f59e0b', // gold amber
      '#ea580c', // deep fire orange
      '#6366f1', // cyber indigo
      '#818cf8', // light electric blue
    ];

    const initParticles = (w: number, h: number, curMode: SimulatorMode) => {
      particles = [];
      const count = curMode === 'grid' ? 600 : curMode === 'nebula' ? 1400 : 1000;
      setParticleCount(count);

      if (curMode === 'wave') {
        const cols = 40;
        const rows = Math.floor(count / cols);
        const colSpacing = (w * 1.2) / cols;
        const rowSpacing = (h * 0.9) / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c - cols / 2) * colSpacing + w / 2;
            const y = (r - rows / 2) * rowSpacing + h * 0.55;
            const z = (r / rows) * 400 - 200;
            particles.push({
              x,
              y,
              z,
              baseX: x,
              baseY: y,
              baseZ: z,
              vx: 0,
              vy: 0,
              size: Math.random() * 2.5 + 1.2,
              color: colors[(r + c) % colors.length],
              alpha: Math.random() * 0.5 + 0.4,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      } else if (curMode === 'nebula') {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * (Math.min(w, h) * 0.65);
          const x = w / 2 + Math.cos(angle) * radius;
          const y = h / 2 + Math.sin(angle) * radius * 0.5;
          const z = (Math.random() - 0.5) * 500;
          particles.push({
            x,
            y,
            z,
            baseX: x,
            baseY: y,
            baseZ: z,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            size: Math.random() * 2.8 + 0.8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.6 + 0.3,
            phase: Math.random() * Math.PI * 2,
          });
        }
      } else {
        // Grid mode: 3D perspective floor and ceiling matrix
        const gridSize = 24;
        const spacing = w / (gridSize * 0.6);
        for (let i = -gridSize; i <= gridSize; i++) {
          for (let j = 0; j < 15; j++) {
            const x = w / 2 + i * (spacing * (1 + j * 0.12));
            const y = h * 0.4 + j * (h * 0.05);
            const z = j * 40;
            particles.push({
              x,
              y,
              z,
              baseX: x,
              baseY: y,
              baseZ: z,
              vx: 0,
              vy: 0,
              size: Math.max(1, 3 - j * 0.15),
              color: j % 2 === 0 ? '#f97316' : '#6366f1',
              alpha: Math.max(0.15, 0.9 - j * 0.06),
              phase: (i + j) * 0.2,
            });
          }
        }
      }
    };

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      initParticles(width, height, modeRef.current);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);

    let isIntersecting = true;
    let isTabVisible = !document.hidden;
    let isRunning = false;

    // Animation Render Loop
    let time = 0;
    const render = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;
      time += dt;

      // FPS tracking
      frameCount++;
      if (now - lastFpsUpdate >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      // Smooth mouse lerp
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      if (mouse.clickBurst > 0) {
        mouse.clickBurst = Math.max(0, mouse.clickBurst - dt * 2);
      }

      // Clear with subtle trail
      ctx.clearRect(0, 0, width, height);

      // Dynamic Radial Spotlight centered at mouse position
      const spotX = mouse.isInside ? mouse.x : width / 2;
      const spotY = mouse.isInside ? mouse.y : height * 0.4;
      const spotGlow = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, Math.max(width, height) * 0.6);
      spotGlow.addColorStop(0, 'rgba(249, 115, 22, 0.08)');
      spotGlow.addColorStop(0.5, 'rgba(99, 102, 241, 0.03)');
      spotGlow.addColorStop(1, 'rgba(3, 7, 18, 0)');
      ctx.fillStyle = spotGlow;
      ctx.fillRect(0, 0, width, height);

      // Render mode specifics
      const curMode = modeRef.current;
      const curMouseX = mouse.x;
      const curMouseY = mouse.y;

      if (curMode === 'wave') {
        // Draw 3D undulating wave grid with connective splines
        const waveFreq = 0.005;
        const waveSpeed = 1.8;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Compute distance to mouse
          const dx = p.baseX - curMouseX;
          const dy = p.baseY - curMouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mouseInfluence = Math.max(0, 1 - dist / 320);

          // Undulation calculation
          const waveZ = Math.sin(p.baseX * waveFreq + time * waveSpeed + p.phase) * 35;
          const waveY = Math.cos(p.baseY * waveFreq * 1.5 + time * 1.4) * 20;

          // Shockwave ripple
          const shockwave = mouse.clickBurst * Math.sin(Math.max(0, dist * 0.03 - time * 6)) * 40;

          p.y = p.baseY + waveY + shockwave - mouseInfluence * 45;
          p.x = p.baseX + (dx / (dist || 1)) * mouseInfluence * 15;

          // 3D perspective projection
          const fov = 600;
          const scale = fov / (fov + p.baseZ + waveZ);
          const projX = (p.x - width / 2) * scale + width / 2;
          const projY = (p.y - height / 2) * scale + height / 2;
          const projSize = Math.max(0.5, p.size * scale * (1 + mouseInfluence * 0.8));

          // Draw Particle node
          ctx.beginPath();
          ctx.arc(projX, projY, projSize, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, p.alpha * scale * (0.6 + mouseInfluence * 0.6));
          ctx.fill();

          // Connect every 4th node to right and bottom neighbor for tech spline lattice
          if (i % 2 === 0 && i + 1 < particles.length && Math.abs(particles[i + 1].baseY - p.baseY) < 10) {
            const nextP = particles[i + 1];
            const nextScale = fov / (fov + nextP.baseZ);
            const nextX = (nextP.x - width / 2) * nextScale + width / 2;
            const nextY = (nextP.y - height / 2) * nextScale + height / 2;

            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(nextX, nextY);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = Math.min(0.25, 0.12 * scale * (1 + mouseInfluence));
            ctx.lineWidth = 0.75 * scale;
            ctx.stroke();
          }
        }
      } else if (curMode === 'nebula') {
        // Cosmic swarm orbiting mouse center
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Gentle orbital movement
          p.phase += dt * 0.6;
          const orbitR = Math.sin(p.phase) * 15;
          p.x += p.vx + Math.cos(p.phase) * (0.3 + orbitR * 0.01);
          p.y += p.vy + Math.sin(p.phase) * (0.3 + orbitR * 0.01);

          // Mouse gravity pull
          const dx = curMouseX - p.x;
          const dy = curMouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 260) {
            const force = (1 - dist / 260) * 0.8;
            p.x += (dx / dist) * force * 2.5;
            p.y += (dy / dist) * force * 2.5;
          }

          // Screen wrap
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();

          // Connect close particles with neural fibers
          if (i % 6 === 0) {
            for (let j = i + 1; j < Math.min(i + 8, particles.length); j++) {
              const p2 = particles[j];
              const cdx = p.x - p2.x;
              const cdy = p.y - p2.y;
              const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
              if (cdist < 65) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = (1 - cdist / 65) * 0.25;
                ctx.lineWidth = 0.6;
                ctx.stroke();
              }
            }
          }
        }
      } else {
        // Quantum Grid mode
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.baseX - curMouseX;
          const dy = p.baseY - curMouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const warp = Math.max(0, 1 - dist / 280) * 35;

          const projX = p.baseX + (dx / (dist || 1)) * warp * 0.5;
          const projY = p.baseY + Math.sin(time * 2 + p.phase) * 6 - warp;

          ctx.beginPath();
          ctx.arc(projX, projY, p.size * (1 + (warp > 0 ? 0.6 : 0)), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (isRunning || !isIntersecting || !isTabVisible) return;
      isRunning = true;
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    };

    const stopLoop = () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    // IntersectionObserver to suspend simulation when scrolled offscreen
    const io = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          startLoop();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      io.observe(containerRef.current);
    }

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && isIntersecting) {
        startLoop();
      } else {
        stopLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Mouse listeners on container
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
      mouseRef.current.isInside = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.isInside = false;
      mouseRef.current.targetX = width / 2;
      mouseRef.current.targetY = height * 0.45;
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousemove', handleMouseMove);
      el.addEventListener('mouseleave', handleMouseLeave);
    }

    startLoop();

    return () => {
      stopLoop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (el) {
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-auto cursor-crosshair select-none"
      aria-hidden="true"
    >
      {/* Hardware-Accelerated 3D WebGL / HTML5 Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full will-change-transform block" />

      {/* Cinematic Vignette Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-radial-gradient from-transparent via-[#030712]/40 to-[#030712] z-10" />

      {/* Cyber Grid Lines Background Accent */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 65% 50% at 50% 45%, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 50% at 50% 45%, black 40%, transparent 85%)',
        }}
      />

      {/* Interactive Simulator HUD Badge (Floating Bottom Right Control) */}
      <div className="absolute bottom-5 right-5 z-20 hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-[#090d16]/80 px-3 py-1.5 backdrop-blur-xl shadow-2xl text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5 text-orange-400 font-bold">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>WebGL 3D Core</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1 text-slate-400">
          <span>{fps} FPS · {particleCount} Nodes</span>
        </div>
        <span className="text-white/20">|</span>
        {/* Simulator Mode Switcher */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          {(['wave', 'nebula', 'grid'] as SimulatorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              data-cursor={`SIM: ${m.toUpperCase()}`}
              onClick={(e) => {
                e.stopPropagation();
                setMode(m);
                soundFx.playSweep(220, 660, 0.09, 0.05);
              }}
              className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize transition cursor-pointer ${
                mode === m
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
