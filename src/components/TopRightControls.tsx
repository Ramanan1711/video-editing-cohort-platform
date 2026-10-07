import React, { useEffect, useState } from 'react';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { useAuth } from '../context/useAuth';
import { UserProfileDropdown } from './UserProfileDropdown';
import { NotificationCenter } from './NotificationCenter';
import { soundFx } from '../lib/soundFx';

interface TopRightControlsProps {
  showThemeToggle?: boolean;
  showSfxToggle?: boolean;
}

export const TopRightControls: React.FC<TopRightControlsProps> = ({
  showThemeToggle = true,
  showSfxToggle = true,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [sfxEnabled, setSfxEnabled] = useState(() => soundFx.isEnabled());

  useEffect(() => {
    return soundFx.subscribe((enabled) => {
      setSfxEnabled(enabled);
    });
  }, []);

  const handleToggleSfx = () => {
    const next = soundFx.toggle();
    setSfxEnabled(next);
  };

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {user && <NotificationCenter userId={user.id} />}
      {showSfxToggle && (
        <button
          type="button"
          onClick={handleToggleSfx}
          title={sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          aria-label={sfxEnabled ? 'Sound effects enabled. Click to mute.' : 'Sound effects muted. Click to enable.'}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {sfxEnabled ? (
            <Volume2 size={18} className="text-orange-500" />
          ) : (
            <VolumeX size={18} className="text-slate-400" />
          )}
        </button>
      )}
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

