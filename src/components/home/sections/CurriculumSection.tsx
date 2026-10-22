import {
  Clock,
  Flame,
  MessageCircle,
  Play,
} from 'lucide-react';
import { TiltCard } from '../TiltCard';
import { InteractiveSprintCurriculum } from '../InteractiveSprintCurriculum';

export function CurriculumSection() {
  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 2: HOW IT WORKS — A DAY IN THE LIFE OF AN INTERN */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="border-t border-white/10 bg-[#030712] py-20 lg:py-28 relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2B705]">
              The Daily Rhythm
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              A Day in the Life of an Iunoware Academy Intern
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Every single day follows an engineered 4-step sequence designed to build professional velocity without burning you out.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 gsap-cards-group">
            {/* Step 1 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#B92B27] font-mono">01</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#B92B27]/15 border border-[#B92B27]/30 text-[#D93830]">
                  <Clock size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                9:00 AM · The Morning Brief Drop
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Receive the day&apos;s realistic production challenge directly via WhatsApp and the portal, complete with source assets, raw footage, and Figma specs.
              </p>
              <div className="text-[11px] font-bold text-[#D93830] pt-2 border-t border-white/10 font-mono">
                Duration: 15–20 min brief review
              </div>
            </TiltCard>

            {/* Step 2 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#F2B705] font-mono">02</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#F2B705]/15 border border-[#F2B705]/30 text-[#F2B705]">
                  <Play size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Focused Build &amp; Debug
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Execute the assignment in your timeline or IDE. Stuck? Jump into your 1:1 WhatsApp channel with senior mentors to unblock technical barriers instantly.
              </p>
              <div className="text-[11px] font-bold text-[#F2B705] pt-2 border-t border-white/10 font-mono">
                Duration: 60–90 min build sprint
              </div>
            </TiltCard>

            {/* Step 3 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#38B44A] font-mono">03</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#38B44A]/15 border border-[#38B44A]/30 text-[#38B44A]">
                  <MessageCircle size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Submission &amp; 1:1 Review
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Upload your video export or submit a GitHub PR before the 11:59 PM deadline. Within 24 hours, receive detailed written and audio rubric feedback.
              </p>
              <div className="text-[11px] font-bold text-[#38B44A] pt-2 border-t border-white/10 font-mono">
                SLA: &lt;24h mentor feedback guarantee
              </div>
            </TiltCard>

            {/* Step 4 */}
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#2675EB] font-mono">04</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#2675EB]/15 border border-[#2675EB]/30 text-[#2675EB]">
                  <Flame size={16} />
                </span>
              </div>
              <h3 className="text-base font-black text-white">
                Streak &amp; Level Up
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn XP points, advance your level on the cohort leaderboard, and protect your consecutive daily streak to unlock your end-of-cohort letter of recommendation.
              </p>
              <div className="text-[11px] font-bold text-[#2675EB] pt-2 border-t border-white/10 font-mono">
                Result: Unstoppable shipping momentum
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: COMPLETE 15-DAY DAILY ARCHITECTURE ROADMAP */}
      {/* ========================================================================= */}
      <div id="tracks">
        <InteractiveSprintCurriculum />
      </div>
    </>
  );
}

