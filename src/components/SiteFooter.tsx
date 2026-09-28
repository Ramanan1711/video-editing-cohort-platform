import { Link } from 'react-router-dom';
import { Camera, Video, Sparkles, MessageCircle, Code2, Award } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm">
                <Sparkles size={16} />
              </div>
              <div className="flex items-center gap-1 leading-none">
                <span className="text-lg font-black tracking-tight text-orange-600 dark:text-orange-500">
                  ProCut
                </span>
                <span className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                  Hub
                </span>
              </div>
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              The premier 15-day intensive production internship platform for aspiring software developers and creative editors. Ship real production briefs, collaborate on WhatsApp, and earn verified credentials.
            </p>
            <div className="flex items-center gap-3 text-slate-400">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-orange-600 transition"
              >
                <Code2 size={15} />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-orange-600 transition"
              >
                <Video size={15} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-orange-600 transition"
              >
                <Camera size={15} />
              </a>
              <a
                href="#mentorship"
                aria-label="WhatsApp Mentorship"
                className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition"
              >
                <MessageCircle size={15} />
              </a>
            </div>
          </div>

          {/* Column 1: Sprint Tracks */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-950 dark:text-white">
              Sprint Tracks
            </p>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <li>
                <a href="#tracks" className="hover:text-orange-600 transition">Coding &amp; Full Stack Track</a>
              </li>
              <li>
                <a href="#tracks" className="hover:text-orange-600 transition">Video Editing &amp; Kinetic Cuts</a>
              </li>
              <li>
                <a href="#sprint" className="hover:text-orange-600 transition">15-Day Daily Challenges</a>
              </li>
              <li>
                <a href="#tracks" className="hover:text-orange-600 transition">Sound Design &amp; Retention</a>
              </li>
            </ul>
          </div>

          {/* Column 2: Platform Experience */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-950 dark:text-white">
              Platform
            </p>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <li>
                <Link to="/workshops" className="hover:text-orange-600 transition">Live Masterclasses</Link>
              </li>
              <li>
                <a href="#mentorship" className="hover:text-orange-600 transition">WhatsApp Mentor Co-pilot</a>
              </li>
              <li>
                <Link to="/community" className="hover:text-orange-600 transition">Community Hub &amp; Feed</Link>
              </li>
              <li>
                <a href="#sprint" className="hover:text-orange-600 transition">Verified Credentials</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust & Accreditation */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-950 dark:text-white">
              Certification
            </p>
            <div className="rounded-xl border border-orange-200/80 dark:border-orange-950/60 bg-orange-50/50 dark:bg-orange-950/20 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-900 dark:text-orange-300">
                <Award size={14} className="text-orange-600" />
                <span>Accredited Completion</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Every graduate receives a cryptographic digital credential and a personalized Mentor Recommendation Letter.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 ProCut Hub. All rights reserved. Designed for serious craft and rapid momentum.</p>
          <div className="flex items-center gap-6">
            <a href="#faq" className="hover:text-slate-700 dark:hover:text-slate-300">FAQ</a>
            <a href="#pricing" className="hover:text-slate-700 dark:hover:text-slate-300">Pricing</a>
            <a href="mailto:support@procuthub.com" className="hover:text-slate-700 dark:hover:text-slate-300">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}