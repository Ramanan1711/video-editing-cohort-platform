import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useGsapScrollTrigger
 * Scoped GSAP ScrollTrigger orchestration for cinematic section reveals,
 * staggered card entrances, continuous scrub parallax, and real-time scroll progress.
 */
export function useGsapScrollTrigger() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    const ctx = gsap.context(() => {
      // 1. Sleek top scroll progress bar (scrubbed directly with scroll position)
      gsap.to('.gsap-scroll-progress', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.15,
        },
      });

      // 2. Section Headers: Cinematic slide-up & fade-in (reversible on scroll up)
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

      // 3. Staggered Card Groups (Cohorts, Milestones, Tracks, Deliverables, Reviews)
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

      // 4. Ambient Depth Parallax on Atmospheric Lights & Orbs (Scrubbed with scroll depth)
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

      // 5. Stat Badges / Metrics / Key highlights pop-in
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
      ctx.revert();
    };
  }, []);

  return { containerRef };
}