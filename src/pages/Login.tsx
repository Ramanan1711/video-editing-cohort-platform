import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { getDashboardRouteForRole } from '../lib/authHelpers';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Determine user role for role-aware routing
      const userId = data.user?.id;
      let role = data.user?.user_metadata?.role;

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }
      }

      navigate(getDashboardRouteForRole(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 block w-fit text-sm font-black tracking-tight text-slate-950">
          CUT / CRAFT
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Return to the room.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your next edit is waiting for you.</p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <FormField
              id="email"
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? 'Logging in' : 'Log in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to Cut / Craft?{' '}
            <Link to="/register" className="font-bold text-orange-600 hover:text-orange-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};