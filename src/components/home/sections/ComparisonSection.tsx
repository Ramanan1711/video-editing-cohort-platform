import { Check, Info, X } from 'lucide-react';
import { TiltCard } from '../TiltCard';

export function ComparisonSection() {
  return (
    <section id="comparison" className="py-20 lg:py-28 border-t border-white/10 bg-[#070b16] relative">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 gsap-header-reveal">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
            The Core Difference
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">
            Why 94% of Our Interns Finish (and Traditional Courses Fail)*
          </h2>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            Most online courses are passive video libraries. ProCut Hub enforces a structured daily production discipline with real accountability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 gsap-cards-group">
          {/* Old Way */}
          <TiltCard
            maxTilt={5}
            scale={1.01}
            perspective={1000}
            glareOpacity={0.15}
            glareColor="rgba(239, 68, 68, 0.2)"
            className="glass-obsidian rounded-3xl border border-red-500/30 bg-red-950/20 p-7 sm:p-9 space-y-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-red-400">The Usual Way</span>
                <h3 className="text-xl font-black text-white mt-1">Passive Tutorial Hell</h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <X size={20} />
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 mt-0.5 font-bold">✕</span>
                <span><strong className="text-white">Endless Watching:</strong> 40+ hours of passive video lectures that are rarely put into practice.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 mt-0.5 font-bold">✕</span>
                <span><strong className="text-white">Toy Projects:</strong> Generic &quot;to-do apps&quot; or copy-paste clips that recruiters immediately ignore.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 mt-0.5 font-bold">✕</span>
                <span><strong className="text-white">Zero Accountability:</strong> No check-ins when you stop logging in after Day 5.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 mt-0.5 font-bold">✕</span>
                <span><strong className="text-white">Ghosted Support:</strong> Cluttered forums where your questions go unanswered for days.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 mt-0.5 font-bold">✕</span>
                <span><strong className="text-white">Unverified Certificates:</strong> Unverifiable static PDFs that carry no hiring weight.</span>
              </li>
            </ul>
          </TiltCard>

          {/* The ProCut Way */}
          <TiltCard
            maxTilt={5}
            scale={1.01}
            perspective={1000}
            glareOpacity={0.25}
            glareColor="rgba(16, 185, 129, 0.25)"
            className="glass-obsidian rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-[#090d16] to-orange-950/20 p-7 sm:p-9 space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">The ProCut Sprint</span>
                <h3 className="text-xl font-black text-white mt-1">15-Day Production Sprint</h3>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                <Check size={20} />
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold shadow-xs">✓</span>
                <span><strong className="text-white">Daily Production Tasks:</strong> 15 real client briefs with 24-hour turnaround to build shipping stamina.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold shadow-xs">✓</span>
                <span><strong className="text-white">Portfolio-Grade Deliverables:</strong> Real GitHub PRs, live demo deployments, and broadcast commercial cuts.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold shadow-xs">✓</span>
                <span><strong className="text-white">WhatsApp Inactivity Nudges:</strong> Automated alerts if you risk breaking your streak.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold shadow-xs">✓</span>
                <span><strong className="text-white">Direct 1:1 WhatsApp Mentorship:</strong> Fast voice notes and blocker clearing directly from senior leads.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5 font-bold shadow-xs">✓</span>
                <span><strong className="text-white">Accredited Credential &amp; LOR:</strong> Cryptographic verification link + personalized Letter of Recommendation.</span>
              </li>
            </ul>
          </TiltCard>
        </div>

        <div className="mt-8 flex items-start gap-2.5 max-w-2xl mx-auto p-4 rounded-xl border border-white/10 bg-[#090d16]/80 text-xs text-slate-400 shadow-md">
          <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-200">*Methodology Note:</strong> The 94.2% completion benchmark is measured across active cohort enrollees who engage with daily WhatsApp streak notifications and complete Day 1–5 foundational milestones, compared to the industry standard 5–12% completion for passive, self-paced video courses without human mentorship.
          </p>
        </div>
      </div>
    </section>
  );
}

