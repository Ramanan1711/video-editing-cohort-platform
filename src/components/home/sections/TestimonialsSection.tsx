import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Quote,
  Star,
  Play,
  Layers,
  ShieldCheck,
  ArrowUpRight,
  Maximize2,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { TiltCard } from '../TiltCard';
import { FwCard } from '../FwCard';
import {
  DeliverableInspectorModal,
  type DeliverableDetails,
} from '../DeliverableInspectorModal';
import { soundFx } from '../../../lib/soundFx';

export interface TestimonialsSectionProps {
  publishedPrice?: number;
  publishedCurrency?: string;
}

const PRODUCTION_DELIVERABLES: DeliverableDetails[] = [
  {
    id: 'kinetic-motion',
    kicker: '01 / 04 · Kinetic Motion',
    title: 'Cinematic Pacing & Kinetic Title Sequence',
    description:
      'Engineered for a commercial client with custom bezier easing curves, multi-track audio soundscapes, and viral retention pacing.',
    imgSrc:
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1280&q=80',
    alt: 'Cinematic video timeline with kinetic typography motion graphics',
    tags: ['Motion Design', 'After Effects', 'Kinetic Typography'],
    accentColor: '#B92B27',
    timecode: '00:14:22:18',
    codec: '4K PRORES 422 HQ',
    rubricScore: '99% RUBRIC MATCH',
    duration: '00:45',
    software: ['After Effects 2026', 'Premiere Pro', 'Type Engine'],
    specs: {
      resolution: '3840×2160 DCI',
      fps: '24.00',
      audio: '-14.2 LUFS True Peak',
      files: '1.8 GB RAW Footage',
    },
    rubricBreakdown: {
      pacing: 10,
      motion: 9.9,
      audio: 9.8,
      color: 9.7,
    },
    mentorNote:
      'Impeccable easing curves and text readability against complex high-contrast video footage. Ready for commercial broadcast handoff.',
    mentorName: 'Vikram Mehta',
    mentorRole: 'Lead Motion Director · Ex-Vice Media',
  },
  {
    id: 'audio-engineering',
    kicker: '02 / 04 · Audio Engineering',
    title: 'Dynamic Sound Design & Multi-Layer Atmospheric Mix',
    description:
      'Full cinema-grade audio mix with high-impact sub-bass risers, whoosh impacts, dialogue ducking, and master loudness calibration.',
    imgSrc:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1280&q=80',
    alt: 'Professional audio mixer and studio monitors for sound design',
    tags: ['Sound Design', 'Adobe Audition', '-14 LUFS Audio'],
    accentColor: '#2675EB',
    timecode: '01:08:15:02',
    codec: '32-BIT FLOAT STEMS',
    rubricScore: '98% RUBRIC MATCH',
    duration: '01:12',
    software: ['Adobe Audition', 'iZotope RX 11', 'FabFilter Pro-Q3'],
    specs: {
      resolution: 'Multi-Channel Mix',
      fps: '48.000 kHz',
      audio: '-14.0 LUFS Broadcast Target',
      files: '850 MB Stems (WAV)',
    },
    rubricBreakdown: {
      pacing: 9.8,
      motion: 9.7,
      audio: 10,
      color: 9.6,
    },
    mentorNote:
      'The low-end sub impact during the transition hit the exact sweet spot without clipping the dialogue stem. Outstanding spatial clarity.',
    mentorName: 'Arjun Sen',
    mentorRole: 'Senior Audio Engineer · Soundbox Studios',
  },
  {
    id: 'color-grading',
    kicker: '03 / 04 · Color Grading',
    title: '60s Commercial Capstone & Master Grade',
    description:
      'Mastered to international broadcast delivery targets with skin-tone vector scopes, primary LUT grading, and 100% mentor rubric defense.',
    imgSrc:
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1280&q=80',
    alt: 'DaVinci Resolve studio color grading interface and commercial video shot',
    tags: ['DaVinci Resolve', 'Color Primaries', 'Skin Tone Scopes'],
    accentColor: '#F2B705',
    timecode: '00:59:23:20',
    codec: 'BLACKMAGIC RAW (BRAW)',
    rubricScore: '100% RUBRIC MATCH',
    duration: '01:00',
    software: ['DaVinci Resolve Studio 19', 'False Color Scopes', 'ACEScc'],
    specs: {
      resolution: '4K DCI (4096×2160)',
      fps: '23.976',
      audio: 'Stereo Master -14 LUFS',
      files: '4.2 GB BRAW RAW Stems',
    },
    rubricBreakdown: {
      pacing: 9.9,
      motion: 9.8,
      audio: 9.8,
      color: 10,
    },
    mentorNote:
      'Flawless skin tone vector alignment across tungsten and daylight lighting setups. Broadcast QC test passed with zero gamut clipping.',
    mentorName: 'Neha Kapoor',
    mentorRole: 'Senior Colorist · Netflix Post-Partner',
  },
  {
    id: 'commercial-pacing',
    kicker: '04 / 04 · Commercial Pacing',
    title: 'Multi-Cam Commercial Cut with Narrative Hooks',
    description:
      'Fast-paced editorial cut with seamless J/L audio transitions, retention pattern interrupts, and full client handoff deliverables.',
    imgSrc:
      'https://pixabay.com/get/gf350dcff53176aab6915172b6c2375c41e57f63b419330dd6e7a6484b531f98e04a158f5963cc0ed5521d86bc3f1ea1d4cbbf0dca83a8e00ed4b0ace69105ea7_1920.jpg',
    alt: 'Broadcast television camera and video editing studio monitors',
    tags: ['Premiere Pro', 'Retention Edits', 'Multi-Cam Sync'],
    accentColor: '#38B44A',
    timecode: '00:30:12:06',
    codec: 'PRORES 4444 XQ',
    rubricScore: '97% RUBRIC MATCH',
    duration: '00:30',
    software: ['Premiere Pro 2026', 'Frame.io Cloud', 'SpeedGrade'],
    specs: {
      resolution: '16:9 + 9:16 Dual Delivery',
      fps: '24.00',
      audio: '-14 LUFS Integrated',
      files: '3.1 GB Sony FX3 Log RAW',
    },
    rubricBreakdown: {
      pacing: 10,
      motion: 9.8,
      audio: 9.7,
      color: 9.6,
    },
    mentorNote:
      'The opening 3-second visual hook drives retention flawlessly. Pattern interrupts feel organic and never distract from the brand callout.',
    mentorName: 'Kabir Varma',
    mentorRole: 'Creative Director · HyperScale Agency',
  },
];

