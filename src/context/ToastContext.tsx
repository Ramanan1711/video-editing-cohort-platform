import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext, type ToastItem } from './toastContextValue';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, message, title, durationMs }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = durationMs ?? (type === 'error' ? 6000 : 4000);

      setToasts((prev) => [...prev, { id, type, message, title, durationMs: duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => showToast({ type: 'success', message, title }),
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => showToast({ type: 'error', message, title }),
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => showToast({ type: 'warning', message, title }),
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) => showToast({ type: 'info', message, title }),
    [showToast]
  );

  const value = useMemo(
    () => ({ showToast, success, error, warning, info, removeToast }),
    [showToast, success, error, warning, info, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Floating Toast Viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2.5 px-4 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-4 sm:slide-in-from-right-4 ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-white/95 text-slate-900 shadow-emerald-500/10'
                : toast.type === 'error'
                ? 'border-rose-200 bg-white/95 text-slate-900 shadow-rose-500/10'
                : toast.type === 'warning'
                ? 'border-amber-200 bg-white/95 text-slate-900 shadow-amber-500/10'
                : 'border-blue-200 bg-white/95 text-slate-900 shadow-blue-500/10'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && (
                <div className="flex size-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={16} />
                </div>
              )}
              {toast.type === 'error' && (
                <div className="flex size-7 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertCircle size={16} />
                </div>
              )}
              {toast.type === 'warning' && (
                <div className="flex size-7 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <AlertTriangle size={16} />
                </div>
              )}
              {toast.type === 'info' && (
                <div className="flex size-7 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Info size={16} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1 text-left">
              {toast.title && (
                <h4 className="text-xs font-black tracking-tight text-slate-950">
                  {toast.title}
                </h4>
              )}
              <p
                className={`text-xs leading-relaxed text-slate-600 ${
                  toast.title ? 'mt-0.5' : 'mt-1'
                }`}
              >
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Dismiss toast"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
