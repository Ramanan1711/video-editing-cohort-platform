import React, { useEffect, useState } from 'react';
import { soundFx } from '../../lib/soundFx';

export const StudioBar: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [soundOn, setSoundOn] = useState<boolean>(false);

  useEffect(() => {
    setSoundOn(soundFx.isEnabled());

    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSoundToggle = () => {
    const newState = soundFx.toggle();
    setSoundOn(newState);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-6 right-8 z-40 hidden md:flex items-center justify-between font-mono text-[11px] tracking-wider text-slate-400 select-none">
      {/* Left: Copyright */}
      <div className="pointer-events-auto flex items-center gap-4">
        <span className="text-slate-300 font-mono font-medium">©2026</span>
        <div className="flex items-center gap-1.5 text-emerald-400 border-l border-white/15 pl-4">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-bold text-slate-300">BATCH 15 LIVE</span>
        </div>
      </div>

      {/* Middle: UTC Studio Time */}
      <div className="pointer-events-auto flex items-center gap-2 text-slate-300 font-mono">
        <span className="text-slate-400">(UTC+1)</span>
        <span className="font-semibold text-slate-200">{timeStr || '11:31:42 AM'}</span>
      </div>

      {/* Right: Junca Turbine Sound Toggle */}
      <button
        type="button"
        onClick={handleSoundToggle}
        data-cursor={soundOn ? 'MUTE SOUND' : 'ENABLE SOUND'}
        className="pointer-events-auto flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors cursor-pointer group"
        aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          className={`transition-transform duration-500 ${soundOn ? 'animate-spin text-orange-400' : 'text-slate-400 group-hover:text-white'}`}
          fill="currentColor"
        >
          <g>
            <path d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z" />
            <path
              d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z"
              transform="rotate(120 12 12)"
            />
            <path
              d="M12 12 C 13.6 8.6, 13.2 4.6, 10.1 2.5 C 15.6 2, 19.3 6.4, 18.7 10.6 C 16.6 11.7, 14.2 12.1, 12 12 Z"
              transform="rotate(240 12 12)"
            />
            <circle cx="12" cy="12" r="2.1" />
          </g>
        </svg>

        <span className="font-mono text-xs font-semibold tracking-wider">
          {soundOn ? 'Sound: On' : 'Sound'}
        </span>
      </button>
    </div>
  );
};
