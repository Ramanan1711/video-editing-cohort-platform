import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
    } finally {
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
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Password updated</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Your password has been successfully reset. You can now use your new password to sign in.
              </p>

              <div className="mt-6">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Continue to log in
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Lock size={20} />
              </div>
              <p className="eyebrow">Set new password</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Choose a new password.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create a strong password with at least 6 characters to secure your account.
              </p>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="mt-7 space-y-5">
                <FormField
                  id="new-password"
                  label="New password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />

                <FormField
                  id="confirm-password"
                  label="Confirm new password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Updating password...' : 'Update password'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Link to="/login" className="font-bold text-slate-500 hover:text-slate-900">
                  Back to log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

