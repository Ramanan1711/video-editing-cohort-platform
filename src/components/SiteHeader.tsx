import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Sparkles, X, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/Button';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { soundFx } from '../lib/soundFx';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(() => soundFx.isEnabled());
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

  const links = [
    { label: '15-Day Sprint', href: '#sprint' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Tracks', href: '#tracks' },
    { label: 'WhatsApp Mentorship', href: '#mentorship' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-subtle bg-surface-base/85 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex max-w-7xl h-18 items-center justify-between px-5 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/25 group-hover:scale-105 transition-transform">
            <Sparkles size={18} />
          </div>
          <div className="flex items-center gap-1 leading-none font-sans">
            <span className="text-xl font-black tracking-tight text-orange-500">
              Iunoware
            </span>
            {/* <span className="text-xl font-black tracking-tight text-white">
              Global
            </span> */}
          </div>
          <span className="hidden sm:inline-block rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-400">
            Academy
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-bold text-slate-300 hover:text-orange-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Action Controls */}
        <div className="hidden items-center gap-3 lg:flex">
          {/* Audio SFX Toggle */}
          <button
            type="button"
            onClick={handleToggleSfx}
            data-cursor={sfxEnabled ? 'MUTE SFX' : 'UNMUTE SFX'}
            className="group flex items-center gap-1.5 rounded-full border border-surface-subtle bg-surface-card px-2.5 py-1 text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:border-orange-500/40 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            title={sfxEnabled ? 'Mute procedural audio effects' : 'Enable procedural audio effects'}
            aria-label={sfxEnabled ? 'Audio effects enabled. Click to mute.' : 'Audio effects muted. Click to enable.'}
          >
            {sfxEnabled ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Volume2 size={13} className="text-orange-400 group-hover:scale-110 transition-transform" />
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
            className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white transition"
          >
            Sign in
          </Link>
          <Button href="/register" size="sm" className="shadow-lg shadow-orange-500/25 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-none text-white font-bold">
            <span>Join Next Cohort</span>
            <ArrowRight size={13} />
          </Button>
        </div>

        {/* Mobile Controls: SFX + Hamburger Toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={handleToggleSfx}
            className="flex items-center gap-1.5 rounded-full border border-surface-subtle bg-surface-card px-2.5 py-1 text-[10px] font-mono font-medium text-slate-300 hover:text-white hover:border-orange-500/40 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            title={sfxEnabled ? 'Mute audio' : 'Enable audio'}
            aria-label={sfxEnabled ? 'Mute audio' : 'Enable audio'}
          >
            {sfxEnabled ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Volume2 size={13} className="text-orange-400" />
                <span className="text-[9px] text-slate-200">SFX</span>
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
            className="rounded-xl p-2 text-slate-300 hover:bg-white/10"
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="mx-4 mb-4 rounded-2xl border border-surface-subtle bg-surface-card/95 p-5 shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl lg:hidden animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-surface-subtle flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Sign in
              </Link>
              <Button href="/register" withArrow className="w-full justify-center bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold">
                Join Next Cohort
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}