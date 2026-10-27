import React, { useRef, useEffect } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  id?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
  error = false,
  id = 'otp-input',
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split string into array of characters, padded to length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const updateDigit = (index: number, digit: string) => {
    const chars = Array.from({ length }, (_, i) => value[i] || '');
    chars[index] = digit;
    const newVal = chars.join('').slice(0, length);
    onChange(newVal);

    if (newVal.length === length && onComplete) {
      onComplete(newVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        // Clear current box
        updateDigit(index, '');
      } else if (index > 0) {
        // Clear previous box and jump focus
        updateDigit(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }

    // Direct single digit entry via onKeyDown
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      updateDigit(index, e.key);
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      updateDigit(index, '');
      return;
    }
    const lastChar = val.slice(-1);
    updateDigit(index, lastChar);
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;

    const raw = e.clipboardData.getData('text');
    const clean = raw.replace(/\D/g, '').slice(0, length);
    if (!clean) return;

    onChange(clean);

    const nextIndex = Math.min(clean.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    if (clean.length === length && onComplete) {
      onComplete(clean);
    }
  };

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      id={id}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {Array.from({ length }).map((_, index) => {
        const isMiddle = length === 6 && index === 3;
        const digit = digits[index];
        const isFilled = Boolean(digit);

        return (
          <React.Fragment key={index}>
            {isMiddle && (
              <span className="text-slate-600 font-bold select-none text-lg">
                •
              </span>
            )}
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete="one-time-code"
              aria-label={`Digit ${index + 1} of ${length}`}
              disabled={disabled}
              value={digit}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={`size-12 sm:size-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-2xl border transition-all outline-hidden shadow-inner ${
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-slate-900 border-white/5 text-slate-500'
                  : error
                  ? 'border-red-500/80 bg-red-500/10 text-red-200 ring-2 ring-red-500/30'
                  : isFilled
                  ? 'border-orange-500/60 bg-orange-500/10 text-white shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30'
                  : 'border-white/10 bg-[#060913]/90 text-white hover:border-white/20 focus:border-orange-500 focus:bg-orange-500/5 focus:ring-4 focus:ring-orange-500/20'
              }`}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
