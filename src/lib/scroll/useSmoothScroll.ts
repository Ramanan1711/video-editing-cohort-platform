import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useSmoothScroll
 * Integrates Lenis 60fps momentum scroll with GSAP ScrollTrigger ticker.
 * Uses lerp-based damping for an unmistakable, silky-smooth inertia glide.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Detect pointer capability: coarse (touchscreen mobile/tablet) vs fine (mouse/trackpad)
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;

    // On pure touch devices (iOS/Android mobile and tablets without mouse), disable Lenis entirely
    // to preserve 120Hz hardware-accelerated ProMotion momentum scroll and avoid JavaScript touch jank.
    if (isCoarsePointer && !isFinePointer) {
      if (window.location.hash) {
        const el = document.querySelector(window.location.hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    const lenis = new Lenis({
      lerp: 0.08, // Buttery smooth linear interpolation on desktop
      wheelMultiplier: 1.05,
      touchMultiplier: 0, // Disables touch interpolation entirely
      smoothWheel: true,
      syncTouch: false, // Never intercept touch events; keep native hardware momentum on touch screens
      autoResize: true,
    });

    // Expose lenis globally for debugging, console inspection, and anchor jumps
    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    // Smoothly scroll to initial hash target if present in URL
    if (window.location.hash) {
      setTimeout(() => {
        lenis.scrollTo(window.location.hash, { offset: -72, duration: 1.2 });
      }, 300);
    }

    // Synchronize Lenis scroll position with ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Sync Lenis RAF loop with GSAP's high-precision ticker
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(500, 33);

    // Staggered layout refreshes as fonts, images, and async queries settle
    const refreshTimer1 = setTimeout(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    }, 150);

    const refreshTimer2 = setTimeout(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    }, 600);

    const refreshTimer3 = setTimeout(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    }, 1500);

    const handleResize = () => {
      lenis.resize();
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(refreshTimer1);
      clearTimeout(refreshTimer2);
      clearTimeout(refreshTimer3);
      window.removeEventListener('resize', handleResize);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      delete (window as unknown as { lenis?: Lenis }).lenis;
    };
  }, [enabled]);
}
