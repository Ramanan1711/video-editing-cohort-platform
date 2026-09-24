import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Sparkles, Users, LogOut } from 'lucide-react';
import { useAuth } from '../context/useAuth';

export const UserProfileDropdown: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileMenu]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowProfileMenu((prev) => !prev)}
        className="flex items-center gap-2 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label="User Profile Menu"
        title={profile?.full_name || 'User Profile'}
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
            {profile?.role === 'mentor' && (
              <Link
                to="/mentor"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              >
                <Sparkles size={14} /> Mentor Command Center
              </Link>
            )}
            <Link
              to="/community"
              onClick={() => setShowProfileMenu(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Users size={14} /> Community Hub
            </Link>
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
  );
};

