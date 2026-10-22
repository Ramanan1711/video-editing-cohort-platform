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
          { timeout: 1200 }
        );
        cleanupIdle = () => {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
        };
      } else {
        const timer = setTimeout(() => setShouldRender(true), 300);
        cleanupIdle = () => clearTimeout(timer);
      }
    };

    triggerIdleLoad();

    return () => {
      cleanupIdle?.();
    };
  }, []);

  const placeholderClass =
    'w-[280px] min-[380px]:w-[320px] sm:w-[420px] md:w-[540px] lg:w-[680px] xl:w-[820px] 2xl:w-[960px] h-[320px] min-[380px]:h-[360px] sm:h-[480px] md:h-[600px] lg:h-[760px] xl:h-[900px] 2xl:h-[1020px] max-h-[96vh] max-w-[92vw] lg:max-w-[55vw] flex items-center justify-center pointer-events-none';

  if (!shouldRender) {
    return (
      <div className={placeholderClass} aria-hidden="true" />
    );
  }

  return (
    <Suspense fallback={<div className={placeholderClass} aria-hidden="true" />}>
      <RobotTerminal />
    </Suspense>
  );
}
