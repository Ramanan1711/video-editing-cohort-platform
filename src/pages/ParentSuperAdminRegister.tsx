import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import {
  isParentSuperAdmin,
  isChildSuperAdmin,
} from '../lib/adminPermissions';
import {
  listUsers,
  registerStaffUser,
  type RegisterStaffInput,
  type StaffRoleSelection,
  type UserProfile,
} from '../lib/adminService';
import { parseDatabaseError } from '../lib/errorHandling';
import { TopRightControls } from '../components/TopRightControls';

export function ParentSuperAdminRegister() {
  const { profile, loading: authLoading } = useAuth();
  const toast = useToast();

  const isParent = isParentSuperAdmin(profile);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<StaffRoleSelection>('Mentor');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission & feedback state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Staff roster state
  const [staffUsers, setStaffUsers] = useState<UserProfile[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'mentor' | 'admin' | 'child_super_admin'>('all');

  const fetchStaffRoster = async () => {
    setRosterLoading(true);
    try {
      const allUsers = await listUsers();
      // Filter leadership staff only (mentors, admins, super admins)
      const filtered = allUsers.filter(
        (u) =>
          u.role === 'mentor' ||
          u.role === 'admin' ||
          u.admin_role === 'child_super_admin' ||
          u.admin_role === 'parent_super_admin' ||
          u.admin_role === 'super_admin'
      );
      setStaffUsers(filtered);
    } catch (err) {
      console.error('Failed to fetch staff roster:', err);
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    if (isParent) {
      void fetchStaffRoster();
    }
  }, [isParent]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  // Strict authorization guard: Only Parent Super Admin can view this page
  if (!isParent) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleResetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRole('Mentor');
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validation
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setFormError('Full name is required.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    const cleanDigits = trimmedPhone.replace(/[^0-9]/g, '');
    if (!trimmedPhone || cleanDigits.length < 10) {
      setFormError('Please enter a valid phone number with at least 10 digits.');
      return;
    }

    if (!password) {
      setFormError('Password is required.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const input: RegisterStaffInput = {
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        password,
        role,
      };

      const result = await registerStaffUser(input, {
        id: profile?.id || '',
        email: profile?.email || '',
      });

      const roleDisplay =
        role === 'Child Super_Admin'
          ? 'Child Super Admin'
          : role === 'Admin'
          ? 'Admin'
          : 'Mentor';

      const successMsg = `Successfully registered ${result.full_name || trimmedEmail} as ${roleDisplay}.`;
      setFormSuccess(successMsg);
      toast.success(successMsg);

      // Reset form and reload roster
      handleResetForm();
      setFormSuccess(successMsg);
      void fetchStaffRoster();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setFormError(parsed.message || 'Failed to register staff user.');
      toast.error(parsed.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered staff roster
  const displayedStaff = staffUsers.filter((u) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'mentor'
        ? u.role === 'mentor'
        : activeFilter === 'child_super_admin'
        ? u.admin_role === 'child_super_admin'
        : u.role === 'admin' && u.admin_role !== 'child_super_admin';

    const matchesSearch =
      !searchQuery.trim() ||
      (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const mentorCount = staffUsers.filter((u) => u.role === 'mentor').length;
  const adminCount = staffUsers.filter((u) => u.role === 'admin' && u.admin_role !== 'child_super_admin').length;
  const childAdminCount = staffUsers.filter((u) => u.admin_role === 'child_super_admin').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft size={14} />
              Admin Console
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">
                  Root Governance
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-600 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-xs">
                  <Shield size={10} className="fill-slate-950" /> Parent Super Admin
                </span>
              </div>
              <h1 className="text-base font-black text-slate-950 dark:text-white sm:text-lg">
                Leadership &amp; Staff Registration Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TopRightControls />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {/* Intro Banner */}
        <div className="mb-8 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">
                  Parent Super Admin Exclusive Authority
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                  As the platform&apos;s sovereign Parent Super Admin, only you hold the credentials to provision and onboard
                  new <span className="font-bold text-slate-800 dark:text-slate-200">Mentors</span>,{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">Admins</span>, and{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">Child Super Admins</span>.
                  Registered accounts will be instantly activated with their authorized permission sets.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Authorized: {profile?.email || 'ajayramanan17@gmail.com'}
              </span>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Left = Registration Form, Right = Staff Roster */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Registration Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Add / Register Staff
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Provision credentials and assign system role
                    </p>
                  </div>
                </div>
              </div>

              {/* Status alerts */}
              {formError && (
                <div
                  data-testid="register-staff-error"
                  className="mb-4 flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert size={15} className="mt-0.5 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                  <button onClick={() => setFormError(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {formSuccess && (
                <div
                  data-testid="register-staff-success"
                  className="mb-4 flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{formSuccess}</span>
                  </div>
                  <button onClick={() => setFormSuccess(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="full_name"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Full name*
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User size={15} />
                    </div>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email address*
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail size={15} />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. john.mentor@iunoware.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="phone_number"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Phone number*
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Phone size={15} />
                    </div>
                    <input
                      id="phone_number"
                      name="phone_number"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Used for WhatsApp cohort alerts &amp; urgent operational escalations.
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Password*
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <KeyRound size={15} />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirm_password"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Confirm Password*
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <KeyRound size={15} />
                    </div>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-orange-500 dark:focus:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label
                    htmlFor="role"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Role*
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      data-testid="role-btn-mentor"
                      onClick={() => setRole('Mentor')}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                        role === 'Mentor'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400'
                      }`}
                    >
                      <GraduationCap size={18} className={role === 'Mentor' ? 'text-emerald-600' : ''} />
                      <span className="mt-1 text-[11px] font-bold">Mentor</span>
                    </button>

                    <button
                      type="button"
                      data-testid="role-btn-admin"
                      onClick={() => setRole('Admin')}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                        role === 'Admin'
                          ? 'border-blue-500 bg-blue-50/80 text-blue-900 shadow-xs dark:bg-blue-950/40 dark:text-blue-200'
                          : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400'
                      }`}
                    >
                      <Shield size={18} className={role === 'Admin' ? 'text-blue-600' : ''} />
                      <span className="mt-1 text-[11px] font-bold">Admin</span>
                    </button>

                    <button
                      type="button"
                      data-testid="role-btn-child-super-admin"
                      onClick={() => setRole('Child Super_Admin')}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                        role === 'Child Super_Admin'
                          ? 'border-purple-500 bg-purple-50/80 text-purple-900 shadow-xs dark:bg-purple-950/40 dark:text-purple-200'
                          : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400'
                      }`}
                    >
                      <ShieldCheck size={18} className={role === 'Child Super_Admin' ? 'text-purple-600' : ''} />
                      <span className="mt-1 text-[11px] font-bold">Child Super_Admin</span>
                    </button>
                  </div>

                  {/* Role Explainer Card */}
                  <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                    {role === 'Mentor' && (
                      <p>
                        <span className="font-bold text-emerald-600">Mentor:</span> Assigned to cohorts. Can review student submissions, provide video critiques, award scores, and guide learners.
                      </p>
                    )}
                    {role === 'Admin' && (
                      <p>
                        <span className="font-bold text-blue-600">Admin:</span> Manages cohorts, curriculum, assignments, live sessions, announcements, and community moderation.
                      </p>
                    )}
                    {role === 'Child Super_Admin' && (
                      <p>
                        <span className="font-bold text-purple-600">Child Super Admin:</span> Executive platform administrator with full operational, observability, and audit access, except modifying staff roles.
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit button & reset */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    data-testid="submit-register-staff"
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-orange-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Registering Staff Member...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={14} />
                        <span>Add / Register {role === 'Child Super_Admin' ? 'Child Super Admin' : role}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Leadership Staff Roster (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Active Leadership Staff ({displayedStaff.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Roster of Mentors, Admins, and Child Super Admins
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void fetchStaffRoster()}
                  disabled={rosterLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <RefreshCw size={12} className={rosterLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {/* Filters & Search */}
              <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      activeFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    All Staff ({staffUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('mentor')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      activeFilter === 'mentor'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    Mentors ({mentorCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('admin')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      activeFilter === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
                    }`}
                  >
                    Admins ({adminCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('child_super_admin')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      activeFilter === 'child_super_admin'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300'
                    }`}
                  >
                    Child Super ({childAdminCount})
                  </button>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                    <Search size={13} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search staff..."
                    className="w-full sm:w-48 rounded-lg border border-slate-200 bg-slate-50/50 py-1 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
                  />
                </div>
              </div>

              {/* Roster Table */}
              {rosterLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <RefreshCw size={24} className="animate-spin text-orange-500" />
                </div>
              ) : displayedStaff.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-800">
                  <Users size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    No staff members match the selected filter.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Use the form on the left to register a new Mentor or Admin.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3">Assigned Role</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {displayedStaff.map((staff) => {
                        const isRootParent = isParentSuperAdmin(staff);
                        const isChild = isChildSuperAdmin(staff);

                        return (
                          <tr
                            key={staff.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                  {(staff.full_name || staff.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-white truncate">
                                    {staff.full_name || 'Unnamed Staff'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    {staff.email}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              {isRootParent ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-600 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-xs">
                                  <Shield size={10} className="fill-slate-950" /> Parent Super Admin
                                </span>
                              ) : isChild ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                  <ShieldCheck size={10} className="fill-white" /> Child Super Admin
                                </span>
                              ) : staff.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                                  <Shield size={10} /> Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                                  <GraduationCap size={10} /> Mentor
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                              {staff.whatsapp_number || staff.phone || '—'}
                            </td>

                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  staff.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${
                                    staff.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                />
                                {staff.status}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right text-[11px] text-slate-500">
                              {staff.created_at
                                ? new Date(staff.created_at).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ParentSuperAdminRegister;
