import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number;
  scale?: number;
  perspective?: number;
  glareOpacity?: number;
  glareColor?: string;
  className?: string;
  enableGlare?: boolean;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  maxTilt = 8,
  scale = 1.02,
  perspective = 1000,
  glareOpacity = 0.2,
  glareColor = 'rgba(251, 146, 60, 0.25)',
  className = '',
  enableGlare = true,
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const [glarePos, setGlarePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener?.('change', listener);
      return () => mediaQuery.removeEventListener?.('change', listener);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (reducedMotion) return;
    setIsHovered(true);
  }, [reducedMotion]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const normX = (clientX / rect.width) * 2 - 1; // -1 to 1
      const normY = (clientY / rect.height) * 2 - 1; // -1 to 1

      const ry = normX * maxTilt;
      const rx = -normY * maxTilt;

      setTilt({ rx, ry });
      setGlarePos({
        x: Math.round((clientX / rect.width) * 100),
        y: Math.round((clientY / rect.height) * 100),
      });
    },
    [maxTilt, reducedMotion]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0 });
  }, []);

  const transformStyle: React.CSSProperties = reducedMotion
    ? {}
    : {
        transform: isHovered
          ? `perspective(${perspective}px) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
          : `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
        transition: isHovered
          ? 'transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ ...transformStyle, ...style }}
      className={`relative group rounded-2xl will-change-transform ${className}`}
      {...props}
    >
      {/* Specular Glare Overlay */}
      {enableGlare && !reducedMotion && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl overflow-hidden transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 360px at ${glarePos.x}% ${glarePos.y}%, ${glareColor}, transparent 70%)`,
            opacity: isHovered ? glareOpacity : 0,
          }}
        />
      )}

      {/* Card Body */}
      {children}
    </div>
  );
};
