import { useMemo } from 'react';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useCohortsQuery } from '../hooks/queries/useCohortsQuery';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../lib/paymentService';
import { CustomCursor } from '../components/home/CustomCursor';
import { StudioBar } from '../components/home/StudioBar';
import { useSmoothScroll } from '../lib/scroll/useSmoothScroll';
import { useGsapScrollTrigger } from '../hooks/useGsapScrollTrigger';
import { HeroSection } from '../components/home/sections/HeroSection';
import { ComparisonSection } from '../components/home/sections/ComparisonSection';
import { CurriculumSection } from '../components/home/sections/CurriculumSection';
import { MentorshipSection } from '../components/home/sections/MentorshipSection';
import { TestimonialsSection } from '../components/home/sections/TestimonialsSection';
import { PricingSection } from '../components/home/sections/PricingSection';
import { HomepageAdvertisementModal } from '../components/home/HomepageAdvertisementModal';

export function Home() {
  useSmoothScroll();
  const { containerRef } = useGsapScrollTrigger();

  // Real database cohorts fetched dynamically via unified server-state query
  const { data: rawCohorts = [], isLoading: loadingCohorts, error: cohortsQueryError } = useCohortsQuery();
  const cohorts = useMemo(() => {
    return (rawCohorts || []).filter(
      (c) => c.status === 'published' || c.visibility === 'public'
    );
  }, [rawCohorts]);
  const cohortError = cohortsQueryError?.message || null;

  // Authoritative published cohort and price (synced with admin settings and database)
  const publishedCohort = useMemo(() => {
    return cohorts.find((c) => c.status === 'published' || c.status === 'active') || cohorts[0] || null;
  }, [cohorts]);

  const publishedPrice = publishedCohort?.price_inr ?? DEFAULT_COHORT_FEE_INR;
  const publishedCurrency = publishedCohort?.currency ?? DEFAULT_CURRENCY;
  const publishedOriginalPrice = Math.round(publishedPrice * 2);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-surface-base text-slate-100 font-sans selection:bg-orange-500 selection:text-white transition-colors relative overflow-x-hidden film-grain"
    >
      {/* Top GSAP Scroll Progress Indicator */}
      <div className="fixed top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 origin-left scale-x-0 z-[100] gsap-scroll-progress pointer-events-none shadow-[0_0_12px_rgba(249,115,22,0.9)]" />

      {/* Dynamic Homepage Advertisement / Promotion (Popup, Banner or Floating Card) */}
      <HomepageAdvertisementModal />

      {/* Junca Studio-inspired custom magnetic cursor follower */}
      <CustomCursor />

      <SiteHeader />

      <main>
        <HeroSection
          loadingCohorts={loadingCohorts}
          cohorts={cohorts}
          cohortError={cohortError}
          publishedPrice={publishedPrice}
          publishedCurrency={publishedCurrency}
        />

        <ComparisonSection />

        <CurriculumSection />

        <MentorshipSection />

        <TestimonialsSection
          publishedPrice={publishedPrice}
          publishedCurrency={publishedCurrency}
        />

        <PricingSection
          publishedCohort={publishedCohort}
          publishedPrice={publishedPrice}
          publishedCurrency={publishedCurrency}
          publishedOriginalPrice={publishedOriginalPrice}
        />
      </main>

      <SiteFooter />

      {/* Fixed bottom architectural telemetry & sound equalizer bar */}
      <StudioBar />
    </div>
  );
}