export function TestimonialsSection(_props: TestimonialsSectionProps = {}) {
  const [activeDeliverableIndex, setActiveDeliverableIndex] = useState<number>(0);
  const [inspectingDeliverable, setInspectingDeliverable] =
    useState<DeliverableDetails | null>(null);

  const carouselRef = useRef<HTMLUListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDeliverable = PRODUCTION_DELIVERABLES[activeDeliverableIndex];

  // Smoothly scroll mobile/tablet carousel to specified card
  const scrollToIndex = useCallback((index: number) => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const items = container.children;
    const targetItem = items[index] as HTMLElement | undefined;
    if (targetItem) {
      isProgrammaticScrollRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      const targetLeft =
        targetItem.offsetLeft - (container.clientWidth - targetItem.offsetWidth) / 2;

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: 'smooth',
        });
      } else {
        container.scrollLeft = Math.max(0, targetLeft);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }
  }, []);

  // Sync scroll position from user swiping in carousel
  const handleCarouselScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current || !carouselRef.current) return;
    const container = carouselRef.current;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const items = Array.from(container.children) as HTMLElement[];
    if (!items.length) return;

    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const distance = Math.abs(containerCenter - itemCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (
      closestIndex !== activeDeliverableIndex &&
      closestIndex >= 0 &&
      closestIndex < PRODUCTION_DELIVERABLES.length
    ) {
      setActiveDeliverableIndex(closestIndex);
    }
  }, [activeDeliverableIndex]);

  // Keep active tab visible in filter tab strip
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeTab = tabsRef.current.children[activeDeliverableIndex] as HTMLElement | undefined;
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    }
  }, [activeDeliverableIndex]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handlePrev = () => {
    soundFx.playBlip(440, 0.02, 'sine', 0.02);
    const nextIdx =
      activeDeliverableIndex === 0
        ? PRODUCTION_DELIVERABLES.length - 1
        : activeDeliverableIndex - 1;
    setActiveDeliverableIndex(nextIdx);
    scrollToIndex(nextIdx);
  };

  const handleNext = () => {
    soundFx.playBlip(540, 0.02, 'sine', 0.02);
    const nextIdx =
      activeDeliverableIndex === PRODUCTION_DELIVERABLES.length - 1
        ? 0
        : activeDeliverableIndex + 1;
    setActiveDeliverableIndex(nextIdx);
    scrollToIndex(nextIdx);
  };

  const handleSelectTab = (idx: number) => {
    soundFx.playBlip(520, 0.02, 'sine', 0.02);
    setActiveDeliverableIndex(idx);
    scrollToIndex(idx);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* SECTION: SELECTED PRODUCTION DELIVERABLES (CREATIVE SHOWCASE)              */}
      {/* ========================================================================= */}
      <section
        id="deliverables"
        className="border-t border-white/10 bg-[#030712] py-16 sm:py-20 lg:py-28 relative overflow-hidden fw"
      >
        {/* Subtle Ambient Nebula */}
        <div
          className="pointer-events-none absolute top-1/3 right-10 size-[320px] sm:size-[450px] lg:size-[500px] rounded-full blur-[140px] opacity-15 transition-colors duration-700"
          style={{ backgroundColor: activeDeliverable.accentColor }}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <div className="gsap-header-reveal flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase border border-[#38B44A]/30 bg-[#38B44A]/10 text-[#38B44A] mb-3">
                <span className="size-2 rounded-full bg-[#38B44A] animate-pulse" />
                <span>Selected Production Deliverables · Junca .FW Showcase</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mt-1">
                Selected Production Proof-of-Work
              </h2>
            </div>

            <div className="flex flex-col md:items-end gap-3">
              <p className="text-xs sm:text-sm text-slate-400 max-w-md md:text-right leading-relaxed">
                Inspect real production cuts built by cohort members under 24-hour sprint briefs.
              </p>

              {/* Navigation Controls & Hint (Visible across mobile, tablet, and desktop) */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-500 mr-2 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#F2B705] animate-ping" />
                  <span className="hidden lg:inline">Hover to Expand · Click to Inspect</span>
                  <span className="lg:hidden">Swipe or Tap to Inspect</span>
                </span>
                <button
                  onClick={handlePrev}
                  className="p-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/30 active:scale-95 transition-all"
                  aria-label="Previous deliverable"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-slate-400 px-1 font-bold">
                  0{activeDeliverableIndex + 1} / 0{PRODUCTION_DELIVERABLES.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/30 active:scale-95 transition-all"
                  aria-label="Next deliverable"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick-Select Filter Tabs */}
          <div
            ref={tabsRef}
            className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 sm:mb-8 scrollbar-none"
          >
            {PRODUCTION_DELIVERABLES.map((item, idx) => {
              const isSelected = idx === activeDeliverableIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(idx)}
                  onMouseEnter={() => {
                    soundFx.playBlip(480, 0.015, 'sine', 0.01);
                    setActiveDeliverableIndex(idx);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2 border shrink-0 ${
                    isSelected
                      ? 'border-white text-white shadow-lg bg-white/10'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20 bg-white/[0.02]'
                  }`}
                  style={{
                    borderColor: isSelected ? item.accentColor : undefined,
                  }}
                >
                  <span
                    className={`size-2 rounded-full transition-all ${
                      isSelected ? 'scale-125' : 'opacity-40'
                    }`}
                    style={{ backgroundColor: item.accentColor }}
                  />
                  <span>{item.kicker.split('·')[1]?.trim() || item.kicker}</span>
                </button>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* DESKTOP (≥ lg): CREATIVE HORIZONTAL HOVER ACCORDION DECK          */}
          {/* ================================================================= */}
          <div className="hidden lg:flex h-[580px] xl:h-[620px] gap-3 lg:gap-4 w-full select-none items-stretch">
            {PRODUCTION_DELIVERABLES.map((item, idx) => {
              const isExpanded = idx === activeDeliverableIndex;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => {
                    if (idx !== activeDeliverableIndex) {
                      soundFx.playBlip(540, 0.02, 'sine', 0.015);
                      setActiveDeliverableIndex(idx);
                    }
                  }}
                  onClick={() => {
                    if (!isExpanded) {
                      soundFx.playBlip(540, 0.02, 'sine', 0.015);
                      setActiveDeliverableIndex(idx);
                    } else {
                      soundFx.playSweep(260, 680, 0.1, 0.04);
                      setInspectingDeliverable(item);
                    }
                  }}
                  className={`relative rounded-2xl lg:rounded-3xl overflow-hidden border transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group shadow-2xl flex flex-col justify-between ${
                    isExpanded
                      ? 'flex-[3.5] xl:flex-[3.8] border-white/30 bg-[#080d1a]'
                      : 'flex-1 xl:flex-[0.8] border-white/10 bg-[#050811] hover:border-white/20'
                  }`}
                  style={{
                    borderColor: isExpanded ? `${item.accentColor}80` : undefined,
                  }}
                >
                  {/* Background Media with Parallax/Zoom */}
                  <div className="absolute inset-0 z-0">
                    <img
                      src={item.imgSrc}
                      alt={item.alt}
                      className={`size-full object-cover transition-all duration-1000 ${
                        isExpanded
                          ? 'scale-105 opacity-85'
                          : 'scale-100 opacity-35 group-hover:opacity-55'
                      }`}
                    />
                    {/* Dark Cinematic Vignette */}
                    <div
                      className={`absolute inset-0 transition-opacity duration-700 ${
                        isExpanded
                          ? 'bg-gradient-to-t from-[#030712] via-[#030712]/50 to-black/60'
                          : 'bg-black/75 group-hover:bg-black/60'
                      }`}
                    />

                    {/* Subtle Scanlines */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-25"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)',
                      }}
                    />
                  </div>

                  {/* Top Glowing Edge Accent Line */}
                  <div
                    className="absolute top-0 inset-x-0 h-1 transition-opacity duration-500"
                    style={{
                      backgroundColor: item.accentColor,
                      opacity: isExpanded ? 1 : 0.4,
                    }}
                  />

                  {/* ========================================================= */}
                  {/* EXPANDED VIEW STATE                                       */}
                  {/* ========================================================= */}
                  {isExpanded ? (
                    <div className="relative z-10 p-6 lg:p-8 flex flex-col justify-between size-full animate-in fade-in duration-500">
                      {/* Top Viewfinder HUD */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/75 border border-white/15 backdrop-blur-md text-xs font-mono">
                          <span
                            className="size-2 rounded-full animate-ping"
                            style={{ backgroundColor: item.accentColor }}
                          />
                          <span className="font-bold text-red-400">REC ●</span>
                          <span className="text-white/90">{item.timecode}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 border border-white/15 backdrop-blur-md text-[11px] font-mono text-slate-300">
                            {item.codec}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              soundFx.playSweep(260, 680, 0.1, 0.04);
                              setInspectingDeliverable(item);
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold text-white transition-all backdrop-blur-md"
                          >
                            <Maximize2 size={12} />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </div>

                      {/* Center Play Button Hero with Radial Ripple */}
                      <div className="flex items-center justify-center my-auto">
                        <div className="relative group/play flex items-center justify-center">
                          <div
                            className="absolute size-24 rounded-full opacity-40 blur-xl animate-pulse"
                            style={{ backgroundColor: item.accentColor }}
                          />
                          <div className="relative flex size-16 lg:size-20 items-center justify-center rounded-full bg-black/70 border border-white/30 backdrop-blur-md text-white shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:border-white">
                            <Play size={26} className="fill-white translate-x-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Deliverable Telemetry & Specs */}
                      <div className="space-y-3.5 bg-black/70 border border-white/15 rounded-2xl p-5 lg:p-6 backdrop-blur-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                              {item.kicker}
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="text-[11px] font-mono text-[#38B44A] flex items-center gap-1 font-bold">
                              <ShieldCheck size={13} /> {item.rubricScore}
                            </span>
                          </div>

                          {/* Dynamic Audio Visualizer */}
                          <div className="flex items-end gap-1 h-3.5">
                            {[4, 12, 7, 14, 5, 11, 8, 13].map((h, i) => (
                              <span
                                key={i}
                                className="w-1 rounded-full animate-pulse"
                                style={{
                                  height: `${h}px`,
                                  backgroundColor: item.accentColor,
                                  animationDelay: `${i * 120}ms`,
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <h3 className="text-xl lg:text-2xl font-black text-white leading-snug">
                          {item.title}
                        </h3>

                        <p className="text-xs lg:text-sm text-slate-300 leading-relaxed font-normal line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
                          {/* Software stack */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.software.map((sw, idxSw) => (
                              <span
                                key={idxSw}
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-white/5 border border-white/15 text-slate-200"
                              >
                                <Layers size={10} className="text-[#F2B705]" />
                                {sw}
                              </span>
                            ))}
                          </div>

                          {/* Quick Inspect trigger button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              soundFx.playSweep(260, 680, 0.1, 0.04);
                              setInspectingDeliverable(item);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white hover:text-[#F2B705] transition-colors"
                          >
                            <span>Inspect Rubric &amp; RAW Specs</span>
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ========================================================= */
                    /* COMPRESSED VIEW STATE (SLEEK ARCHITECTURAL BLADE)        */
                    /* ========================================================= */
                    <div className="relative z-10 p-4 lg:p-5 flex flex-col justify-between items-center size-full">
                      {/* Top Number Identifier */}
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="size-2 rounded-full mb-1"
                          style={{ backgroundColor: item.accentColor }}
                        />
                        <span className="text-xs font-mono font-black text-white/80">
                          0{idx + 1}
                        </span>
                      </div>

                      {/* Rotated Vertical Title Spine */}
                      <div className="py-6 flex items-center justify-center">
                        <span
                          className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-slate-300 group-hover:text-white transition-colors whitespace-nowrap [writing-mode:vertical-rl] rotate-180"
                        >
                          {item.kicker.split('·')[1]?.trim() || item.title}
                        </span>
                      </div>

                      {/* Bottom Expand Arrow Trigger */}
                      <div className="size-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:border-white transition-all group-hover:scale-110">
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* MOBILE & TABLET (< lg): FLUID HORIZONTAL SNAP CAROUSEL            */}
          {/* ================================================================= */}
          <div className="lg:hidden space-y-4">
            <ul
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-none list-none m-0 pt-1"
              aria-label="Production deliverables carousel"
            >
              {PRODUCTION_DELIVERABLES.map((item, idx) => {
                const isSelected = idx === activeDeliverableIndex;
                return (
                  <FwCard
                    key={item.id}
                    className="w-[86vw] sm:w-[380px] md:w-[440px] snap-center shrink-0 cursor-pointer"
                    isActive={isSelected}
                    figure={{
                      imgSrc: item.imgSrc,
                      alt: item.alt,
                      tags: item.tags,
                      aspectRatio: '16/10',
                    }}
                    kicker={item.kicker}
                    title={item.title}
                    description={item.description}
                    timecode={item.timecode}
                    codec={item.codec}
                    rubricScore={item.rubricScore}
                    software={item.software}
                    accentColor={item.accentColor}
                    cursorLabel="INSPECT CUT"
                    onClick={() => {
                      soundFx.playSweep(260, 680, 0.1, 0.04);
                      setInspectingDeliverable(item);
                    }}
                  />
                );
              })}
            </ul>

            {/* Mobile & Tablet Dots Indicator + Quick Jump */}
            <div className="flex items-center justify-between gap-4 pt-2 px-1">
              <div className="flex items-center gap-2">
                {PRODUCTION_DELIVERABLES.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      soundFx.playBlip(500, 0.02, 'sine', 0.015);
                      setActiveDeliverableIndex(idx);
                      scrollToIndex(idx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === activeDeliverableIndex
                        ? 'w-8 bg-white'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    style={{
                      backgroundColor:
                        idx === activeDeliverableIndex ? item.accentColor : undefined,
                    }}
                    aria-label={`Go to deliverable ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span className="font-bold text-white">0{activeDeliverableIndex + 1}</span>
                <span>/</span>
                <span>0{PRODUCTION_DELIVERABLES.length}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* INTERACTIVE DELIVERABLE INSPECTOR MODAL                                   */}
      {/* ========================================================================= */}
      <DeliverableInspectorModal
        isOpen={inspectingDeliverable !== null}
        onClose={() => setInspectingDeliverable(null)}
        deliverable={inspectingDeliverable}
      />

      {/* ========================================================================= */}
      {/* SECTION 12: VERIFIED CREDENTIAL & MENTOR RECOMMENDATION                   */}
      {/* ========================================================================= */}
      <section
        id="credentials"
        className="border-t border-white/10 bg-[#070b16] py-16 sm:py-20 lg:py-28 text-white relative overflow-hidden"
      >
        {/* Ambient Amber Glow */}
        <div className="gsap-parallax-slow absolute top-1/2 -right-40 size-96 rounded-full bg-[#F2B705]/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="gsap-header-reveal space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F2B705]/10 border border-[#F2B705]/20 px-3 py-1 text-xs font-black text-[#F2B705]">
                <Award size={14} />
                <span>Proof of Competence</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                A Verifiable Credential That Employers Actually Respect.
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Anyone can fake watching videos. Nobody can fake 15 days of verified daily submissions and mentor reviews.
              </p>

              <div className="space-y-3.5 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span>
                    <strong>Cryptographic Verification:</strong> Each certificate includes a unique verification URL and QR code for recruiter validation.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span>
                    <strong>Mentor Letter of Recommendation:</strong> Detailed assessment of your timeline speed, storytelling discipline, and technical execution.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#38B44A] shrink-0 mt-0.5" />
                  <span>
                    <strong>LinkedIn 1-Click Credential:</strong> Display your verified internship certificate directly on your professional profile.
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  href="/register"
                  withArrow
                  className="bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] text-white border-none shadow-lg shadow-[#B92B27]/25"
                >
                  Earn Your Credential
                </Button>
              </div>
            </div>

            {/* Realistic Certificate Mockup with 3D Depth Tilt */}
            <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#B92B27] via-[#F2B705] to-[#2675EB] opacity-20 blur-2xl pointer-events-none" />
              <TiltCard
                maxTilt={8}
                glareColor="rgba(242, 183, 5, 0.2)"
                className="relative rounded-2xl border border-[#F2B705]/40 bg-gradient-to-b from-slate-900 via-[#070b16] to-[#030712] p-5 sm:p-7 md:p-9 shadow-2xl text-slate-100 space-y-5 sm:space-y-6"
              >
                <div className="flex items-start justify-between border-b border-white/10 pb-4 sm:pb-5">
                  <div className="min-w-0 pr-2">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#F2B705]">
                      Iunoware Academy · Verified Credential
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-snug">
                      Certificate of Internship Completion
                    </h3>
                  </div>
                  <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-[#F2B705]/10 border border-[#F2B705]/30 text-[#F2B705]">
                    <Award size={22} className="sm:w-6 sm:h-6" />
                  </div>
                </div>

                <div className="space-y-2 text-center py-2 sm:py-4">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest">
                    This acknowledges that
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Candidate Name
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    has successfully satisfied all 15 production deliverables, passed mentor audits, and graduated with distinction in
                  </p>
                  <p className="text-xs sm:text-sm font-black text-[#D93830]">
                    Commercial Video Editing &amp; Kinetic Motion Track
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-t border-white/10 pt-4 sm:pt-5 text-xs text-slate-400">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-500">
                      Credential ID
                    </p>
                    <p className="font-mono text-xs text-slate-300">PCH-2026-VERIFIED</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <QrCode size={24} className="text-[#F2B705] shrink-0 sm:w-6 sm:h-6" />
                    <div className="text-right">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#38B44A] whitespace-nowrap">
                        ✓ Cryptographically Signed
                      </p>
                      <p className="text-[8px] sm:text-[9px] text-slate-500">Scan to verify</p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 15: WALL OF LOVE / VERIFIED STUDENT STORIES                        */}
      {/* ========================================================================= */}
      <section className="bg-[#030712] border-t border-white/10 py-16 sm:py-20 lg:py-28 text-white relative overflow-hidden">
        {/* Ambient Warm Glow */}
        <div className="gsap-parallax-slow absolute top-1/2 left-1/4 -translate-y-1/2 size-96 rounded-full bg-[#B92B27]/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="gsap-header-reveal lg:col-span-1 space-y-4">
              <Quote size={32} className="text-[#F2B705]/40 sm:w-9 sm:h-9" />
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                &quot;I finally finished work I am proud to send to clients.&quot;
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Verified stories from video editors who completed the 15-day sprint and landed paying client projects.
              </p>
            </div>

            <div className="gsap-cards-group lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-5 sm:p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-[#B92B27]/40 transition">
                <div className="flex text-[#F2B705]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;The 15-day structure is genius. You don&apos;t have time to procrastinate. The WhatsApp support helped me unblock a tricky pacing cut in 10 minutes.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Pooja S.</p>
                  <p className="text-[10px] text-[#2675EB]">
                    Motion Design Track · Kinetic Subtitle Deliverable
                  </p>
                </div>
              </TiltCard>

              <TiltCard className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-5 sm:p-6 rounded-2xl text-white space-y-3 shadow-xl hover:border-[#B92B27]/40 transition">
                <div className="flex text-[#F2B705]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  &quot;My cuts went from boring and amateur to having real commercial rhythm. The mentor critique room showed me mistakes I was making for 2 years.&quot;
                </p>
                <div>
                  <p className="text-xs font-black text-white">Rahul K.</p>
                  <p className="text-[10px] text-[#D93830]">
                    Video Editing Track · 60s Commercial Cut
                  </p>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
