import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const links = [
    { label: 'Roadmap', href: '#roadmap' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const dashboardUrl =
    profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'mentor'
      ? '/mentor'
      : '/student/dashboard';

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-slate-950 dark:text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-orange-500">
            <Sparkles size={18} />
          </span>
          <span className="text-sm font-black tracking-tight">CUT / CRAFT</span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              className="text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>

          {user ? (
            <>
              <Link
                to={dashboardUrl}
                className="px-3.5 py-2 text-sm font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              >
                Dashboard
              </Link>
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-rose-600 shadow-2xs hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition"
                title="Sign out"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              >
                Log in
              </Link>
              <Button href="/register" withArrow>
                Join the cohort
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <nav className="grid gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                href={link.href}
              >
                {link.label}
              </a>
            ))}

            {user ? (
              <>
                <Link
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  to={dashboardUrl}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  to="/login"
                >
                  Log in
                </Link>
                <div className="pt-2">
                  <Button href="/register" withArrow className="w-full">
                    Join the cohort
                  </Button>
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}