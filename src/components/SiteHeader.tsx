import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/Button';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { soundFx } from '../lib/soundFx';
import { BRAND_LOGO_URL } from '../constants/branding';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(() => soundFx.isEnabled());
  const location = useLocation();
  const navigate = useNavigate();
  useModalScrollLock(open);

  useEffect(() => {
    return soundFx.subscribe((enabled) => {
      setSfxEnabled(enabled);
    });
  }, []);

  const handleToggleSfx = () => {
    const next = soundFx.toggle();
    setSfxEnabled(next);
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    if (open) setOpen(false);

    if (location.pathname === '/') {
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
    } else {
      navigate('/' + target);
    }
  };

  const links = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: '15-Day Sprint', href: '#sprint' },
    { label: 'Asset Vault', href: '#assets' },
    { label: 'WhatsApp Mentorship', href: '#mentorship' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-subtle bg-surface-base/85 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex max-w-7xl h-16 sm:h-18 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 group">
          <img
            src={BRAND_LOGO_URL}
            alt="Iunoware Academy Logo"
            className="h-8 sm:h-9 lg:h-10 w-auto object-contain drop-shadow-[0_2px_8px_rgba(185,43,39,0.28)] group-hover:scale-105 transition-transform"
          />
          <div className="flex items-center gap-1.5 leading-none font-sans">
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-[#F2B705] transition-colors">
              Iunoware
            </span>
            <span className="inline-block rounded-full bg-[#B92B27]/15 border border-[#B92B27]/30 px-1.5 sm:px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D93830]">
              Academy
            </span>
          </div>
        </Link>

        {/* Center Navigation Links (iPad Landscape & Desktop) */}
        <nav className="hidden items-center gap-2 lg:gap-3 xl:gap-6 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className="rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-[#F2B705] hover:bg-white/5 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Action Controls (Desktop / iPad Landscape) */}
        <div className="hidden items-center gap-2 sm:gap-3 lg:flex">
          {/* Audio SFX Toggle */}
          <button
            type="button"
            onClick={handleToggleSfx}
            data-cursor={sfxEnabled ? 'MUTE SFX' : 'UNMUTE SFX'}
            className="group flex items-center gap-1.5 rounded-full border border-surface-subtle bg-surface-card px-2.5 py-1 text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:border-[#F2B705]/40 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            title={sfxEnabled ? 'Mute procedural audio effects' : 'Enable procedural audio effects'}
            aria-label={sfxEnabled ? 'Audio effects enabled. Click to mute.' : 'Audio effects muted. Click to enable.'}
          >
            {sfxEnabled ? (
              <>
                <span className="size-1.5 rounded-full bg-[#38B44A] animate-pulse" />
                <Volume2 size={13} className="text-[#F2B705] group-hover:scale-110 transition-transform" />
                <span className="text-[10px] tracking-wider text-slate-200">SFX ON</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-slate-500" />
                <VolumeX size={13} className="text-slate-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] tracking-wider text-slate-400">SFX OFF</span>
              </>
            )}
          </button>

          <Link
            to="/login"
            className="px-3 sm:px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white transition"
          >
            Sign in
          </Link>
          <Button href="/register" size="sm" className="shadow-lg shadow-[#B92B27]/25 bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] border-none text-white font-bold px-3.5 sm:px-4 py-2">
            <span>Join Next Cohort</span>
            <ArrowRight size={13} />
          </Button>
        </div>

        {/* Mobile & iPad Portrait Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 lg:hidden">
          {/* Quick CTA button for iPad Portrait */}
          <Button
            href="/register"
            size="sm"
            className="hidden sm:inline-flex shadow-md shadow-[#B92B27]/25 bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] border-none text-white font-bold px-3 py-1.5"
          >
            <span>Join Cohort</span>
            <ArrowRight size={12} />
          </Button>

          <button
            type="button"
            onClick={handleToggleSfx}
            className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-surface-subtle bg-surface-card px-2 sm:px-2.5 py-1 text-[10px] font-mono font-medium text-slate-300 hover:text-white hover:border-[#F2B705]/40 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            title={sfxEnabled ? 'Mute audio' : 'Enable audio'}
            aria-label={sfxEnabled ? 'Mute audio' : 'Enable audio'}
          >
            {sfxEnabled ? (
              <>
                <span className="size-1.5 rounded-full bg-[#38B44A] animate-pulse" />
                <Volume2 size={13} className="text-[#F2B705]" />
                <span className="text-[9px] text-slate-200">SFX<span className="hidden sm:inline"> ON</span></span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-slate-500" />
                <VolumeX size={13} className="text-slate-400" />
                <span className="text-[9px] text-slate-400">MUTED</span>
              </>
            )}
          </button>

          <button
            onClick={() => setOpen(!open)}
            className="rounded-xl p-1.5 sm:p-2 text-slate-300 hover:bg-white/10 transition-colors"
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile & iPad Drawer */}
      {open && (
        <div className="mx-4 sm:mx-6 md:mx-auto md:max-w-2xl mb-4 rounded-2xl border border-surface-subtle bg-surface-card/95 p-4 sm:p-5 md:p-6 shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl lg:hidden animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-1.5 sm:gap-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-surface-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white text-center sm:text-left transition"
              >
                Sign in
              </Link>
              <Button href="/register" withArrow className="w-full sm:w-auto justify-center bg-gradient-to-r from-[#B92B27] via-[#D93830] to-[#F2B705] hover:from-[#D93830] hover:to-[#D99B02] text-white font-bold border-none shadow-lg shadow-[#B92B27]/25 px-5 py-2.5">
                Join Next Cohort
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}