import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
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
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-40 hidden md:flex items-center justify-between font-mono text-[11px] tracking-wider text-slate-400 select-none">
      {/* Left Studio Telemetry */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#030712]/80 px-4 py-2 backdrop-blur-xl shadow-2xl transition hover:border-white/20">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-bold text-slate-200">BATCH 15 LIVE</span>
        </div>
        <span className="text-white/20">•</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Radio size={12} className="text-orange-400" />
          <span>STUDIO TIME {timeStr}</span>
        </div>
        <span className="text-white/20 hidden lg:inline">•</span>
        <span className="text-slate-400 hidden lg:inline">24/30 CANDIDATES</span>
      </div>

      {/* Right Sound Synthesizer Controller */}
      <button
        type="button"
        onClick={handleSoundToggle}
        data-cursor={soundOn ? 'MUTE SOUND' : 'ENABLE SOUND'}
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-xl shadow-2xl transition cursor-pointer ${
          soundOn
            ? 'border-orange-500/40 bg-orange-500/10 text-orange-400 shadow-orange-500/10'
            : 'border-white/10 bg-[#030712]/80 text-slate-400 hover:text-white hover:border-white/25'
        }`}
        aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
      >
        {/* Animated Equalizer Wave Bars */}
        <div className="flex items-end gap-0.5 h-3">
          <span
            className={`w-0.5 rounded-full bg-current transition-all ${
              soundOn ? 'h-3 animate-pulse' : 'h-1'
            }`}
          />
          <span
            className={`w-0.5 rounded-full bg-current transition-all ${
              soundOn ? 'h-2 animate-bounce' : 'h-1'
            }`}
          />
          <span
            className={`w-0.5 rounded-full bg-current transition-all ${
              soundOn ? 'h-3.5 animate-pulse' : 'h-1'
            }`}
          />
        </div>

        <span className="font-bold uppercase tracking-widest text-[10px]">
          {soundOn ? 'SOUND: ON' : 'SOUND: OFF'}
        </span>

        {soundOn ? (
          <Volume2 size={13} className="text-orange-400" />
        ) : (
          <VolumeX size={13} className="text-slate-500" />
        )}
      </button>
    </div>
  );
};
