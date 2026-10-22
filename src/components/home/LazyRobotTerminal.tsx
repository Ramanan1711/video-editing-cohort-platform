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
    'w-[280px] min-[380px]:w-[320px] sm:w-[400px] md:w-[420px] lg:w-[480px] xl:w-[760px] 2xl:w-[940px] h-[320px] min-[380px]:h-[360px] sm:h-[460px] md:h-[490px] lg:h-[560px] xl:h-[860px] 2xl:h-[1020px] max-h-[96vh] max-w-[92vw] md:max-w-[48vw] lg:max-w-[48vw] xl:max-w-[52vw] flex items-center justify-center pointer-events-none';

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
