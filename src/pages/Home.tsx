import { useMemo, useState, useEffect, useCallback } from 'react';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useAuth } from '../context/useAuth';
import { useCohortsQuery } from '../hooks/queries/useCohortsQuery';
import { useUserEnrollmentsQuery } from '../hooks/queries/useUserEnrollmentsQuery';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../lib/paymentService';
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
import { HomeIntroVideo } from '../components/home/HomeIntroVideo';

export function Home() {
  useSmoothScroll();
  const { containerRef } = useGsapScrollTrigger();

  // Test runner environment check (JSDOM does not support HTMLMediaElement playback)
  const isTest = import.meta.env?.MODE === 'test';

  // Show intro video on initial landing or when explicitly requested via ?intro=true
  const [showIntro, setShowIntro] = useState(() => {
    if (isTest || typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('intro') === 'true' || params.get('intro') === '1') return true;
    if (params.get('skip_intro') === 'true' || params.get('skip_intro') === '1') return false;
    return !sessionStorage.getItem('iunoware_home_intro_completed');
  });

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('iunoware_home_intro_completed', 'true');
    }
  }, []);

  // Listen for custom event to replay intro anytime
  useEffect(() => {
    const handleReplay = () => {
      setShowIntro(true);
    };
    window.addEventListener('iunoware-replay-intro', handleReplay);
    return () => window.removeEventListener('iunoware-replay-intro', handleReplay);
  }, []);

  const { user } = useAuth();

  // Real database cohorts fetched dynamically via unified server-state query
  const { data: rawCohorts = [], isLoading: loadingCohorts, error: cohortsQueryError } = useCohortsQuery();

  // Authoritative user enrollments fetched directly from database
  const {
    data: userEnrollments = [],
    isLoading: loadingEnrollments,
    error: enrollmentsError,
  } = useUserEnrollmentsQuery(user?.id);

  // Set of cohort IDs the user is currently enrolled in
  const enrolledCohortIds = useMemo(() => {
    // Fail-safe: On loading, error, or unauthenticated, never falsely mark cohorts as enrolled
    if (!user || enrollmentsError || loadingEnrollments) {
      return new Set<string>();
    }
    return new Set(
      (userEnrollments || [])
        .filter((e) => e.status !== 'dropped')
        .map((e) => e.cohort_id)
    );
  }, [user, userEnrollments, enrollmentsError, loadingEnrollments]);

  // Set of course IDs the user is currently enrolled in (derived from enrolled cohorts)
  const enrolledCourseIds = useMemo(() => {
    if (enrolledCohortIds.size === 0) return new Set<string>();
    const courseIds = new Set<string>();
    for (const c of rawCohorts) {
      if (c.course_id && enrolledCohortIds.has(c.id)) {
        courseIds.add(c.course_id);
      }
    }
    return courseIds;
  }, [enrolledCohortIds, rawCohorts]);

  // Base published cohorts on the platform (strictly published/active/upcoming; excluding draft/rejected/review/archived/private)
  const platformCohorts = useMemo(() => {
    return (rawCohorts || []).filter((c) => {
      if (
        c.visibility === 'private' ||
        c.status === 'archived' ||
        c.status === 'draft' ||
        c.status === 'rejected' ||
        c.status === 'review' ||
        c.status === 'reviewing'
      ) {
        return false;
      }
      return (
        c.status === 'published' ||
        c.status === 'active' ||
        c.status === 'upcoming' ||
        !c.status
      );
    });
  }, [rawCohorts]);

  // Available cohorts for this specific user (hiding courses/cohorts the user already enrolled in)
  const availableCohorts = useMemo(() => {
    return platformCohorts.filter((cohort) => {
      if (enrolledCohortIds.has(cohort.id)) {
        return false;
      }
      if (cohort.course_id && enrolledCourseIds.has(cohort.course_id)) {
        return false;
      }
      return true;
    });
  }, [platformCohorts, enrolledCohortIds, enrolledCourseIds]);

  // Hide the Available Production Cohorts section when an enrolled user has already enrolled in all available courses
  const hideActiveCohortsSection = useMemo(() => {
    return Boolean(
      user &&
      !loadingEnrollments &&
      !enrollmentsError &&
      enrolledCohortIds.size > 0 &&
      availableCohorts.length === 0
    );
  }, [user, loadingEnrollments, enrollmentsError, enrolledCohortIds.size, availableCohorts.length]);

  const cohortError = cohortsQueryError?.message || null;

  // Authoritative published cohort and price (synced with admin settings and database)
  const publishedCohort = useMemo(() => {
    return (
      availableCohorts.find((c) => c.status === 'published' || c.status === 'active') ||
      availableCohorts[0] ||
      platformCohorts[0] ||
      null
    );
  }, [availableCohorts, platformCohorts]);

  const publishedPrice = publishedCohort?.price_inr ?? DEFAULT_COHORT_FEE_INR;
  const publishedCurrency = publishedCohort?.currency ?? DEFAULT_CURRENCY;
  const publishedOriginalPrice = Math.round(publishedPrice * 2);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-surface-base text-slate-100 font-sans selection:bg-[#B92B27] selection:text-white transition-colors relative overflow-x-hidden film-grain"
    >
      {/* Top GSAP Scroll Progress Indicator (Iunoware Brand Spectrum Gradient) */}
      <div className="fixed top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-[#B92B27] via-[#D93830] via-[#F2B705] via-[#38B44A] to-[#2675EB] origin-left scale-x-0 z-[100] gsap-scroll-progress pointer-events-none shadow-[0_0_12px_rgba(242,183,5,0.85)]" />

      {/* Cinematic Intro Video Overlay */}
      {showIntro && <HomeIntroVideo onComplete={handleIntroComplete} />}

      {/* Dynamic Homepage Advertisement / Promotion (Popup, Banner or Floating Card) - only shown when intro is not active */}
      {!showIntro && <HomepageAdvertisementModal />}

      <SiteHeader />

      <main>
        <HeroSection
          loadingCohorts={loadingCohorts}
          cohorts={availableCohorts}
          cohortError={cohortError}
          publishedPrice={publishedPrice}
          publishedCurrency={publishedCurrency}
          hideActiveCohortsSection={hideActiveCohortsSection}
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