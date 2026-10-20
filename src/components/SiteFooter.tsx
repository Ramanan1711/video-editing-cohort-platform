import { Link } from 'react-router-dom';
import { Camera, Video, MessageCircle, Code2, Award } from 'lucide-react';
import { BRAND_LOGO_URL } from '../constants/branding';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#030712] text-slate-400 transition-colors">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <img
                src={BRAND_LOGO_URL}
                alt="Iunoware Academy Logo"
                className="h-8 w-auto object-contain drop-shadow-[0_2px_6px_rgba(185,43,39,0.25)]"
              />
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xl font-black tracking-tight text-white">
                  Iunoware
                </span>
                <span className="text-xl font-black tracking-tight text-[#D93830]">
                  Academy
                </span>
              </div>
            </Link>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              The premier 15-day intensive production internship platform for aspiring software developers and creative editors. Ship real production briefs, collaborate on WhatsApp, and earn verified credentials.
            </p>
            <div className="flex items-center gap-3 text-slate-400">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-[#2675EB] hover:border-[#2675EB]/40 transition"
              >
                <Code2 size={15} />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-[#D93830] hover:border-[#B92B27]/40 transition"
              >
                <Video size={15} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-[#F2B705] hover:border-[#F2B705]/40 transition"
              >
                <Camera size={15} />
              </a>
              <a
                href="#mentorship"
                aria-label="WhatsApp Mentorship"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-[#38B44A] hover:border-[#38B44A]/40 transition"
              >
                <MessageCircle size={15} />
              </a>
            </div>
          </div>

          {/* Column 1: Sprint Tracks */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-white">
              Sprint Tracks
            </p>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li>
                <a href="#tracks" className="hover:text-[#F2B705] transition">Coding &amp; Full Stack Track</a>
              </li>
              <li>
                <a href="#tracks" className="hover:text-[#F2B705] transition">Video Editing &amp; Kinetic Cuts</a>
              </li>
              <li>
                <a href="#sprint" className="hover:text-[#F2B705] transition">15-Day Daily Challenges</a>
              </li>
              <li>
                <a href="#tracks" className="hover:text-[#F2B705] transition">Sound Design &amp; Retention</a>
              </li>
            </ul>
          </div>

          {/* Column 2: Platform Experience */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-white">
              Platform
            </p>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li>
                <Link to="/workshops" className="hover:text-[#F2B705] transition">Live Masterclasses</Link>
              </li>
              <li>
                <a href="#mentorship" className="hover:text-[#F2B705] transition">WhatsApp Mentor Co-pilot</a>
              </li>
              <li>
                <Link to="/community" className="hover:text-[#F2B705] transition">Community Hub &amp; Feed</Link>
              </li>
              <li>
                <a href="#sprint" className="hover:text-[#F2B705] transition">Verified Credentials</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust & Accreditation */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-white">
              Certification
            </p>
            <div className="rounded-xl border border-[#B92B27]/30 bg-gradient-to-br from-[#B92B27]/10 to-[#F2B705]/5 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D93830]">
                <Award size={14} className="text-[#F2B705]" />
                <span>Accredited Completion</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Every graduate receives a cryptographic digital credential and a personalized Mentor Recommendation Letter.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 Iunoware Academy. All rights reserved. Designed for serious craft and rapid momentum.</p>
          <div className="flex items-center gap-6">
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="mailto:support@iunoware.com" className="hover:text-white transition">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}