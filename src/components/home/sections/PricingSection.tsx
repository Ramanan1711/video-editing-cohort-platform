import { Check, Shield } from 'lucide-react';
import { Button } from '../../ui/Button';
import { TiltCard } from '../TiltCard';
import { LandingFAQAccordion } from '../LandingFAQAccordion';
import { soundFx } from '../../../lib/soundFx';
import { setPendingCohortCheckout } from '../../../lib/cohortCheckoutPersistence';

export interface PricingSectionProps {
  publishedCohort: {
    id: string;
    name: string;
    price_inr?: number | null;
    currency?: string | null;
  } | null;
  publishedPrice: number;
  publishedCurrency: string;
  publishedOriginalPrice: number;
}

export function PricingSection({
  publishedCohort,
  publishedPrice,
  publishedCurrency,
  publishedOriginalPrice,
}: PricingSectionProps) {
  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 16: PRICING & GUARANTEE */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-20 lg:py-28 bg-[#070b16] border-t border-white/10 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 text-center relative z-10">
          <div className="gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Transparent Enrollment
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              One Clear Investment. Full 15-Day Access.
            </h2>
            <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
              Everything you need to ship daily work, receive continuous feedback, and graduate with an industry credential.
            </p>
          </div>

          <div className="gsap-cards-group">
            <TiltCard
              maxTilt={5}
              glareColor="rgba(249, 115, 22, 0.2)"
              className="mx-auto mt-12 max-w-2xl overflow-hidden border border-surface-subtle bg-gradient-to-b from-surface-elevated via-surface-card to-surface-base backdrop-blur-2xl rounded-3xl shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] shadow-orange-500/10 text-left"
            >
              <div className="grid gap-8 p-7 sm:grid-cols-[1fr_auto] sm:p-10">
                <div>
                  <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-400">
                    15-Day Sprint Pass
                  </span>
                  <h3 className="mt-4 text-2xl font-black text-white">
                    Full Cohort Membership
                  </h3>
                  <div className="mt-6 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                    {[
                      '15 Daily Production Challenges',
                      '1-on-1 WhatsApp Mentor Support',
                      'Weekly Live Masterclass Workshops',
                      'Verified Digital Certificate',
                      'Mentor Letter of Recommendation',
                      'Community Board & Peer Network',
                      'Downloadable Starter Project Assets',
                      'Lifetime Access to Course Replays',
                    ].map((item) => (
                      <span key={item} className="flex items-center gap-2">
                        <Check className="text-emerald-400 shrink-0" size={15} />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between sm:items-end border-t sm:border-t-0 sm:border-l border-white/10 pt-6 sm:pt-0 sm:pl-8">
                  <div>
                    <span className="text-xs text-slate-500 line-through">₹{publishedOriginalPrice.toLocaleString('en-IN')}</span>
                    <p className="text-4xl font-black text-white font-mono">₹{publishedPrice.toLocaleString('en-IN')}</p>
                    <p className="text-[11px] text-slate-400">One-time payment ({publishedCurrency})</p>
                    {publishedCohort?.name && (
                      <p className="text-[10px] text-orange-400/90 font-mono mt-0.5 truncate max-w-[200px]">{publishedCohort.name}</p>
                    )}
                  </div>
                  <Button
                    href={publishedCohort?.id ? `/register?cohort=${publishedCohort.id}` : '/register'}
                    data-cursor="SAVE SEAT"
                    onClick={() => {
                      if (publishedCohort?.id) {
                        setPendingCohortCheckout(
                          publishedCohort.id,
                          publishedCohort.name,
                          publishedCohort.price_inr ?? undefined,
                          publishedCohort.currency ?? undefined
                        );
                      }
                      soundFx.playSweep(280, 840, 0.15, 0.05);
                    }}
                    className="mt-6 w-full justify-center shadow-lg shadow-orange-500/25"
                    withArrow
                  >
                    Save My Seat
                  </Button>
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/[0.02] p-4 px-7 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <Shield size={14} className="text-emerald-400" />
                  100% 5-Day Money-Back Guarantee
                </span>
                <span>If unsatisfied during Days 1–3, request a full refund before Day 5.</span>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 17: FAQ ACCORDION */}
      {/* ========================================================================= */}
      <LandingFAQAccordion />

      {/* ========================================================================= */}
      {/* SECTION 18: FINAL LAUNCHPAD */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-b from-[#070b16] via-[#030712] to-[#02040a] px-5 py-28 text-center text-white relative overflow-hidden border-t border-white/10">
        <div className="gsap-parallax-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[32rem] rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 blur-3xl pointer-events-none" />
        <div className="gsap-header-reveal relative z-10 max-w-3xl mx-auto space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">
            15 Days From Now
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            You Could Have a Finished Portfolio and Verified Credential.
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Join the next intensive cohort. Experience the power of daily production constraints, real WhatsApp mentorship, and peer momentum.
          </p>
          <div className="pt-6">
            <Button
              href="/register"
              size="lg"
              data-cursor="JOIN COHORT"
              onClick={() => soundFx.playSweep(300, 900, 0.2, 0.06)}
              withArrow
              className="shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50"
            >
              Join Next 15-Day Cohort
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
