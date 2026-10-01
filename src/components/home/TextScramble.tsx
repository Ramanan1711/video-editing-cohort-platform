import React, { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_CHARS = '_-—/\\*#+=[]{}<>;:!?%$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface TextScrambleProps {
  text: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  scrambleOnHover?: boolean;
  autoStart?: boolean;
  speed?: number; // ms per frame
  characters?: string;
  onComplete?: () => void;
}

export const TextScramble: React.FC<TextScrambleProps> = ({
  text,
  className = '',
  as: Component = 'span',
  scrambleOnHover = true,
  autoStart = true,
  speed = 28,
  characters = DEFAULT_CHARS,
  onComplete,
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const frameRef = useRef<number | null>(null);
  const iterationRef = useRef<number>(0);
  const originalTextRef = useRef<string>(text);

  useEffect(() => {
    originalTextRef.current = text;
  }, [text]);

  const runScramble = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Check reduced motion preference
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(originalTextRef.current);
      return;
    }

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    setIsScrambling(true);
    iterationRef.current = 0;
    const target = originalTextRef.current;
    const totalSteps = target.length * 3;
    let lastTime = performance.now();

    const update = (now: number) => {
      if (now - lastTime >= speed) {
        lastTime = now;

        const resolvedCount = Math.floor(iterationRef.current / 3);
        const nextChars = target
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < resolvedCount) {
              return char;
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('');

        setDisplayText(nextChars);
        iterationRef.current += 1;

        if (iterationRef.current > totalSteps) {
          setDisplayText(target);
          setIsScrambling(false);
          onComplete?.();
          return;
        }
      }

      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);
  }, [characters, speed, onComplete]);

  useEffect(() => {
    if (autoStart) {
      runScramble();
    } else {
      setDisplayText(text);
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [text, autoStart, runScramble]);

  const handleMouseEnter = () => {
    if (scrambleOnHover && !isScrambling) {
      runScramble();
    }
  };

  return (
    <Component
      className={`inline-block font-inherit transition-colors ${className}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText}
    </Component>
  );
};
