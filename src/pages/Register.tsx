import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { getDashboardRouteForRole } from '../lib/authHelpers';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // If user session is established right away
      if (data.session) {
        navigate(getDashboardRouteForRole(role));
      } else {
        // Confirmation email required
        setRegisteredEmail(email);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
          {registeredEmail ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <p className="eyebrow orange text-xs font-black uppercase tracking-wider text-orange-500">
                Account created
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Check your inbox.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                We sent a confirmation link to <strong className="text-slate-800">{registeredEmail}</strong>.
                Click the link to verify your email and access the studio.
              </p>
              <div className="mt-7">
                <Button href="/login" className="w-full justify-center">
                  Go to login
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">Join the next cohort</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Make room for better work.
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create your account and start your 30-day sprint.
              </p>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="mt-7 space-y-5">
                <FormField
                  id="full-name"
                  label="Full name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Editor"
                />
                <FormField
                  id="register-email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <FormField
                  id="register-password"
                  label="Password"
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />

                <label className="block text-left">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    I&apos;m joining as
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'student' | 'mentor')}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                  >
                    <option value="student">Student</option>
                    <option value="mentor">Mentor</option>
                  </select>
                </label>

                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Creating account' : 'Create my account'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already inside?{' '}
                <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};