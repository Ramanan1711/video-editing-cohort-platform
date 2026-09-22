import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Package,
  Video,
  BookOpen,
  LayoutGrid,
  Moon,
  Sun,
  Bell,
  Sparkles,
  LogOut,
  User,
  Menu,
  X,
  BarChart3,
  CalendarDays,
  FileCheck2,
  GraduationCap,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';

export type TopNavTab = 'community' | 'messages' | 'levelup' | 'workshops' | 'courses';

interface CommunityTopNavProps {
  activeTab: TopNavTab;
  onTabChange: (tab: TopNavTab) => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  onOpenLevelUpModal?: () => void;
  onOpenWorkshopsModal?: () => void;
}

export const CommunityTopNav: React.FC<CommunityTopNavProps> = ({
  activeTab,
  onTabChange,
  unreadMessagesCount = 2,
  unreadNotificationsCount = 10,
  onOpenLevelUpModal,
  onOpenWorkshopsModal,
}) => {
  const { profile, user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  useEffect(() => {
    if (navDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [navDrawerOpen]);

  const isAdmin = profile?.role === 'admin';
  const isMentor = profile?.role === 'mentor';

  const workspaceLinks = isAdmin
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

  const navItems: {
    id: TopNavTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
    onClick?: () => void;
  }[] = [
    {
      id: 'community',
      label: 'Community',
      icon: Users,
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      id: 'levelup',
      label: 'Level Up',
      icon: Package,
      onClick: onOpenLevelUpModal,
    },
    {
      id: 'workshops',
      label: 'Workshops',
      icon: Video,
      onClick: onOpenWorkshopsModal,
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: BookOpen,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Navigation Menu (Three minus symbols: ☰) & CUT / CRAFT Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavDrawerOpen(true)}
            aria-label="Open workspace navigation"
            title="Workspace Navigation"
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Menu size={20} />
          </button>

          {/* CUT / CRAFT Brand Logo */}
          <Link
            to={profile?.role === 'admin' ? '/admin' : '/student/dashboard'}
            className="flex items-center gap-2.5 group"
            title="CUT / CRAFT Workspace"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white font-black text-sm shadow-md group-hover:scale-105 transition-transform dark:bg-orange-500">
              <Sparkles size={18} className="text-orange-500 dark:text-white" />
            </span>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-black tracking-tight text-slate-950 dark:text-white">
                CUT / CRAFT
              </span>
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                Community Hub
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Segmented Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50/80 p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    onTabChange(item.id);
                  }
                }}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-50 text-amber-950 shadow-xs border border-amber-200/80 font-black dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-amber-700 dark:text-amber-400' : ''} />
                <span>{item.label}</span>

                {item.badge !== undefined && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            title="App Launcher"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 transition"
          >
            <LayoutGrid size={16} />
          </button>
        </nav>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>

          {/* Notifications Bell */}
          <button
            title="Notifications"
            className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            <Bell size={18} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900">
                {unreadNotificationsCount > 9 ? '10' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-xs shadow-sm ring-2 ring-orange-200 dark:ring-slate-800">
                {profile?.full_name?.slice(0, 2).toUpperCase() || 'PE'}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {profile?.full_name || user?.email || 'Student'}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {profile?.role || 'student'}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    to="/student/dashboard"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <User size={14} /> My Courses
                  </Link>
                  {profile?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      <Sparkles size={14} /> Admin Control Room
                    </Link>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Workspace Navigation Drawer (Portaled to document.body to prevent stacking context or containing block overlap) */}
      {navDrawerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in z-[100]"
              onClick={() => setNavDrawerOpen(false)}
              aria-label="Close navigation"
            />

            <aside className="fixed inset-y-0 left-0 z-[101] flex w-72 flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform animate-in slide-in-from-left duration-200 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-orange-500">
                      <CalendarDays size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-black tracking-tight text-slate-950 dark:text-white">
                        CUT / CRAFT
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Workspace
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNavDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                    aria-label="Close navigation"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Navigate
                </p>

                <nav className="space-y-1">
                  {workspaceLinks.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setNavDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                          isActive
                            ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                        }`
                      }
                    >
                      <Icon size={19} className="shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>

              {/* Drawer Footer: Theme Toggle & Sign out */}
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800/80 space-y-2">
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition"
                >
                  {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
                  <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
                </button>

                <button
                  onClick={() => {
                    setNavDrawerOpen(false);
                    void signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </header>
  );
};

