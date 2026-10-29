import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Package,
  Video,
  BookOpen,
  LayoutGrid,
  Moon,
  Sun,
  Sparkles,
  Menu,
  X,
  BarChart3,
  FileCheck2,
  GraduationCap,
  Home,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';
import { soundFx } from '../../lib/soundFx';
import { UserProfileDropdown } from '../UserProfileDropdown';
import { NotificationCenter } from '../NotificationCenter';
import { BRAND_LOGO_URL } from '../../constants/branding';

import { useModalScrollLock } from '../../hooks/useModalScrollLock';

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
  unreadMessagesCount = 0,
  unreadNotificationsCount: _unreadNotificationsCount = 0,
  onOpenLevelUpModal: _onOpenLevelUpModal,
  onOpenWorkshopsModal: _onOpenWorkshopsModal,
}) => {
  const { user, profile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [sfxEnabled, setSfxEnabled] = useState(() => soundFx.isEnabled());
  const location = useLocation();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);
  useModalScrollLock(navDrawerOpen);

  useEffect(() => {
    return soundFx.subscribe((enabled) => {
      setSfxEnabled(enabled);
    });
  }, []);

  const handleToggleSfx = () => {
    const next = soundFx.toggle();
    setSfxEnabled(next);
  };

  // Close App Launcher when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (launcherRef.current && !launcherRef.current.contains(event.target as Node)) {
        setShowAppLauncher(false);
      }
    }
    if (showAppLauncher) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAppLauncher]);

  // Close App Launcher on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowAppLauncher(false);
      }
    }
    if (showAppLauncher) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAppLauncher]);

  const isAdmin = profile?.role === 'admin';
  const isMentor = profile?.role === 'mentor';

  const launcherApps = [
    { to: '/student/dashboard', label: 'Student Portal', desc: 'Lectures & tasks', icon: Home },
    { to: '/community', label: 'Community Hub', desc: 'Discussions & chat', icon: Users },
    { to: '/workshops', label: 'Workshops', desc: 'Live sessions', icon: Video },
    { to: '/profile', label: 'My Profile', desc: 'Stats & badges', icon: User },
    ...(isAdmin || isMentor
      ? [
          { to: '/mentor', label: 'Mentor Hub', desc: 'Cohort overview', icon: Sparkles },
          { to: '/review/submissions', label: 'Review Queue', desc: 'Project critiques', icon: FileCheck2 },
          { to: '/mentor/students', label: 'Student Tracker', desc: 'Track progress', icon: GraduationCap },
        ]
      : []),
    ...(isAdmin
      ? [
          { to: '/admin', label: 'Admin Console', desc: 'Operations & stats', icon: BarChart3 },
          { to: '/admin/courses', label: 'Course Studio', desc: 'Curriculum manager', icon: BookOpen },
        ]
      : []),
    ...(isMentor
      ? [
          { to: '/mentor/courses', label: 'Course Studio', desc: 'Curriculum authoring', icon: BookOpen },
        ]
      : []),
  ];

  const workspaceLinks = isAdmin
    ? [
        { to: '/admin', label: 'Admin overview', icon: BarChart3, end: true },
        { to: '/admin/courses', label: 'Course studio', icon: BookOpen, end: false },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
        { to: '/mentor', label: 'Mentor workspace', icon: Sparkles, end: true },
        { to: '/review/submissions', label: 'Review queue', icon: FileCheck2, end: false },
        { to: '/mentor/students', label: 'Student progress', icon: GraduationCap, end: false },
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
        { to: '/profile', label: 'My profile', icon: User, end: false },
      ]
    : isMentor
    ? [
        { to: '/mentor', label: 'Mentor dashboard', icon: Sparkles, end: true },
        { to: '/mentor/courses', label: 'Course studio', icon: BookOpen, end: false },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
        { to: '/review/submissions', label: 'Review queue', icon: FileCheck2, end: false },
        { to: '/mentor/students', label: 'Student progress', icon: GraduationCap, end: false },
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
        { to: '/profile', label: 'My profile', icon: User, end: false },
      ]
    : [
        { to: '/student/dashboard', label: 'Student view', icon: Home, end: false },
        { to: '/community', label: 'Community hub', icon: Users, end: false },
        { to: '/profile', label: 'My profile', icon: User, end: false },
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
    },
    {
      id: 'workshops',
      label: 'Workshops',
      icon: Video,
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: BookOpen,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 transition-colors">
      <div className="flex h-14 sm:h-16 lg:h-[72px] w-full items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Left: Navigation Menu (☰) & Iunoware Academy Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setNavDrawerOpen(true)}
            aria-label="Open workspace navigation"
            title="Workspace Navigation"
            className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Menu className="size-4 sm:size-5" />
          </button>

          {/* Brand Logo - Iunoware Academy */}
          <Link
            to={profile?.role === 'admin' ? '/admin' : '/student/dashboard'}
            className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 group select-none"
            title="Iunoware Academy"
          >
            <img
              src={BRAND_LOGO_URL}
              alt="Iunoware Academy Logo"
              className="h-7 sm:h-8 lg:h-9 w-auto object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(249,115,22,0.25)] group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
              <span className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-orange-500 group-hover:text-orange-600 transition">
                Iunoware
              </span>
              <span className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-slate-900 dark:text-white transition hidden sm:inline">
                Academy
              </span>
            </div>
            <span className="sr-only">Iunoware Academy</span>
          </Link>
        </div>

        {/* Center: Segmented Navigation Pills (Adaptive: icon+label for active or all on lg+, icons on md) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 rounded-full border border-slate-200/70 bg-slate-50/80 p-1 lg:p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 shrink-0">
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
                title={item.label}
                aria-label={item.label}
                className={`relative flex items-center gap-1.5 xl:gap-2 rounded-full px-2.5 lg:px-3.5 xl:px-4 py-1.5 lg:py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-50 text-amber-950 shadow-xs border border-amber-200/80 font-black dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-amber-700 dark:text-amber-400 shrink-0' : 'shrink-0'} />
                <span className={`text-xs ${isActive ? 'inline' : 'hidden lg:inline'}`}>
                  {item.label}
                </span>

                {item.badge !== undefined && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* App Launcher Quick Switcher */}
          <div className="relative" ref={launcherRef}>
            <button
              type="button"
              onClick={() => setShowAppLauncher((prev) => !prev)}
              title="Quick App Launcher"
              aria-label="Quick App Launcher"
              aria-expanded={showAppLauncher}
              aria-haspopup="true"
              className={`rounded-full p-1.5 lg:p-2 transition cursor-pointer ${
                showAppLauncher
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 ring-2 ring-orange-400/40'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutGrid size={16} />
            </button>

            {showAppLauncher && (
              <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-72 sm:w-80 max-h-[calc(100vh-70px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1 dark:border-slate-800">
                  <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white">
                    Iunoware Apps
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {profile?.role || 'Student'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-2">
                  {launcherApps.map((app) => {
                    const Icon = app.icon;
                    const isCurrent = location.pathname === app.to;
                    return (
                      <Link
                        key={app.to}
                        to={app.to}
                        onClick={() => setShowAppLauncher(false)}
                        className={`flex items-start gap-2.5 rounded-xl p-2 transition ${
                          isCurrent
                            ? 'bg-orange-50 border border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            isCurrent
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight truncate">
                            {app.label}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate">
                            {app.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Sound Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleSfx}
            title={sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            aria-label={sfxEnabled ? 'Sound effects enabled. Click to mute.' : 'Sound effects muted. Click to enable.'}
            className="flex size-8 sm:size-9 items-center justify-center rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {sfxEnabled ? (
              <Volume2 className="size-4 sm:size-[18px] text-orange-500" />
            ) : (
              <VolumeX className="size-4 sm:size-[18px] text-slate-400" />
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
            className="flex size-8 sm:size-9 items-center justify-center rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {isDarkMode ? <Sun className="size-4 sm:size-[18px] text-amber-400" /> : <Moon className="size-4 sm:size-[18px]" />}
          </button>

          {/* Notifications Center */}
          {user && <NotificationCenter userId={user.id} />}

          {/* User Profile Avatar Dropdown */}
          <UserProfileDropdown />
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

            <aside className="fixed inset-y-0 left-0 z-[101] flex w-72 flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform animate-in slide-in-from-left duration-200 dark:border-slate-800 dark:bg-slate-950 overflow-y-auto max-h-screen">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={BRAND_LOGO_URL}
                      alt="Iunoware Academy"
                      className="h-8 w-auto object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(249,115,22,0.25)]"
                    />
                    <div>
                      <p className="text-sm font-black tracking-tight text-slate-950 dark:text-white">
                        Iunoware Academy
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

                {/* Community Sub-Views in Drawer for Mobile Access */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Community Sections
                  </p>
                  <div className="space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setNavDrawerOpen(false);
                            if (item.onClick) item.onClick();
                            else onTabChange(item.id);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                            isActive
                              ? 'bg-amber-50 text-amber-950 font-black dark:bg-amber-950/40 dark:text-amber-200'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} className={isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge !== undefined && (
                            <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </header>
  );
};

