import React, { useEffect, useRef, useState } from 'react';

export interface FwFigureSource {
  srcSet: string;
  type?: string;
  sizes?: string;
}

export interface FwFigureProps {
  imgSrc: string;
  imgSrcSet?: string;
  alt: string;
  sources?: FwFigureSource[];
  tags?: string[];
  sizes?: string;
  loading?: 'lazy' | 'eager';
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;
  className?: string;
  enableGl?: boolean;
  style?: React.CSSProperties;
}

/**
 * FwFigure - Junca Studio-inspired Featured Work Figure with:
 * - Dynamic scroll progress internal parallax (--p: 0..1)
 * - Staggered spring tag reveals (--t: total, --j: index)
 * - Responsive picture elements with AVIF/WebP srcset support
 * - WebGL / Canvas wave ripple & chromatic aberration morph tile (is-gl, data-morph-tile)
 */
export const FwFigure: React.FC<FwFigureProps> = ({
  imgSrc,
  imgSrcSet,
  alt,
  sources = [],
  tags = [],
  sizes = '(max-width: 809px) 92vw, 43vw',
  loading = 'lazy',
  width = 1280,
  height = 720,
  aspectRatio = '16/9',
  className = '',
  enableGl = true,
  style,
}) => {
  const figRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0.5);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);

  // Parallax scroll telemetry: updates --p (0.0000 - 1.0000)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    const calculateP = () => {
      if (!figRef.current) return;
      const rect = figRef.current.getBoundingClientRect();
      const r = window.innerHeight;
      const h = rect.height || 300;
      const progress = Math.min(1, Math.max(0, (r - rect.top) / (r + h)));
      setScrollProgress(progress);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(calculateP);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    calculateP();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // WebGL / Canvas interactive ripple effect matching Junca Studio's CoverMorph shader
  useEffect(() => {
    if (!enableGl || typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let animActive = true;
    let isIntersecting = false;

    const renderWave = () => {
      if (!animActive || !canvas || !isIntersecting || !isHovered) {
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      time += 0.04;
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, `rgba(249, 115, 22, ${Math.sin(time) * 0.08 + 0.08})`);
      gradient.addColorStop(0.5, `rgba(251, 191, 36, ${Math.cos(time * 1.3) * 0.06 + 0.06})`);
      gradient.addColorStop(1, `rgba(249, 115, 22, 0.02)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Specular morph scanline
      const scanY = (time * 30) % h;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(0, scanY, w, 2);

      rafRef.current = requestAnimationFrame(renderWave);
    };

    const handleResize = () => {
      if (!figRef.current || !canvas) return;
      const rect = figRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const io = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting && isHovered) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(renderWave);
        } else if (!isIntersecting) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      },
      { threshold: 0.05 }
    );

    if (figRef.current) {
      io.observe(figRef.current);
    }

    if (isHovered && isIntersecting) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(renderWave);
    } else if (!isHovered && canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      animActive = false;
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [enableGl, isHovered]);

  return (
    <figure
      ref={figRef}
      className={`fw__fig ${enableGl ? 'is-gl' : ''} is-in ${className}`}
      data-fw-fig=""
      data-morph-tile=""
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={
        {
          aspectRatio,
          '--t': tags.length,
          '--p': scrollProgress.toFixed(4),
          ...style,
        } as React.CSSProperties
      }
    >
      <picture>
        {sources.map((s, idx) => (
          <source key={idx} srcSet={s.srcSet} type={s.type} sizes={s.sizes || sizes} />
        ))}
        <img
          src={
            hasError
              ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1280&q=80'
              : imgSrc
          }
          srcSet={hasError ? undefined : imgSrcSet}
          alt={alt}
          sizes={sizes}
          loading={loading}
          decoding="async"
          width={width}
          height={height}
          onError={() => setHasError(true)}
        />
      </picture>

      {tags.length > 0 && (
        <figcaption className="fw__tags">
          {tags.map((tag, j) => (
            <span
              key={tag}
              className="fw__tag"
              style={{ '--j': j } as React.CSSProperties}
            >
              {tag}
            </span>
          ))}
        </figcaption>
      )}

      {enableGl && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full pointer-events-none z-10 transition-opacity duration-300"
          style={{ opacity: isHovered ? 1 : 0 }}
          aria-hidden="true"
        />
      )}
    </figure>
  );
};
