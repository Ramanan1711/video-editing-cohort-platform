import { ShieldAlert, LogOut, ArrowLeft, Home, FileCheck2, Settings, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function Unauthorized() {
  const { profile, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const role = profile?.role ?? 'student';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f6f7f9] p-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute top-5 right-5">
        <button
          onClick={toggleTheme}
          className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle color theme"
        >
          {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>
      </div>
      <Card className="w-full max-w-lg p-8 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <ShieldAlert size={28} />
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-orange-500">Access Restricted</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">You don&apos;t have access to this room.</h1>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
          <p>
            You are currently signed in as{' '}
            <strong className="text-slate-900 capitalize">{profile?.full_name || 'an editor'}</strong> with role{' '}
            <span className="rounded bg-slate-200 px-2 py-0.5 font-bold uppercase text-slate-700">{role}</span>.
          </p>
          <p className="mt-2 text-slate-500">
            If you believe you should have mentor or administrator privileges, please request promotion from your cohort administrator.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {role === 'mentor' && (
            <Link to="/review/submissions">
              <Button className="w-full sm:w-auto">
                <FileCheck2 size={16} /> Go to Review Queue
              </Button>
            </Link>
          )}

          {role === 'admin' && (
            <Link to="/admin">
              <Button className="w-full sm:w-auto">
                <Settings size={16} /> Admin Console
              </Button>
            </Link>
          )}

          <Link to="/student/dashboard">
            <Button variant="secondary" className="w-full sm:w-auto">
              <Home size={16} /> Student Workspace
            </Button>
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-400 dark:border-slate-800">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
            <ArrowLeft size={13} /> Back to homepage
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {isDarkMode ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} />}
              <span>{isDarkMode ? 'Light' : 'Dark'} mode</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

