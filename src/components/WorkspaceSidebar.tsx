import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';

export function WorkspaceSidebar() {
  const { profile, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isAdmin = profile?.role === 'admin';
  const isMentor = profile?.role === 'mentor';

  const visibleLinks = isAdmin
    ? [
        { to: '/admin', label: 'Admin overview', icon: BarChart3, end: true },
        { to: '/admin/courses', label: 'Course studio', icon: BookOpen, end: false },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
        { to: '/mentor', label: 'Mentor workspace', icon: Sparkles, end: true },
        { to: '/review/submissions', label: 'Review queue', icon: FileCheck2, end: false },
        { to: '/mentor/students', label: 'Student progress', icon: GraduationCap, end: false },
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
      ]
    : isMentor
    ? [
        { to: '/mentor', label: 'Mentor dashboard', icon: Sparkles, end: true },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
        { to: '/review/submissions', label: 'Review queue', icon: FileCheck2, end: false },
        { to: '/mentor/students', label: 'Student progress', icon: GraduationCap, end: false },
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
      ]
    : [
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
      ];

  const navigation = (
    <nav className="space-y-1">
      {visibleLinks.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
              isActive
                ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
            } ${collapsed ? 'justify-center' : ''}`
          }
          title={collapsed ? label : undefined}
        >
          <Icon size={19} className="shrink-0" />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 lg:hidden"
        aria-label="Open workspace navigation"
      >
        <Menu size={19} />
      </button>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close workspace navigation"
        />
      )}

      <aside
        className={`${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 lg:shadow-none ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-orange-500">
              <CalendarDays size={18} />
            </span>
            {!collapsed && (
              <div>
                <p className="text-sm font-black tracking-tight text-slate-950 dark:text-white">CUT / CRAFT</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Workspace</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {!collapsed && (
          <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Navigate</p>
        )}

        <div className="overflow-y-auto pb-28 max-h-[calc(100vh-180px)]">
          {navigation}
        </div>

        {/* Footer controls: Dark mode, Sign out & Collapse */}
        <div className="absolute bottom-4 inset-x-3 border-t border-slate-100 pt-3 dark:border-slate-800/80 space-y-1">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle color theme"
              >
                {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
              </button>
              <button
                onClick={() => void signOut()}
                className="flex items-center justify-center rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={17} />
              </button>
              <button
                onClick={() => setCollapsed(false)}
                className="hidden items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-slate-100 lg:flex"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition"
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle color theme"
                >
                  {isDarkMode ? <Sun size={17} className="text-amber-400 shrink-0" /> : <Moon size={17} className="shrink-0" />}
                  <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
                </button>

                <button
                  onClick={() => setCollapsed(true)}
                  className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-slate-100 lg:block"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={17} />
                </button>
              </div>

              <button
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={17} className="shrink-0" />
                <span>Sign out</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
