// src/components/ui/StateFallback.tsx
import React from 'react';
import {
  WifiOff,
  ShieldAlert,
  Database,
  LogIn,
  Inbox,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppError } from '../../lib/errorHandling';

export type FallbackType =
  | 'network'
  | 'permission'
  | 'migration'
  | 'stale-auth'
  | 'empty'
  | 'error';

export interface StateFallbackProps {
  type?: FallbackType;
  appError?: AppError | null;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const StateFallback: React.FC<StateFallbackProps> = ({
  type,
  appError,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  const navigate = useNavigate();

  // Infer type from AppError if not explicitly provided
  const resolvedType: FallbackType =
    type ??
    (appError?.code === 'NETWORK_ERROR'
      ? 'network'
      : appError?.code === 'PERMISSION_DENIED'
      ? 'permission'
      : appError?.code === 'MIGRATION_MISSING'
      ? 'migration'
      : appError?.code === 'STALE_AUTH'
      ? 'stale-auth'
      : 'error');

  const resolvedTitle =
    title || appError?.title || (
      resolvedType === 'network'
        ? 'Connection Lost'
        : resolvedType === 'permission'
        ? 'Access Restricted'
        : resolvedType === 'migration'
        ? 'Database Schema Update Required'
        : resolvedType === 'stale-auth'
        ? 'Session Expired'
        : resolvedType === 'empty'
        ? 'No Data Found'
        : 'Something Went Wrong'
    );

  const resolvedDescription =
    description || appError?.message || (
      resolvedType === 'network'
        ? 'Unable to communicate with the server. Please verify your internet connection.'
        : resolvedType === 'permission'
        ? 'You do not hold the required authorizations to access this section.'
        : resolvedType === 'migration'
        ? 'A required database schema or function has not been applied yet.'
        : resolvedType === 'stale-auth'
        ? 'Your login session has expired. Please sign in again to continue.'
        : resolvedType === 'empty'
        ? 'There are currently no records to display in this view.'
        : 'An unexpected application condition was encountered.'
    );

  const renderIcon = () => {
    switch (resolvedType) {
      case 'network':
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <WifiOff size={28} />
          </div>
        );
      case 'permission':
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            <ShieldAlert size={28} />
          </div>
        );
      case 'migration':
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-200">
            <Database size={28} />
          </div>
        );
      case 'stale-auth':
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-200">
            <LogIn size={28} />
          </div>
        );
      case 'empty':
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200">
            <Inbox size={28} />
          </div>
        );
      default:
        return (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            <AlertCircle size={28} />
          </div>
        );
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm sm:p-12 ${className}`}
    >
      <div className="mb-4">{renderIcon()}</div>

      <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
        {resolvedTitle}
      </h3>

      <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-600 leading-relaxed">
        {resolvedDescription}
      </p>

      {appError?.actionHint && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/60 px-3.5 py-2 text-[11px] text-slate-500 font-medium">
          💡 {appError.actionHint}
        </div>
      )}

      {appError?.rawMessage && resolvedType === 'migration' && (
        <div className="mt-3 max-w-lg overflow-x-auto rounded-xl bg-slate-900 px-4 py-2.5 text-left font-mono text-[11px] text-slate-200 shadow-inner">
          <p className="text-orange-400 text-[10px] uppercase font-bold mb-1">Database Error Code: {appError.postgresCode || '42P01'}</p>
          <code>{appError.rawMessage}</code>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {/* Primary Action Button */}
        {resolvedType === 'network' && (
          <button
            type="button"
            onClick={onAction || (() => window.location.reload())}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
          >
            <RefreshCw size={14} />
            {actionText || 'Retry Connection'}
          </button>
        )}

        {resolvedType === 'stale-auth' && (
          <button
            type="button"
            onClick={onAction || (() => navigate('/login'))}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
          >
            <LogIn size={14} />
            {actionText || 'Sign In Again'}
          </button>
        )}

        {resolvedType === 'permission' && (
          <button
            type="button"
            onClick={onAction || (() => navigate('/'))}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
          >
            <ArrowLeft size={14} />
            {actionText || 'Return to Home'}
          </button>
        )}

        {resolvedType === 'empty' && actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
          >
            {actionText}
          </button>
        )}

        {resolvedType === 'error' && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
          >
            <RefreshCw size={14} />
            {actionText || 'Try Again'}
          </button>
        )}

        {/* Secondary Action Button */}
        {secondaryActionText && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
};

