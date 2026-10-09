import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  ExternalLink,
  GraduationCap,
  Mail,
  Phone,
  PlayCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CommunityTopNav } from '../components/community/CommunityTopNav';
import {
  getUserProfileOverview,
  updateUserProfileContact,
  type UserProfileOverview,
} from '../lib/userProfileService';
import { formatCurrencyINR } from '../lib/services/curriculumService';

export function UserProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<UserProfileOverview | null>(null);
  const [activeTab, setActiveTab] = useState<'courses' | 'attendance' | 'payments'>('courses');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Load User Profile Data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await getUserProfileOverview(user.id);
        if (isMounted) {
          setProfileData(data);
          setEditFullName(data.user.fullName || profile?.full_name || '');
          setEditPhone(data.user.whatsappNumber || profile?.whatsapp_number || '');
        }
      } catch (err) {
        console.error('Failed to load user profile overview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [user, profile]);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingEdit(true);
    try {
      await updateUserProfileContact(user.id, {
        fullName: editFullName,
        whatsappNumber: editPhone,
      });

      if (refreshProfile) {
        await refreshProfile();
      }

      // Refresh overview
      const updated = await getUserProfileOverview(user.id);
      setProfileData(updated);
      setEditModalOpen(false);
      toast.success('Profile details updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile details. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const displayName = profileData?.user.fullName || profile?.full_name || user?.email?.split('@')[0] || 'Student';
  const displayEmail = profileData?.user.email || profile?.email || user?.email || '';
  const displayPhone = profileData?.user.whatsappNumber || profile?.whatsapp_number || 'Not provided';
  const displayRole = (profileData?.user.role || profile?.role || 'student').toUpperCase();

  const enrolledCount = profileData?.stats.enrolledCount ?? 0;
  const totalFeePaid = profileData?.stats.totalFeePaidInr ?? 0;
  const attendanceRate = profileData?.stats.attendanceRatePct ?? 100;
  const attendedCount = profileData?.attendance.attendedCount ?? 0;
  const sessionsHeld = profileData?.attendance.totalSessionsHeld ?? 0;

  // Memoized initials for avatar
  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-base text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header Navigation */}
      <CommunityTopNav
        activeTab="courses"
        onTabChange={(tab) => {
          if (tab === 'community') navigate('/community');
          else if (tab === 'messages') navigate('/messages');
          else if (tab === 'workshops') navigate('/workshops');
          else navigate('/student/dashboard');
        }}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb & Back Link */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-surface-subtle bg-white dark:bg-surface-card px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:border-orange-500 hover:text-orange-600 transition"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dashboard</span>
          </button>

          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Student Identity &amp; Records
          </span>
        </div>

        {/* 1. HERO IDENTITY CARD */}
        <Card className="relative overflow-hidden p-6 sm:p-8 border border-slate-200 dark:border-surface-subtle bg-white dark:bg-surface-card">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar Pill */}
              <div className="relative flex size-20 sm:size-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-400 text-white font-black text-2xl sm:text-3xl shadow-xl shadow-orange-500/20 ring-4 ring-orange-100 dark:ring-surface-elevated">
                {initials}
                <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-surface-card" title="Active Student">
                  <CheckCircle2 size={15} />
                </div>
              </div>

              {/* Name & Basic Details */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-0.5 text-[10px] font-black tracking-wider uppercase text-orange-600 dark:text-orange-400">
                    <Sparkles size={11} />
                    {displayRole}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    {displayEmail}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    {displayPhone}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    Member since {profileData ? new Date(profileData.user.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '2026'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-2"
              >
                <Edit3 size={14} />
                <span>Edit Profile</span>
              </Button>
            </div>
          </div>

          {/* KPI HIGHLIGHT STRIP */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-surface-subtle grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-surface-elevated/50 p-4 border border-slate-100 dark:border-surface-subtle">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <BookOpen size={14} className="text-orange-500" />
                <span>Enrolled Courses</span>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : enrolledCount}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {enrolledCount > 0 ? 'Active learning track' : 'No active enrollments'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-surface-elevated/50 p-4 border border-slate-100 dark:border-surface-subtle">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <CreditCard size={14} className="text-emerald-500" />
                <span>Total Fee Paid</span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {loading ? '...' : formatCurrencyINR(totalFeePaid)}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Across {profileData?.payments.filter((p) => p.status === 'captured').length ?? 0} verified payments
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-surface-elevated/50 p-4 border border-slate-100 dark:border-surface-subtle">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Clock size={14} className="text-amber-500" />
                <span>Attendance Rate</span>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : `${attendanceRate}%`}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {attendedCount} attended / {sessionsHeld} total live sessions
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-surface-elevated/50 p-4 border border-slate-100 dark:border-surface-subtle">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck size={14} className="text-blue-500" />
                <span>Account Status</span>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white capitalize">
                {profileData?.user.status || 'Active'}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Verified Student Identity
              </p>
            </div>
          </div>
        </Card>

        {/* 2. SECTION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-surface-subtle pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('courses')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 whitespace-nowrap ${
              activeTab === 'courses'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-card'
            }`}
          >
            <BookOpen size={14} />
            <span>Enrolled Courses ({enrolledCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-card'
            }`}
          >
            <Clock size={14} />
            <span>Attendance &amp; Sessions ({sessionsHeld})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-card'
            }`}
          >
            <Receipt size={14} />
            <span>Fee Payments &amp; Receipts ({profileData?.payments.length ?? 0})</span>
          </button>
        </div>

        {/* 3. TAB CONTENT */}

        {/* --- TAB 1: ENROLLED COURSES --- */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Your Enrolled Courses
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A particular user can enroll in multiple courses (e.g. Java, Python). Below is your active enrolled curriculum.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/student/dashboard')}
                className="inline-flex items-center gap-1.5"
              >
                <span>Browse More Cohorts</span>
                <ExternalLink size={13} />
              </Button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading your enrolled courses...</div>
            ) : profileData?.enrolledCourses.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 mb-3">
                  <GraduationCap size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Enrolled Courses Found</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  You have not enrolled in any courses yet. Explore our cohorts to start learning.
                </p>
                <Button onClick={() => navigate('/student/dashboard')} size="sm" className="mt-4">
                  Explore Cohorts
                </Button>
              </Card>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {profileData?.enrolledCourses.map((c, idx) => (
                  <Card
                    key={`${c.cohortId}-${idx}`}
                    className="p-5 flex flex-col justify-between border border-slate-200 dark:border-surface-subtle hover:border-orange-500/50 transition-all hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={10} /> Enrolled
                          </span>
                          <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                            {c.cohortTitle}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {c.courseTitle}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrencyINR(c.priceInr)}
                          </span>
                          <p className="text-[10px] text-slate-400">Fee Paid</p>
                        </div>
                      </div>

                      {/* Course Progress Bar */}
                      <div className="mt-5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500 dark:text-slate-400">Curriculum Progress</span>
                          <span className="text-orange-600 dark:text-orange-400 font-mono">
                            {c.progressPercent}% ({c.completedLessons}/{c.totalLessons} lessons)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-surface-elevated">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, c.progressPercent))}%` }}
                          />
                        </div>
                      </div>

                      {/* Enrollment Details */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-surface-subtle flex items-center justify-between text-[11px] text-slate-400">
                        <span>Enrolled on {new Date(c.enrolledAt).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                        <span className="capitalize">{c.status}</span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <Button
                        onClick={() => navigate(`/student/dashboard?cohortId=${c.cohortId}&view=player`)}
                        className="w-full justify-center bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        size="sm"
                      >
                        <PlayCircle size={15} />
                        <span>Go to Classroom &amp; Lectures</span>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: ATTENDANCE & SESSIONS --- */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Live Session Attendance Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track your participation in mentor code reviews, interactive workshops, and masterclasses.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-orange-50 dark:bg-surface-card border border-orange-200 dark:border-surface-subtle px-3.5 py-2 text-xs font-bold text-orange-700 dark:text-orange-400">
                <Clock size={14} />
                <span>Overall Attendance: {attendanceRate}%</span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading attendance history...</div>
            ) : profileData?.attendance.records.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 mb-3">
                  <Clock size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Live Session Attendance Recorded</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  When you check in or join scheduled workshops, your verified attendance will appear here.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden border border-slate-200 dark:border-surface-subtle">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-surface-subtle">
                      <tr>
                        <th className="px-4 py-3.5">Session Title</th>
                        <th className="px-4 py-3.5">Date &amp; Time</th>
                        <th className="px-4 py-3.5">Attendance Status</th>
                        <th className="px-4 py-3.5">Duration</th>
                        <th className="px-4 py-3.5">Check-in Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-surface-subtle font-medium">
                      {profileData?.attendance.records.map((r) => {
                        const statusColors = {
                          present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
                          late: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400',
                          absent: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400',
                          excused: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400',
                        }[r.status] || 'bg-slate-100 text-slate-700';

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-surface-elevated/30 transition">
                            <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                              {r.session_title || 'Live Workshop'}
                              {r.notes && (
                                <p className="mt-0.5 text-[11px] font-normal text-slate-400">{r.notes}</p>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                              {new Date(r.session_starts_at || r.created_at).toLocaleString([], {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColors}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-mono">
                              {r.duration_minutes ? `${r.duration_minutes}m` : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] capitalize">
                              {r.check_in_method.replace(/_/g, ' ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* --- TAB 3: FEE PAYMENTS & RECEIPTS --- */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Payment History &amp; Receipts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every course fee paid via Razorpay with instant verification and order records.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-4 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CreditCard size={14} />
                <span>Total Amount Invested: {formatCurrencyINR(totalFeePaid)}</span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading payment receipts...</div>
            ) : profileData?.payments.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 mb-3">
                  <Receipt size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Payments Recorded</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  When you complete enrollment transactions, full itemized receipts will be available here.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden border border-slate-200 dark:border-surface-subtle">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-surface-elevated text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-surface-subtle">
                      <tr>
                        <th className="px-4 py-3.5">Course / Cohort</th>
                        <th className="px-4 py-3.5">Amount Paid</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Transaction ID</th>
                        <th className="px-4 py-3.5">Order ID</th>
                        <th className="px-4 py-3.5">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-surface-subtle font-medium">
                      {profileData?.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-surface-elevated/30 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                            {p.cohortTitle}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyINR(p.amountInr)} {p.currency}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                p.status === 'captured'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <CheckCircle2 size={10} />
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {p.paymentId || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                            {p.orderId}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                            {new Date(p.paidAt).toLocaleDateString([], {
                              dateStyle: 'medium',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* 4. EDIT PROFILE CONTACT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-surface-subtle bg-white dark:bg-surface-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-subtle pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">
                  Student Settings
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Update Profile Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. Ramanan M"
                  className="w-full rounded-xl border border-slate-200 dark:border-surface-subtle bg-white dark:bg-surface-elevated px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Contact Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 dark:border-surface-subtle bg-white dark:bg-surface-elevated px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Used for cohort sprint reminders and attendance alerts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={displayEmail}
                  className="w-full rounded-xl border border-slate-200 dark:border-surface-subtle bg-slate-100 dark:bg-surface-elevated/40 px-3.5 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Email is locked to your Supabase authentication identity.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-surface-subtle">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEdit}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
