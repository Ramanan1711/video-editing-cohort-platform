import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Gift, Sparkles, X } from 'lucide-react';
import {
  getActiveAdvertisements,
  resolveAdvertisementImageUrl,
  type Advertisement,
} from '../../lib/advertisementService';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

export function HomepageAdvertisementModal() {
  const [activeAd, setActiveAd] = useState<Advertisement | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
  const [imageFailed, setImageFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  // Scroll lock only when full lightbox popup is open
  useModalScrollLock(isOpen && activeAd?.display_type === 'popup');

  useEffect(() => {
    let isMounted = true;

    void getActiveAdvertisements().then((ads) => {
      if (!isMounted || !ads || ads.length === 0) return;

      // Pick highest priority active ad
      const primaryAd = ads[0];
      setActiveAd(primaryAd);

      // Check if user dismissed this specific ad in the last 24 hours
      const dismissKey = `iunoware_dismissed_ad_${primaryAd.id}`;
      const dismissedTimestamp = localStorage.getItem(dismissKey);
      const isRecentlyDismissed =
        dismissedTimestamp && Date.now() - Number(dismissedTimestamp) < 24 * 60 * 60 * 1000;

      if (!isRecentlyDismissed) {
        // Trigger opening smoothly after hero animation stabilizes (1.2s delay)
        const timer = setTimeout(() => {
          if (isMounted) setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      } else {
        setIsDismissed(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeAd?.image_url) {
      setResolvedImageUrl(activeAd.image_url);
      setImageFailed(false);
    } else {
      setResolvedImageUrl('');
      setImageFailed(false);
    }
  }, [activeAd]);

  const handleImageError = () => {
    if (
      resolvedImageUrl &&
      (resolvedImageUrl.includes('/course-assets/') || resolvedImageUrl.startsWith('course-assets/')) &&
      !resolvedImageUrl.includes('/object/sign/')
    ) {
      void resolveAdvertisementImageUrl(resolvedImageUrl).then((signed) => {
        if (signed && signed !== resolvedImageUrl) {
          setResolvedImageUrl(signed);
          return;
        }
        setImageFailed(true);
      });
      return;
    }
    setImageFailed(true);
  };

  if (!activeAd) return null;

  const handleDismiss = (dontShowAgainToday = false) => {
    setIsOpen(false);
    setIsDismissed(true);
    if (dontShowAgainToday && activeAd) {
      localStorage.setItem(`iunoware_dismissed_ad_${activeAd.id}`, Date.now().toString());
    }
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(false);

    const target = activeAd.cta_link?.trim() || '#pricing';

    if (target.startsWith('#')) {
      const lenis = (window as unknown as { lenis?: { scrollTo: (target: string, options?: { offset?: number; duration?: number }) => void } }).lenis;
      if (lenis && typeof lenis.scrollTo === 'function') {
        lenis.scrollTo(target, { offset: -72, duration: 1.2 });
      } else {
        const el = document.querySelector(target);
        if (el) {
          const y = el.getBoundingClientRect().top + window.pageYOffset - 72;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    } else if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      navigate(target);
    }
  };

  // --- 1. STICKY TOP BANNER VARIANT ---
  if (activeAd.display_type === 'banner') {
    if (!isOpen && isDismissed) return null;
    return (
      <div className="relative z-40 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 px-4 py-2.5 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {activeAd.badge_text && (
              <span className="shrink-0 rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                {activeAd.badge_text}
              </span>
            )}
            <span className="truncate">{activeAd.title}</span>
            {activeAd.tagline && (
              <span className="hidden md:inline font-normal text-orange-100 truncate">
                · {activeAd.tagline}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCtaClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-xs font-black text-orange-950 shadow-xs hover:bg-orange-50 transition"
            >
              <span>{activeAd.cta_text || 'Learn More'}</span>
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => handleDismiss(true)}
              aria-label="Dismiss banner"
              className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. FLOATING CYBER CORNER CARD VARIANT ---
  if (activeAd.display_type === 'floating_card') {
    if (!isOpen && isDismissed) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-14 right-5 z-40 flex items-center gap-2 rounded-full border border-orange-500/40 bg-surface-card/95 px-3.5 py-2 text-xs font-bold text-orange-400 shadow-xl backdrop-blur-md hover:scale-105 hover:border-orange-400 transition"
        >
          <Gift size={15} className="animate-bounce text-orange-500" />
          <span>{activeAd.badge_text || 'Special Offer'}</span>
        </button>
      );
    }

    if (!isOpen) return null;

    return (
      <div className="fixed bottom-14 right-5 z-40 max-w-sm w-full rounded-2xl border border-surface-subtle bg-surface-card p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300">
        <button
          onClick={() => handleDismiss(true)}
          className="absolute top-3 right-3 rounded-full bg-surface-elevated p-1 text-slate-400 hover:text-white transition"
          aria-label="Close promotion"
        >
          <X size={14} />
        </button>

        {resolvedImageUrl && !imageFailed && (
          <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-3 border border-surface-subtle">
            <img
              src={resolvedImageUrl}
              alt={activeAd.title}
              className="h-full w-full object-cover"
              onError={handleImageError}
            />
          </div>
        )}

        {activeAd.badge_text && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-400 mb-1.5">
            <Sparkles size={10} /> {activeAd.badge_text}
          </span>
        )}

        <h4 className="text-sm font-black text-white">{activeAd.title}</h4>
        {activeAd.tagline && (
          <p className="mt-0.5 text-[11px] font-semibold text-orange-400">{activeAd.tagline}</p>
        )}
        {activeAd.description && (
          <p className="mt-1 text-xs text-slate-300 line-clamp-2 leading-relaxed">
            {activeAd.description}
          </p>
        )}

        <div className="mt-3 pt-2.5 border-t border-surface-subtle flex items-center justify-between gap-2">
          <button
            onClick={() => handleDismiss(true)}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-200"
          >
            Dismiss
          </button>
          <button
            onClick={handleCtaClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-xs font-black text-white shadow-md shadow-orange-500/25 hover:scale-105 transition"
          >
            <span>{activeAd.cta_text || 'Claim Offer'}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // --- 3. CINEMATIC POPUP LIGHTBOX (DEFAULT) ---
  return (
    <>
      {/* Floating Re-open Pill when modal was dismissed */}
      {!isOpen && isDismissed && (
        <button
          onClick={() => setIsOpen(true)}
          title="Re-open special promotion"
          className="fixed bottom-14 right-5 z-40 group flex items-center gap-2 rounded-full border border-orange-500/40 bg-surface-card/90 px-3.5 py-2 text-xs font-bold text-orange-400 shadow-xl backdrop-blur-md hover:scale-105 hover:border-orange-400 transition cursor-pointer"
        >
          <Gift size={15} className="text-orange-500 group-hover:rotate-12 transition-transform" />
          <span className="text-[11px] font-mono tracking-wider text-slate-200 group-hover:text-white">
            {activeAd.badge_text || 'Special Offer'}
          </span>
        </button>
      )}

      {/* Main Lightbox Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeAd.title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-surface-subtle bg-surface-card p-6 sm:p-7 text-slate-100 shadow-2xl shadow-orange-950/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] animate-in zoom-in-95 duration-200"
          >
            {/* Top Close Button */}
            <button
              onClick={() => handleDismiss(false)}
              aria-label="Close advertisement"
              className="absolute top-4 right-4 z-10 rounded-full bg-surface-elevated/80 border border-white/10 p-2 text-slate-300 hover:text-white hover:bg-surface-elevated transition"
            >
              <X size={16} />
            </button>

            {/* Top Badge Pill */}
            {activeAd.badge_text && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400 shadow-2xs">
                  <Sparkles size={12} className="text-orange-400" />
                  {activeAd.badge_text}
                </span>
              </div>
            )}

            {/* Poster Image (if uploaded) */}
            {resolvedImageUrl && !imageFailed && (
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-4 border border-surface-subtle bg-slate-950 shadow-lg">
                <img
                  src={resolvedImageUrl}
                  alt={activeAd.title}
                  className="h-full w-full object-cover"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent opacity-50" />
              </div>
            )}

            {/* Headline & Tagline */}
            <h3 className="text-2xl font-black tracking-tight text-white leading-tight">
              {activeAd.title}
            </h3>
            {activeAd.tagline && (
              <p className="mt-1 text-sm font-bold text-orange-400">
                {activeAd.tagline}
              </p>
            )}

            {/* Description */}
            {activeAd.description && (
              <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {activeAd.description}
              </p>
            )}

            {/* Action Footer */}
            <div className="mt-6 pt-5 border-t border-surface-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDismiss(true)}
                className="text-xs font-bold text-slate-400 hover:text-slate-200 transition"
              >
                Don&apos;t show again today
              </button>

              <button
                type="button"
                onClick={handleCtaClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-orange-500/30 hover:scale-105 transition"
              >
                <span>{activeAd.cta_text || 'Claim Offer'}</span>
                {activeAd.cta_link?.startsWith('http') ? (
                  <ExternalLink size={15} />
                ) : (
                  <ArrowRight size={15} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

