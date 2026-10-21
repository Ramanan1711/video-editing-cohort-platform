import {
  Clock,
  Download,
  FileText,
  Flame,
  MessageCircle,
  Play,
  Sparkles,
  Video,
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

      {/* ========================================================================= */}
      {/* SECTION 5: STARTER PACKS & ASSET VAULT INCLUDED */}
      {/* ========================================================================= */}
      <section id="assets" className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 relative">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 gsap-header-reveal">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2B705]">
              Production-Ready Resources
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
              Over ₹30,000 in Starter Assets &amp; Toolkits Included
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              No need to spend weeks hunting for media or boilerplate. You hit the ground running on Day 1 with industry-standard starter projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 gsap-cards-group">
            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#B92B27]/15 border border-[#B92B27]/30 text-[#D93830]">
                <Video size={18} />
              </div>
              <h3 className="text-base font-black text-white">4K Raw Commercial Footage</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Over 50 GB of multicam Sony FX3 &amp; RED RAW footage shots: interviews, tech B-roll, lifestyle, and dynamic transitions.
              </p>
              <div className="text-[11px] font-bold text-[#D93830] pt-2 border-t border-white/10 font-mono">
                100% Commercial Usage Rights
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#F2B705]/15 border border-[#F2B705]/30 text-[#F2B705]">
                <Download size={18} />
              </div>
              <h3 className="text-base font-black text-white">Mastered Sound FX Vault</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Curated library of 300+ cinema-quality audio assets: deep sub-bass risers, whooshes, UI clicks, keyboard textures, and vinyl noise.
              </p>
              <div className="text-[11px] font-bold text-[#F2B705] pt-2 border-t border-white/10 font-mono">
                24-bit 48kHz WAV Masters
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#2675EB]/15 border border-[#2675EB]/30 text-[#2675EB]">
                <Sparkles size={18} />
              </div>
              <h3 className="text-base font-black text-white">Motion Presets &amp; Project Files</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pre-built Premiere Pro (.prproj), DaVinci Resolve (.drp), and After Effects (.aep) project templates with kinetic MOGRTs and transition curves.
              </p>
              <div className="text-[11px] font-bold text-[#2675EB] pt-2 border-t border-white/10 font-mono">
                MOGRT &amp; DRFX Studio Templates
              </div>
            </TiltCard>

            <TiltCard maxTilt={6} className="glass-obsidian p-6 border-white/10 space-y-4 shadow-xl">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#38B44A]/15 border border-[#38B44A]/30 text-[#38B44A]">
                <FileText size={18} />
              </div>
              <h3 className="text-base font-black text-white">Agency Brief &amp; Rubric Vault</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Exact PDF briefs used by leading agencies: client deliverables, storyboard templates, Loom walk-through checklists, and contract templates.
              </p>
              <div className="text-[11px] font-bold text-[#38B44A] pt-2 border-t border-white/10 font-mono">
                Editable Notion / PDF Packs
              </div>
            </TiltCard>
          </div>
        </div>
      </section>
    </>
  );
}

