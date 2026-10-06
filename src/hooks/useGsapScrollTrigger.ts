import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useGsapScrollTrigger
 * Scoped GSAP ScrollTrigger orchestration for cinematic section reveals,
 * staggered card entrances, and smooth ambient parallax.
 */
export function useGsapScrollTrigger() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    // Respect accessibility reduced-motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // 1. Sleek top scroll progress bar
      gsap.to('.gsap-scroll-progress', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
        },
      });

      // 2. Section Headers: Cinematic slide-up & fade-in
      const headers = el.querySelectorAll('.gsap-header-reveal');
      headers.forEach((header) => {
        gsap.from(header, {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: header,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // 3. Staggered Card Groups (Cohorts, Tracks, Deliverables, FAQs, etc.)
      const cardGroups = el.querySelectorAll('.gsap-cards-group');
      cardGroups.forEach((group) => {
        const children = group.children;
        if (children.length > 0) {
          gsap.from(children, {
            y: 45,
            opacity: 0,
            duration: 0.85,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: group,
              start: 'top 82%',
              toggleActions: 'play none none none',
            },
          });
        }
      });

      // 4. Subtle Ambient Parallax on Atmospheric Lights
      const parallaxElements = el.querySelectorAll('.gsap-parallax-slow');
      parallaxElements.forEach((target) => {
        gsap.to(target, {
          y: -60,
          ease: 'none',
          scrollTrigger: {
            trigger: target.closest('section') || target,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2,
          },
        });
      });

      // 5. Stat Badges / Metrics / Key highlights pop-in
      const metrics = el.querySelectorAll('.gsap-metric-reveal');
      metrics.forEach((metric) => {
        gsap.from(metric, {
          scale: 0.92,
          opacity: 0,
          duration: 0.7,
          ease: 'back.out(1.4)',
          scrollTrigger: {
            trigger: metric,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    }, el);

    return () => {
      ctx.revert();
    };
  }, []);

  return { containerRef };
}
