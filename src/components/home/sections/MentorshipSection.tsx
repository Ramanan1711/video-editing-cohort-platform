import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { TiltCard } from '../TiltCard';
import { soundFx } from '../../../lib/soundFx';
import { BRAND_LOGO_URL } from '../../../constants/branding';

export function MentorshipSection() {
  const [activeChatScenario, setActiveChatScenario] = useState<'audio' | 'video' | 'nudge'>('video');

  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION 6: WHATSAPP MENTORSHIP ENGINE & SIMULATOR */}
      {/* ========================================================================= */}
      <section id="mentorship" className="py-20 lg:py-28 bg-[#070b16] border-t border-white/10 relative overflow-hidden">
        {/* Ambient Lighting Orb */}
        <div className="absolute top-1/4 -right-40 size-96 rounded-full bg-[#38B44A]/10 blur-3xl pointer-events-none gsap-parallax-slow" />

        <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="gsap-header-reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#38B44A]/10 border border-[#38B44A]/20 px-3 py-1 text-xs font-black text-[#38B44A] mb-4">
                <MessageCircle size={14} />
                <span>Real-Time Accountability</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                A Senior Mentor in Your Pocket via WhatsApp.
              </h2>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                No impersonal forums or ticket systems that take days to answer. With Iunoware Academy, you communicate directly with an assigned senior video editor and creative director.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#38B44A]/20 text-[#38B44A] border border-[#38B44A]/30 mt-0.5 shadow-xs shadow-[#38B44A]/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Daily 9:00 AM Challenge Drops</p>
                    <p className="text-xs text-slate-400">Receive today’s task brief and quick links directly on WhatsApp.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#38B44A]/20 text-[#38B44A] border border-[#38B44A]/30 mt-0.5 shadow-xs shadow-[#38B44A]/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Voice-Note Timeline &amp; Color Audits</p>
                    <p className="text-xs text-slate-400">Mentors send 30-second voice notes pointing out exact timestamps and cut points to refine.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#38B44A]/20 text-[#38B44A] border border-[#38B44A]/30 mt-0.5 shadow-xs shadow-[#38B44A]/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">Proactive Inactivity Shield</p>
                    <p className="text-xs text-slate-400">Our system detects if you’re falling behind and sends a friendly nudge to keep your streak alive.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#38B44A]/20 text-[#38B44A] border border-[#38B44A]/30 mt-0.5 shadow-xs shadow-[#38B44A]/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">5-Pillar Commercial Rubric Audits</p>
                    <p className="text-xs text-slate-400">Scored against technical execution, timeline polish, audio mastery, and commercial client readiness.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#38B44A]/20 text-[#38B44A] border border-[#38B44A]/30 mt-0.5 shadow-xs shadow-[#38B44A]/20">
                    <Check size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">&lt;24h Guaranteed Feedback SLA</p>
                    <p className="text-xs text-slate-400">Receive written rubric breakdowns and voice note critiques within 24 hours so you never lose momentum.</p>
                  </div>
                </div>
              </div>

              {/* Scenario Toggle */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Test the WhatsApp Simulator:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('video');
                      soundFx.playBlip(440, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'video'
                        ? 'bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] text-white shadow-lg shadow-[#B92B27]/25 ring-1 ring-[#D93830]'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Pacing Critique
                  </button>
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('audio');
                      soundFx.playBlip(520, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'audio'
                        ? 'bg-gradient-to-r from-[#2675EB] to-[#1B5FCC] text-white shadow-lg shadow-[#2675EB]/25 ring-1 ring-[#2675EB]'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Audio &amp; Mix Triage
                  </button>
                  <button
                    type="button"
                    data-cursor="TEST CHAT"
                    onClick={() => {
                      setActiveChatScenario('nudge');
                      soundFx.playBlip(620, 0.04, 'sine', 0.04);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeChatScenario === 'nudge'
                        ? 'bg-gradient-to-r from-[#F2B705] to-[#D99B02] text-slate-950 font-bold shadow-lg shadow-[#F2B705]/25 ring-1 ring-[#F2B705]'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Streak Inactivity Nudge
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Simulation Card with 3D Depth Tilt */}
            <TiltCard
              maxTilt={6}
              glareColor="rgba(56, 180, 74, 0.15)"
              className="rounded-3xl border border-surface-subtle bg-surface-card/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] shadow-emerald-950/20 space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="relative flex items-center justify-center size-11 rounded-full bg-[#030712] border border-[#38B44A]/30 p-1.5 shadow-md shadow-emerald-950/40">
                  <img
                    src={BRAND_LOGO_URL}
                    alt="Iunoware Academy"
                    className="w-full h-auto object-contain"
                  />
                  <span className="absolute bottom-0 right-0 size-3 rounded-full bg-[#38B44A] ring-2 ring-[#030712]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">Iunoware Academy Mentor Desk</h3>
                  <p className="text-[10px] text-[#38B44A] font-bold">Online • Mentor Response Target &lt;15 mins</p>
                </div>
              </div>

              <div className="space-y-3 text-xs min-h-[220px] flex flex-col justify-center">
                {activeChatScenario === 'video' ? (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                      🚀 <strong>Day 06 is LIVE:</strong> Color Grading Primaries &amp; Skin Tones in Resolve. Starter 4K Sony RAW clip is in your portal!
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] text-white p-3.5 max-w-[85%] shadow-md shadow-[#B92B27]/20">
                      Hey mentor! My skin tones look a bit magenta under studio lights. What node should I adjust first?
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-[#38B44A] mb-1">9:12 AM • Mentor Voice Note (0:24)</p>
                      &quot;Check your vector scope skin line. Drop node 2 hue-vs-hue slightly toward yellow (+4 degrees) and balance the offset wheel. You&apos;re super close!&quot;
                    </div>
                  </>
                ) : activeChatScenario === 'audio' ? (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-slate-400 mb-1">9:00 AM • Challenge Drop</p>
                      ⚡ <strong>Day 08 is LIVE:</strong> Multi-Track Sound Design &amp; Atmospheric Stems. Target -14 LUFS integrated delivery.
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-[#2675EB] to-[#1B5FCC] text-white p-3.5 max-w-[85%] shadow-md shadow-[#2675EB]/20">
                      My dialogue is getting drowned out by the riser and sub-bass during the drop transition. How should I duck it?
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-[#38B44A] mb-1">9:14 AM • Mentor Reply</p>
                      &quot;Add a sidechain compressor on the music bus keyed to the dialogue channel with a fast 5ms attack, and notch out 300Hz–2.5kHz with dynamic EQ!&quot;
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-[#F2B705] mb-1">8:30 PM • Automated Streak Shield</p>
                      ⚠️ <strong>Hey Alex!</strong> Your 6-Day Streak is at risk. Day 07 deadline is in 3.5 hours (11:59 PM). Need any blocker cleared before submitting?
                    </div>
                    <div className="ml-auto rounded-xl rounded-tr-none bg-gradient-to-r from-[#F2B705] to-[#D99B02] text-slate-950 font-semibold p-3.5 max-w-[85%] shadow-md shadow-[#F2B705]/20">
                      Thanks for the ping! Just finishing up the final audio export now. Submitting in 20 mins!
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white/[0.06] p-3.5 max-w-[85%] text-slate-200 border border-white/10 shadow-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] text-[#38B44A] mb-1">8:52 PM • System Confirmation</p>
                      ✅ Submission received! Streak preserved: <strong>7 Days Strong 🔥</strong>.
                    </div>
                  </>
                )}
              </div>
            </TiltCard>
          </div>
        </div>
      </section>
    </>
  );
}

