import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useTheme } from '../context/useTheme';

export const Register: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Secure Production Flow: All public registrations are strictly assigned 'student' role.
    // Mentors are promoted exclusively by administrators through the Admin Console.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      navigate('/student/dashboard');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-12 dark:bg-slate-950">
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

      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 block w-fit text-sm font-black tracking-tight text-slate-950 dark:text-white">
          CUT / CRAFT
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 sm:p-9">
          <p className="eyebrow">Join the next cohort</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Make room for better work.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Create your student account and start your editing journey.</p>
          {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
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
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Account Type:</span> New registrations join as students. Mentors and coaches are approved and promoted by administrators.
            </div>
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
        </div>
      </div>
    </div>
  );
};