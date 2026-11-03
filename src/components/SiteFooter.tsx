import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { BRAND_LOGO_URL } from '../constants/branding';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#030712] text-slate-400 transition-colors">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand Info */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-2 space-y-4">
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
              The premier mentor-led cohort learning platform for ambitious developers, designers, and creators. Ship real industry briefs, collaborate on WhatsApp, and earn accredited credentials.
            </p>
            <ul className="mt-8 flex justify-start items-center gap-6">
              <li>
                <a
                  href="https://www.linkedin.com/company/iunoware-private-limited/posts/?feedView=all"
                  rel="noreferrer"
                  target="_blank"
                  className="text-white flex transition-all duration-300 hover:-translate-y-1"
                >
                  <span className="sr-only">Linked In</span>
                  <svg width="35px" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#ffffff">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <rect width="132" height="132" x="30" y="30" stroke="#ffffff" strokeWidth="12" rx="16"></rect>
                      <path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12" d="M66 86v44"></path>
                      <circle cx="66" cy="64" r="8" fill="#ffffff"></circle>
                      <path stroke="#ffffff" strokeLinecap="round" strokeWidth="12" d="M126 130v-26c0-9.941-8.059-18-18-18v0c-9.941 0-18 8.059-18 18v26"></path>
                    </g>
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/iunoware?igsh=YmlycTZ5bWZwMDF4"
                  rel="noreferrer"
                  target="_blank"
                  className="text-white flex transition-all duration-300 hover:-translate-y-1"
                >
                  <span className="sr-only">Instagram</span>
                  <svg className="size-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/profile.php?id=61569943926291"
                  rel="noreferrer"
                  target="_blank"
                  className="text-white flex transition-all duration-300 hover:-translate-y-1"
                >
                  <span className="sr-only">Facebook</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="29"
                    height="29"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-facebook"
                    aria-hidden="true"
                  >
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/916381268955"
                  rel="noreferrer"
                  target="_blank"
                  className="text-white flex transition-all duration-300 hover:-translate-y-1"
                >
                  <span className="sr-only">whatsapp</span>
                  <svg
                    width="29px"
                    xmlns="http://www.w3.org/2000/svg"
                    shapeRendering="geometricPrecision"
                    textRendering="geometricPrecision"
                    imageRendering="optimizeQuality"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    viewBox="0 0 510 512.459"
                  >
                    <path
                      fill="#ffffff"
                      d="M435.689 74.468C387.754 26.471 324 .025 256.071 0 116.098 0 2.18 113.906 2.131 253.916c-.024 44.758 11.677 88.445 33.898 126.946L0 512.459l134.617-35.311c37.087 20.238 78.85 30.891 121.345 30.903h.109c139.949 0 253.88-113.917 253.928-253.928.024-67.855-26.361-131.645-74.31-179.643v-.012zm-179.618 390.7h-.085c-37.868-.011-75.016-10.192-107.428-29.417l-7.707-4.577-79.886 20.953 21.32-77.889-5.017-7.987c-21.125-33.605-32.29-72.447-32.266-112.322.049-116.366 94.729-211.046 211.155-211.046 56.373.025 109.364 22.003 149.214 61.903 39.853 39.888 61.781 92.927 61.757 149.313-.05 116.377-94.728 211.058-211.057 211.058v.011zm115.768-158.067c-6.344-3.178-37.537-18.52-43.358-20.639-5.82-2.119-10.044-3.177-14.27 3.178-4.225 6.357-16.388 20.651-20.09 24.875-3.702 4.238-7.403 4.762-13.747 1.583-6.343-3.178-26.787-9.874-51.029-31.487-18.86-16.827-31.597-37.598-35.297-43.955-3.702-6.355-.39-9.789 2.775-12.943 2.849-2.848 6.344-7.414 9.522-11.116s4.225-6.355 6.343-10.581c2.12-4.238 1.06-7.937-.522-11.117-1.584-3.177-14.271-34.409-19.568-47.108-5.151-12.37-10.385-10.69-14.269-10.897-3.703-.183-7.927-.219-12.164-.219s-11.105 1.582-16.925 7.939c-5.82 6.354-22.209 21.709-22.209 52.927 0 31.22 22.733 61.405 25.911 65.642 3.177 4.237 44.745 68.318 108.389 95.812 15.135 6.538 26.957 10.446 36.175 13.368 15.196 4.834 29.027 4.153 39.96 2.52 12.19-1.825 37.54-15.353 42.824-30.172 5.283-14.818 5.283-27.529 3.701-30.172-1.582-2.641-5.819-4.237-12.163-7.414l.011-.024z"
                    ></path>
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 1: Sprint Tracks */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-white">
              Sprint Curriculum
            </p>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li>
                <a href="#sprint" className="hover:text-[#F2B705] transition">Commercial Video Editing</a>
              </li>
              <li>
                <a href="#sprint" className="hover:text-[#F2B705] transition">Kinetic Typography &amp; Motion</a>
              </li>
              <li>
                <a href="#sprint" className="hover:text-[#F2B705] transition">Sound Design &amp; Color Grading</a>
              </li>
              <li>
                <a href="#assets" className="hover:text-[#F2B705] transition">Production Asset Vault</a>
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