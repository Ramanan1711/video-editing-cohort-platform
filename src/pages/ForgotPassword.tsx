import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
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
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Mail size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Check your inbox</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                We sent a password recovery link to{' '}
                <span className="font-bold text-slate-900">{email}</span>. Click the link in the email to recover your
                password.
              </p>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 text-left">
                <p className="font-semibold text-slate-700">Important tip:</p>
                <p className="mt-0.5">
                  Recovery links expire quickly and can only be used once. Please open the link promptly in this browser.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                >
                  Try another email
                </Button>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950"
                >
                  <ArrowLeft size={14} /> Back to log in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">Account recovery</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Forgot your password?</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Don't worry, happens to all of us. Enter your email below to recover your password.
              </p>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <FormField
                  id="email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Sending link...' : 'Submit'}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-sm text-slate-500">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-bold text-orange-600 hover:text-orange-700"
                >
                  <ArrowLeft size={14} /> Back to log in
                </Link>
                <Link to="/register" className="font-medium hover:text-slate-900">
                  Create account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
