import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useSmoothScroll
 * Integrates Lenis 60fps momentum scroll with GSAP ScrollTrigger ticker.
 * Automatically respects prefers-reduced-motion for accessibility.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Respect accessibility reduced-motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    // Synchronize Lenis scroll position with ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Sync Lenis RAF loop with GSAP's high-precision ticker
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () => {
      clearTimeout(refreshTimer);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, [enabled]);
}
