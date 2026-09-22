import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { UserProfileDropdown } from './UserProfileDropdown';

interface TopRightControlsProps {
  showThemeToggle?: boolean;
}

export const TopRightControls: React.FC<TopRightControlsProps> = ({
  showThemeToggle = true,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {showThemeToggle && (
        <button
          onClick={toggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle dark mode"
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
        >
          {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>
      )}
      <UserProfileDropdown />
    </div>
  );
};

