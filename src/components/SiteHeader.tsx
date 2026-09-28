import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Sparkles, X, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: '15-Day Sprint', href: '#sprint' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Tracks', href: '#tracks' },
    { label: 'WhatsApp Mentorship', href: '#mentorship' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/90 transition-colors">
      <div className="mx-auto flex max-w-7xl h-18 items-center justify-between px-5 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Sparkles size={18} />
          </div>
          <div className="flex items-center gap-1 leading-none font-sans">
            <span className="text-xl font-black tracking-tight text-orange-600 dark:text-orange-500">
              ProCut
            </span>
            <span className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Hub
            </span>
          </div>
          <span className="hidden sm:inline-block rounded-full bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
            Sprint 2.0
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-bold text-slate-600 hover:text-orange-600 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Action Controls */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to="/login"
            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition"
          >
            Sign in
          </Link>
          <Button href="/register" size="sm" className="shadow-sm shadow-orange-500/20">
            <span>Join Next Cohort</span>
            <ArrowRight size={13} />
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="mx-4 mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl lg:hidden animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Sign in
              </Link>
              <Button href="/register" withArrow className="w-full justify-center">
                Join Next Cohort
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}