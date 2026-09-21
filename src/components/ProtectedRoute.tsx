import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, UserX, LogOut } from 'lucide-react';
import { useAuth } from '../context/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('student' | 'mentor' | 'admin')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const lastCheckedRef = useRef<number>(0);

  // Active session status verification on route transition (throttled to at most once every 15 seconds)
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastCheckedRef.current > 15000) {
      lastCheckedRef.current = now;
      void refreshProfile();
    }
  }, [location.pathname, user, refreshProfile]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.status === 'suspended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <ShieldAlert size={28} />
          </div>
          <h2 className="mt-4 text-xl font-black text-white">Account Access Suspended</h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your platform access has been suspended by an administrator. While suspended, access to curriculum materials, cohort rosters, submission reviews, and community boards is restricted.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <LogOut size={14} /> Sign Out of Platform
            </button>
            <p className="text-[11px] text-slate-500">
              Need assistance? Contact support at <span className="font-mono text-slate-400">support@cutcraft.studio</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (profile?.status === 'inactive') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <UserX size={28} />
          </div>
          <h2 className="mt-4 text-xl font-black text-white">Account Inactive</h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            This account is currently marked as inactive. Please contact your cohort administrator or program director to reactivate your access.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <LogOut size={14} /> Sign Out
            </button>
            <p className="text-[11px] text-slate-500">
              Need assistance? Contact support at <span className="font-mono text-slate-400">support@cutcraft.studio</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};