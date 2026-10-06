import React, { Suspense, useEffect, useState } from 'react';

const RobotTerminal = React.lazy(() =>
  import('./RobotTerminal').then((m) => ({ default: m.RobotTerminal }))
);

/**
 * LazyRobotTerminal
 * Defers loading of Three.js and heavy 3D robot assets:
 * 1. Bypasses loading entirely on mobile (< 768px viewport) to save >1.8 MB of bandwidth.
 * 2. On desktop, defers dynamic import until browser idle state to safeguard First Contentful Paint (FCP) and LCP.
 */
export function LazyRobotTerminal() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanupIdle: (() => void) | undefined;

    const triggerIdleLoad = () => {
      if ('requestIdleCallback' in window) {
        const handle = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
          () => setShouldRender(true),
          { timeout: 1500 }
        );
        cleanupIdle = () => {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
        };
      } else {
        const timer = setTimeout(() => setShouldRender(true), 400);
        cleanupIdle = () => clearTimeout(timer);
      }
    };

    // Check media query - do not download 3D assets on mobile screens
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    if (!mediaQuery.matches) {
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          triggerIdleLoad();
        }
      };
      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
        cleanupIdle?.();
      };
    }

    triggerIdleLoad();

    return () => {
      cleanupIdle?.();
    };
  }, []);

  if (!shouldRender) {
    return (
      <div
        className="w-[320px] h-[360px] flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="w-[320px] h-[360px] flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        />
      }
    >
      <RobotTerminal />
    </Suspense>
  );
}
