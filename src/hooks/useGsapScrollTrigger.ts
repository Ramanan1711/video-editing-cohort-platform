import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollSmoother, { type ScrollSmootherInstance } from 'gsap/ScrollSmoother';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

/**
 * useGsapScrollTrigger
 * Scoped GSAP ScrollTrigger & ScrollSmoother orchestration matching gsap.com reference:
 * - #smooth-wrapper (fixed full-viewport container)
 * - #smooth-content (matrix3d GPU-interpolated content container)
 * - data-speed & data-lag built-in parallax effects
 * - Reversible section reveals and scrubbed progress indicator
 */
export function useGsapScrollTrigger() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const smootherRef = useRef<ScrollSmootherInstance | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    // Check if running inside jsdom / test environment
    const isTestEnv = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');

    const ctx = gsap.context(() => {
      // 1. Initialize GSAP ScrollSmoother (matching gsap.com #smooth-wrapper / #smooth-content architecture)
      if (!isTestEnv && wrapperRef.current && contentRef.current) {
        try {
          const smoother = ScrollSmoother.create({
            wrapper: wrapperRef.current,
            content: contentRef.current,
            smooth: 1.5, // 1.5s buttery smooth momentum catch-up
            effects: true, // Enables data-speed & data-lag attributes
            smoothTouch: 0.1, // Smooth on touch & trackpad
            normalizeScroll: false,
          });
          smootherRef.current = smoother;
          (window as unknown as { smoother?: ScrollSmootherInstance }).smoother = smoother;
        } catch (e) {
          console.warn('GSAP ScrollSmoother init notice:', e);
        }
      }

      // 2. Sleek top scroll progress bar (scrubbed directly with scroll position)
      gsap.to('.gsap-scroll-progress', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: contentRef.current || el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.1,
        },
      });

      // 3. Section Headers: Cinematic slide-up & fade-in (reversible on scroll up)
      const headers = el.querySelectorAll('.gsap-header-reveal');
      headers.forEach((header) => {
        gsap.fromTo(
          header,
          { y: 45, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: header,
              start: 'top 88%',
              end: 'bottom 12%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      // 4. Staggered Card Groups (Cohorts, Milestones, Tracks, Deliverables, Reviews)
      const cardGroups = el.querySelectorAll('.gsap-cards-group');
      cardGroups.forEach((group) => {
        const children = Array.from(group.children);
        if (children.length > 0) {
          gsap.fromTo(
            children,
            { y: 55, opacity: 0, scale: 0.96 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.75,
              stagger: 0.1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: group,
                start: 'top 85%',
                end: 'bottom 12%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }
      });

      // 5. Ambient Depth Parallax on Atmospheric Lights & Orbs (Scrubbed with scroll depth)
      const parallaxElements = el.querySelectorAll('.gsap-parallax-slow');
      parallaxElements.forEach((target) => {
        gsap.to(target, {
          y: -140,
          ease: 'none',
          scrollTrigger: {
            trigger: target.closest('section') || target,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        });
      });

      // 6. Stat Badges / Metrics / Key highlights pop-in
      const metrics = el.querySelectorAll('.gsap-metric-reveal');
      metrics.forEach((metric) => {
        gsap.fromTo(
          metric,
          { scale: 0.9, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            ease: 'back.out(1.5)',
            scrollTrigger: {
              trigger: metric,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    }, el);

    // Refresh triggers as async data (cohorts, stats, 3D assets, fonts) settle
    const refreshTimer1 = setTimeout(() => ScrollTrigger.refresh(), 200);
    const refreshTimer2 = setTimeout(() => ScrollTrigger.refresh(), 700);
    const refreshTimer3 = setTimeout(() => ScrollTrigger.refresh(), 1600);

    return () => {
      clearTimeout(refreshTimer1);
      clearTimeout(refreshTimer2);
      clearTimeout(refreshTimer3);
      if (smootherRef.current) {
        try {
          smootherRef.current.kill();
        } catch {
          // ignore cleanup errors
        }
        smootherRef.current = null;
        delete (window as unknown as { smoother?: unknown }).smoother;
      }
      ctx.revert();
    };
  }, []);

  return { containerRef, wrapperRef, contentRef, smootherRef };
}
