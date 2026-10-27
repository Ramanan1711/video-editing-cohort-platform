import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, UserX, LogOut, Clock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { isSessionExpired } from '../lib/authSessionService';
import { checkStudentLoginAccess } from '../lib/studentAccessService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('student' | 'mentor' | 'admin' | 'super_admin')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const lastCheckedRef = useRef<number>(0);
  const [accessState, setAccessState] = useState<{
    checked: boolean;
    hasAccess: boolean;
    message?: string;
    courseEndDate?: string | null;
    accessExpiryDate?: string | null;
  }>(() => ({
    checked: profile?.role !== 'student',
    hasAccess: true,
  }));

  // Active session status and 7-day retention verification on route transition (throttled to at most once every 15 seconds)
  useEffect(() => {
    if (!user) return;
    if (isSessionExpired()) {
      void signOut();
      return;
    }
    const now = Date.now();
    if (now - lastCheckedRef.current > 15000) {
      lastCheckedRef.current = now;
      void refreshProfile();
    }
  }, [location.pathname, user, refreshProfile, signOut]);

  // Student login access duration verification (course end date + 60 days)
  useEffect(() => {
    if (!user || profile?.role !== 'student') {
      return;
    }
    let active = true;
    checkStudentLoginAccess(user.id)
      .then((res) => {
        if (!active) return;
        setAccessState({
          checked: true,
          hasAccess: res.hasAccess,
          message: res.message,
          courseEndDate: res.formattedCourseEndDate,
          accessExpiryDate: res.formattedAccessExpiryDate,
        });
      })
      .catch(() => {
        if (active) setAccessState({ checked: true, hasAccess: true });
      });
    return () => {
      active = false;
    };
  }, [user, profile?.role]);

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
              Need assistance? Contact support at <span className="font-mono text-slate-400">support@iunoware.com</span>
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
              Need assistance? Contact support at <span className="font-mono text-slate-400">support@iunoware.com</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (profile?.role === 'student' && accessState.checked && !accessState.hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Clock size={28} />
          </div>
          <h2 className="mt-4 text-xl font-black text-white">Course Access Expired</h2>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            {accessState.message ||
              `Your enrolled course access duration ended on ${accessState.accessExpiryDate} (60 days after your course ended on ${accessState.courseEndDate}).`}
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-left text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Course End Date:</span>
              <span className="font-mono text-white font-bold">{accessState.courseEndDate || 'Concluded'}</span>
            </div>
            <div className="flex justify-between">
              <span>Access Valid Until:</span>
              <span className="font-mono text-amber-400 font-bold">{accessState.accessExpiryDate || 'Expired'}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-white/5">
              <span>Duration Policy:</span>
              <span>Course End + 60 Days</span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-500 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Sign Out of Platform
            </button>
            <a
              href="mailto:support@iunoware.com"
              className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors block text-center"
            >
              Contact Admissions (support@iunoware.com)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const hasRoleAccess =
    !allowedRoles ||
    Boolean(
      profile &&
        (allowedRoles.includes(profile.role) ||
          (profile.role === 'super_admin' && allowedRoles.includes('admin')))
    );

  if (!hasRoleAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};