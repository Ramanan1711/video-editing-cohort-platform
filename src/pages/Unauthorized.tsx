import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, LogOut, Home } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { Button } from '../components/ui/Button';
import { getDashboardRouteForRole } from '../lib/authHelpers';

export const Unauthorized: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const dashboardRoute = getDashboardRouteForRole(profile?.role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 block w-fit text-sm font-black tracking-tight text-slate-950">
          CUT / CRAFT
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <ShieldAlert size={28} />
          </div>

          <p className="eyebrow orange text-xs font-black uppercase tracking-[0.16em] text-orange-500">
            Access Restricted
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Reserved studio room.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            You don&apos;t have the required permissions to view this section of the platform.
          </p>

          {profile && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current account:</span>
                <span className="font-semibold text-slate-900">{profile.email}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500">Assigned role:</span>
                <span className="rounded-md bg-orange-100 px-2 py-0.5 font-bold uppercase tracking-wider text-orange-700">
                  {profile.role}
                </span>
              </div>
            </div>
          )}

          <div className="mt-7 space-y-3">
            {user ? (
              <>
                <Button
                  onClick={() => navigate(dashboardRoute)}
                  className="w-full justify-center"
                >
                  Go to your workspace <ArrowRight size={16} />
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/')}
                    className="flex-1 justify-center"
                  >
                    <Home size={15} /> Home
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSignOut}
                    className="flex-1 justify-center text-slate-600 hover:text-red-600"
                  >
                    <LogOut size={15} /> Sign out
                  </Button>
                </div>
              </>
            ) : (
              <Button href="/login" className="w-full justify-center">
                Log in to Cut / Craft
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

