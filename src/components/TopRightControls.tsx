import { Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';

interface TopRightControlsProps {
  className?: string;
  showSignOutLabel?: boolean;
}

export function TopRightControls({
  className = '',
  showSignOutLabel = true,
}: TopRightControlsProps) {
  const { signOut, user, profile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle dark mode"
        className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition"
      >
        {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
      </button>

      {/* Sign Out Button */}
      {(user || profile) && (
        <button
          onClick={() => void signOut()}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-rose-600 shadow-2xs hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
          {showSignOutLabel && <span className="hidden sm:inline">Sign out</span>}
        </button>
      )}
    </div>
  );
}

