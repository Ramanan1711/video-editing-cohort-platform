import React from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

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
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
    document.documentElement.classList.toggle('dark');
  };

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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white font-black text-base shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              PRO
            </span>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-black tracking-widest text-slate-900 uppercase dark:text-white">
                Pro Editors Club
              </span>
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                Cohort Workspace
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
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
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
    </header>
  );
};
