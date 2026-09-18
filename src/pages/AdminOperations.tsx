import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  Edit2,
  ExternalLink,
  Layers,
  Megaphone,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/useAuth';
import { assignMentorToCohort } from '../lib/mentorService';
import {
  createAnnouncement,
  createLiveSession,
  deleteAnnouncement,
  deleteCommunityPost,
  deleteLiveSession,
  enrollUserInCohort,
  getAdminStats,
  listAnnouncements,
  listCohortEnrollments,
  listCommunityPostsWithAuthors,
  listLiveSessions,
  listUsers,
  removeEnrollment,
  updateAnnouncement,
  updateEnrollmentStatus,
  updateLiveSession,
  updateUserRole,
  updateUserStatus,
  type AdminAnnouncement,
  type AdminCommunityPost,
  type AdminEnrollment,
  type AdminStats,
  type LiveSession,
  type UserProfile,
} from '../lib/adminService';
import { listCohorts, type Cohort } from '../lib/courseService';

const emptyStats: AdminStats = {
  users: 0,
  students: 0,
  mentors: 0,
  admins: 0,
  cohorts: 0,
  enrollments: 0,
  posts: 0,
  pendingSubmissions: 0,
  reviewedSubmissions: 0,
  announcements: 0,
  sessions: 0,
};

type AdminTab = 'overview' | 'users' | 'enrollments' | 'announcements' | 'sessions' | 'community';

export function AdminOperations() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User Management state
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'mentor' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Enrollment Management state
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollTargetCohortId, setEnrollTargetCohortId] = useState('');
  const [enrollingUser, setEnrollingUser] = useState(false);

  // Mentor Assignment state
  const [showAssignMentorModal, setShowAssignMentorModal] = useState(false);
  const [assignMentorId, setAssignMentorId] = useState('');
  const [assignCohortId, setAssignCohortId] = useState('');
  const [assigningMentor, setAssigningMentor] = useState(false);

  // Announcement state
  const [announcementInput, setAnnouncementInput] = useState({ title: '', body: '' });
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // Live session state
  const [sessionInput, setSessionInput] = useState({ title: '', description: '', starts_at: '', meeting_url: '' });
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [savingSession, setSavingSession] = useState(false);

  const [nowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    let active = true;
    Promise.all([
      getAdminStats(),
      listUsers(),
      listCohorts(),
      listCohortEnrollments(),
      listAnnouncements(),
      listLiveSessions(),
      listCommunityPostsWithAuthors(),
    ])
      .then(([
        nextStats,
        nextUsers,
        nextCohorts,
        nextEnrollments,
        nextAnnouncements,
        nextSessions,
        nextPosts,
      ]) => {
        if (!active) return;
        setStats(nextStats);
        setUsers(nextUsers);
        setCohorts(nextCohorts);
        setEnrollments(nextEnrollments);
        setAnnouncements(nextAnnouncements);
        setSessions(nextSessions);
        setPosts(nextPosts);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load administrative operations data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.role]);

  // --- USER ACTIONS ---
  const handleRoleChange = async (targetUser: UserProfile, newRole: 'student' | 'mentor') => {
    if (targetUser.id === user?.id) {
      setError('You cannot modify your own administrative role.');
      return;
    }
    setUpdatingUserId(targetUser.id);
    setError(null);
    try {
      const updated = await updateUserRole(targetUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccess(`Role for ${targetUser.full_name || targetUser.email} updated to ${newRole}.`);
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusChange = async (targetUser: UserProfile, newStatus: 'active' | 'suspended') => {
    if (targetUser.id === user?.id) {
      setError('You cannot suspend your own administrative account.');
      return;
    }
    setUpdatingUserId(targetUser.id);
    setError(null);
    try {
      const updated = await updateUserStatus(targetUser.id, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccess(`Account status for ${targetUser.full_name || targetUser.email} set to ${newStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user status.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // --- ENROLLMENT ACTIONS ---
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollStudentId || !enrollTargetCohortId) return;
    setEnrollingUser(true);
    setError(null);
    try {
      await enrollUserInCohort(enrollStudentId, enrollTargetCohortId);
      setSuccess('Student successfully enrolled into cohort.');
      setShowEnrollModal(false);
      setEnrollStudentId('');
      setEnrollTargetCohortId('');
      const updatedEnrollments = await listCohortEnrollments();
      setEnrollments(updatedEnrollments);
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll student.');
    } finally {
      setEnrollingUser(false);
    }
  };

  const handleUpdateEnrollmentStatus = async (
    userId: string,
    cohortId: string,
    status: 'active' | 'completed' | 'dropped'
  ) => {
    try {
      await updateEnrollmentStatus(userId, cohortId, status);
      setEnrollments((prev) =>
        prev.map((item) =>
          item.user_id === userId && item.cohort_id === cohortId ? { ...item, status } : item
        )
      );
      setSuccess('Enrollment status updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update enrollment status.');
    }
  };

  const handleRemoveEnrollment = async (userId: string, cohortId: string, studentName: string) => {
    if (!window.confirm(`Remove ${studentName} from this cohort?`)) return;
    try {
      await removeEnrollment(userId, cohortId);
      setEnrollments((prev) => prev.filter((item) => !(item.user_id === userId && item.cohort_id === cohortId)));
      setSuccess(`Removed ${studentName} from cohort.`);
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove enrollment.');
    }
  };

  const handleAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignMentorId || !assignCohortId) return;
    try {
      setAssigningMentor(true);
      await assignMentorToCohort(assignMentorId, assignCohortId);
      setSuccess('Mentor successfully assigned to cohort.');
      setShowAssignMentorModal(false);
      setAssignMentorId('');
      setAssignCohortId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign mentor to cohort.');
    } finally {
      setAssigningMentor(false);
    }
  };

  // --- ANNOUNCEMENT ACTIONS ---
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAnnouncement(true);
    setError(null);
    try {
      if (editingAnnouncement) {
        const updated = await updateAnnouncement(editingAnnouncement.id, announcementInput);
        setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSuccess('Announcement updated successfully.');
        setEditingAnnouncement(null);
      } else {
        const created = await createAnnouncement(user.id, announcementInput.title, announcementInput.body);
        setAnnouncements((prev) => [created, ...prev]);
        setSuccess('Announcement broadcasted successfully.');
      }
      setAnnouncementInput({ title: '', body: '' });
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save announcement.');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setSuccess('Announcement deleted.');
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete announcement.');
    }
  };

  // --- LIVE SESSION ACTIONS ---
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSession(true);
    setError(null);
    try {
      if (editingSession) {
        const updated = await updateLiveSession(editingSession.id, sessionInput);
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSuccess('Live session updated.');
        setEditingSession(null);
      } else {
        const created = await createLiveSession(user.id, sessionInput);
        setSessions((prev) => [...prev, created]);
        setSuccess('Live session scheduled.');
      }
      setSessionInput({ title: '', description: '', starts_at: '', meeting_url: '' });
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save live session.');
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm('Cancel and delete this live session?')) return;
    try {
      await deleteLiveSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSuccess('Live session removed.');
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete live session.');
    }
  };

  // --- COMMUNITY MODERATION ---
  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this community post?')) return;
    try {
      await deleteCommunityPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setSuccess('Community post removed.');
      void getAdminStats().then(setStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete community post.');
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (u.status || 'active') === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  // Filtered Enrollments
  const filteredEnrollments = useMemo(() => {
    if (selectedCohortId === 'all') return enrollments;
    return enrollments.filter((e) => e.cohort_id === selectedCohortId);
  }, [enrollments, selectedCohortId]);

  const tabs: { id: AdminTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Summary Dashboard' },
    { id: 'users', label: 'User Roles & Status', count: users.length },
    { id: 'enrollments', label: 'Cohort Enrollments', count: enrollments.length },
    { id: 'announcements', label: 'Announcements', count: announcements.length },
    { id: 'sessions', label: 'Live Sessions', count: sessions.length },
    { id: 'community', label: 'Community Moderation', count: posts.length },
  ];

  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
        <Card className="max-w-md p-8">
          <ShieldAlert className="mx-auto text-amber-500 mb-3" size={32} />
          <h2 className="text-xl font-black text-slate-950">Administrator Access Required</h2>
          <p className="mt-2 text-xs text-slate-500">
            You must hold the System Administrator role to view and operate the control room.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-slate-950 text-white shadow-2xs">
                  <Shield size={16} />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Administration Control Room</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Operations &amp; Governance</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                User roles, cohort enrollments, broadcast communications, live mentorship sessions, and moderation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/admin/courses"
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Course Authoring Studio →
              </Link>
              <Link
                to="/review/submissions"
                className="rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800"
              >
                Review Room →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {/* Toast Alerts */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-red-50 p-3.5 text-xs text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-700">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="mb-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-1 text-xs font-bold">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 transition ${
                tab === item.id
                  ? 'bg-orange-500 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    tab === item.id ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200" />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-2xl bg-white border border-slate-200" />
          </div>
        ) : (
          <>
            {/* TAB 1: SUMMARY DASHBOARD OVERVIEW */}
            {tab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Users size={18} className="text-orange-600" />}
                label="Total Registered Users"
                value={stats.users}
                sub={`${stats.students} Students · ${stats.mentors} Mentors · ${stats.admins} Admins`}
              />
              <StatCard
                icon={<CalendarDays size={18} className="text-blue-600" />}
                label="Active Cohorts"
                value={stats.cohorts}
                sub={`${stats.enrollments} total student enrollments`}
              />
              <StatCard
                icon={<Award size={18} className="text-purple-600" />}
                label="Submissions Processed"
                value={stats.pendingSubmissions + stats.reviewedSubmissions}
                sub={`${stats.pendingSubmissions} pending mentor evaluation`}
              />
              <StatCard
                icon={<Radio size={18} className="text-emerald-600" />}
                label="Live Mentorship & Events"
                value={stats.sessions}
                sub={`${stats.announcements} broadcasts published`}
              />
            </div>

            {/* Quick Actions Panel */}
            <Card className="p-6">
              <h2 className="text-base font-black text-slate-950">Quick Operations</h2>
              <p className="mt-1 text-xs text-slate-500">Fast paths for routine academy workflows.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  onClick={() => {
                    setTab('enrollments');
                    setShowEnrollModal(true);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-orange-300 hover:bg-white"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Enroll Student</strong>
                    <span className="text-[10px] text-slate-500">Assign student to cohort</span>
                  </div>
                </button>

                <button
                  onClick={() => setTab('announcements')}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-orange-300 hover:bg-white"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Post Announcement</strong>
                    <span className="text-[10px] text-slate-500">Broadcast milestone or note</span>
                  </div>
                </button>

                <button
                  onClick={() => setTab('sessions')}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-orange-300 hover:bg-white"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                    <Radio size={18} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Schedule Live Review</strong>
                    <span className="text-[10px] text-slate-500">Add Zoom/Meet session</span>
                  </div>
                </button>

                <Link
                  to="/admin/courses"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-orange-300 hover:bg-white"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Course Authoring</strong>
                    <span className="text-[10px] text-slate-500">Modules, videos &amp; assets</span>
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: USER ROLES & STATUS MANAGEMENT */}
        {tab === 'users' && (
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-black text-slate-950">User Directory &amp; Permissions</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Manage platform members, promote trusted editors to Mentors, or suspend abusive accounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-40 sm:w-56 bg-transparent outline-none text-xs"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="mentor">Mentors</option>
                  <option value="admin">Admins</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Only</option>
                </select>
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {filteredUsers.length ? (
                filteredUsers.map((item) => {
                  const isSelf = item.id === user?.id;
                  const isUpdating = updatingUserId === item.id;
                  const isSuspended = item.status === 'suspended';

                  return (
                    <div key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
                          {item.full_name?.charAt(0).toUpperCase() || item.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-slate-950">
                              {item.full_name || 'Unnamed User'}
                            </strong>
                            {isSelf && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                You
                              </span>
                            )}
                            {isSuspended ? (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                Suspended
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{item.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <RoleBadge role={item.role} />

                        {/* Promotion / Demotion Actions */}
                        {!isSelf && item.role === 'student' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isUpdating}
                            onClick={() => void handleRoleChange(item, 'mentor')}
                            className="text-xs font-bold"
                          >
                            <UserCheck size={13} className="text-purple-600" /> Promote to Mentor
                          </Button>
                        )}

                        {!isSelf && item.role === 'mentor' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isUpdating}
                            onClick={() => void handleRoleChange(item, 'student')}
                            className="text-xs font-bold text-amber-700"
                          >
                            <UserMinus size={13} /> Demote to Student
                          </Button>
                        )}

                        {/* Suspend / Reactivate Actions */}
                        {!isSelf && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isUpdating}
                            onClick={() => void handleStatusChange(item, isSuspended ? 'active' : 'suspended')}
                            className={`text-xs font-bold ${
                              isSuspended ? 'text-emerald-700' : 'text-red-600 hover:text-red-700'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <Check size={13} /> Reactivate
                              </>
                            ) : (
                              <>
                                <UserX size={13} /> Suspend
                              </>
                            )}
                          </Button>
                        )}

                        {item.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                            <ShieldCheck size={14} className="text-emerald-500" /> System Admin
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-12 text-center text-xs text-slate-400">No matching users found.</p>
              )}
            </div>
          </Card>
        )}

        {/* TAB 3: COHORT ENROLLMENT MANAGEMENT */}
        {tab === 'enrollments' && (
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-black text-slate-950">Cohort Enrollments</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Inspect student cohort rosters, assign enrollments manually, or adjust completion status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                  <Layers size={13} className="text-slate-400" />
                  <select
                    value={selectedCohortId}
                    onChange={(e) => setSelectedCohortId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="all">All Cohorts ({enrollments.length})</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAssignMentorModal(true)}
                  className="text-xs font-bold"
                >
                  <Sparkles size={14} /> Assign Mentor
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowEnrollModal(true)}
                  className="text-xs font-bold"
                >
                  <UserPlus size={14} /> Enroll Student
                </Button>
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {filteredEnrollments.length ? (
                filteredEnrollments.map((item) => (
                  <div
                    key={`${item.user_id}-${item.cohort_id}`}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-slate-950">{item.student_name}</strong>
                        <span className="text-xs text-slate-400">({item.student_email})</span>
                        <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          {item.cohort_name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Enrolled {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          void handleUpdateEnrollmentStatus(
                            item.user_id,
                            item.cohort_id,
                            e.target.value as 'active' | 'completed' | 'dropped'
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold outline-none ${
                          item.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : item.status === 'completed'
                            ? 'border-purple-200 bg-purple-50 text-purple-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="dropped">Dropped</option>
                      </select>

                      <button
                        onClick={() => void handleRemoveEnrollment(item.user_id, item.cohort_id, item.student_name)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Remove from cohort"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-xs text-slate-400">No student enrollments found for this filter.</p>
              )}
            </div>

            {/* Manual Enrollment Modal */}
            {showEnrollModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
                <form onSubmit={handleEnrollStudent} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-950">Enroll Student into Cohort</h3>
                    <button type="button" onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-slate-700">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Select Student
                      <select
                        value={enrollStudentId}
                        onChange={(e) => setEnrollStudentId(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                      >
                        <option value="">Choose a registered student...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || 'Unnamed'} ({u.email})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Target Cohort
                      <select
                        value={enrollTargetCohortId}
                        onChange={(e) => setEnrollTargetCohortId(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                      >
                        <option value="">Choose cohort...</option>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button variant="secondary" size="sm" type="button" onClick={() => setShowEnrollModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={enrollingUser}>
                      Enroll Student
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Mentor Cohort Assignment Modal */}
            {showAssignMentorModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
                <form
                  onSubmit={handleAssignMentor}
                  className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-950">Assign Mentor to Cohort</h3>
                    <button
                      type="button"
                      onClick={() => setShowAssignMentorModal(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Select Mentor
                      <select
                        value={assignMentorId}
                        onChange={(e) => setAssignMentorId(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                      >
                        <option value="">Choose a designated mentor...</option>
                        {users
                          .filter((u) => u.role === 'mentor' || u.role === 'admin')
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || 'Unnamed'} ({u.email}) — [{u.role.toUpperCase()}]
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Target Cohort
                      <select
                        value={assignCohortId}
                        onChange={(e) => setAssignCohortId(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                      >
                        <option value="">Choose cohort...</option>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setShowAssignMentorModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={assigningMentor}>
                      <Sparkles size={14} /> Assign Mentor
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        )}

        {/* TAB 4: ANNOUNCEMENTS PUBLISHING */}
        {tab === 'announcements' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Form */}
            <Card className="p-6">
              <h2 className="text-base font-black text-slate-950">
                {editingAnnouncement ? 'Edit Announcement' : 'Publish Broadcast Announcement'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Broadcast project deadlines, milestone releases, or live stream reminders to all students.
              </p>

              <form onSubmit={handleSaveAnnouncement} className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Announcement Title
                  <input
                    type="text"
                    required
                    value={announcementInput.title}
                    onChange={(e) => setAnnouncementInput({ ...announcementInput, title: e.target.value })}
                    placeholder="e.g., Week 2 Narrative Rushes & LUTs Released!"
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Message Body
                  <textarea
                    required
                    rows={4}
                    value={announcementInput.body}
                    onChange={(e) => setAnnouncementInput({ ...announcementInput, body: e.target.value })}
                    placeholder="Provide details, assignment instructions, and links..."
                    className="mt-1.5 block w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </label>

                <div className="flex items-center justify-between pt-2">
                  {editingAnnouncement && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingAnnouncement(null);
                        setAnnouncementInput({ title: '', body: '' });
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                  <Button type="submit" size="sm" loading={savingAnnouncement} className="ml-auto">
                    <Megaphone size={14} />
                    <span>{editingAnnouncement ? 'Save Changes' : 'Broadcast Announcement'}</span>
                  </Button>
                </div>
              </form>
            </Card>

            {/* List */}
            <Card className="p-6">
              <h2 className="text-base font-black text-slate-950">Published Dispatches ({announcements.length})</h2>
              <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {announcements.length ? (
                  announcements.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong className="text-sm font-bold text-slate-900">{item.title}</strong>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.body}</p>
                          <p className="mt-2 text-[10px] text-slate-400">
                            Published {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingAnnouncement(item);
                              setAnnouncementInput({ title: item.title, body: item.body });
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                            title="Edit announcement"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => void handleDeleteAnnouncement(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete announcement"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-slate-400">No announcements published yet.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: LIVE-SESSION SCHEDULING */}
        {tab === 'sessions' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Form */}
            <Card className="p-6">
              <h2 className="text-base font-black text-slate-950">
                {editingSession ? 'Edit Live Session' : 'Schedule Live Review Room'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Host group critiques, timelines teardowns, and interactive Q&amp;A sessions with students.
              </p>

              <form onSubmit={handleSaveSession} className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Session Title
                  <input
                    type="text"
                    required
                    value={sessionInput.title}
                    onChange={(e) => setSessionInput({ ...sessionInput, title: e.target.value })}
                    placeholder="e.g., Live Timeline Critique & Sound Design Workshop"
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Agenda &amp; Description
                  <textarea
                    rows={3}
                    value={sessionInput.description}
                    onChange={(e) => setSessionInput({ ...sessionInput, description: e.target.value })}
                    placeholder="Topics covered, student timeline reviews, guest editors..."
                    className="mt-1.5 block w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Session Start Date &amp; Time
                    <input
                      type="datetime-local"
                      required
                      value={sessionInput.starts_at}
                      onChange={(e) => setSessionInput({ ...sessionInput, starts_at: e.target.value })}
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                    />
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Meeting URL (Zoom / Google Meet)
                    <input
                      type="url"
                      required
                      value={sessionInput.meeting_url}
                      onChange={(e) => setSessionInput({ ...sessionInput, meeting_url: e.target.value })}
                      placeholder="https://zoom.us/j/..."
                      className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {editingSession && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingSession(null);
                        setSessionInput({ title: '', description: '', starts_at: '', meeting_url: '' });
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                  <Button type="submit" size="sm" loading={savingSession} className="ml-auto">
                    <Radio size={14} />
                    <span>{editingSession ? 'Save Changes' : 'Schedule Session'}</span>
                  </Button>
                </div>
              </form>
            </Card>

            {/* List */}
            <Card className="p-6">
              <h2 className="text-base font-black text-slate-950">Scheduled Live Sessions ({sessions.length})</h2>
              <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {sessions.length ? (
                  sessions.map((item) => {
                    const sessionDate = new Date(item.starts_at);
                    const isUpcoming = sessionDate.getTime() > nowTimestamp;

                    return (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  isUpcoming ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isUpcoming ? 'Upcoming' : 'Past'}
                              </span>
                              <strong className="text-sm font-bold text-slate-900">{item.title}</strong>
                            </div>

                            {item.description && (
                              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.description}</p>
                            )}

                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <Calendar size={13} className="text-orange-500" />
                                {sessionDate.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>

                              <a
                                href={item.meeting_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-orange-600 font-bold hover:underline"
                              >
                                Test Room Link <ExternalLink size={11} />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingSession(item);
                                setSessionInput({
                                  title: item.title,
                                  description: item.description || '',
                                  starts_at: item.starts_at.slice(0, 16),
                                  meeting_url: item.meeting_url,
                                });
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                              title="Edit session"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => void handleDeleteSession(item.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete session"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-xs text-slate-400">No live sessions scheduled.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: COMMUNITY MODERATION */}
        {tab === 'community' && (
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-black text-slate-950">Community Post Moderation</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Inspect cohort discussion posts and remove spam, unconstructive remarks, or policy violations.
                </p>
              </div>

              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                {posts.length} discussions
              </span>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {posts.length ? (
                posts.map((post) => (
                  <div key={post.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 font-bold text-xs">
                        {post.author_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-slate-900">{post.author_name}</strong>
                          <span className="text-[11px] text-slate-400">({post.author_email})</span>
                          <span className="text-[10px] text-slate-400">
                            · {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{post.body}</p>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDeletePost(post.id)}
                      className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                    >
                      <Trash2 size={13} /> Remove Post
                    </Button>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-xs text-slate-400">No community posts found.</p>
              )}
            </div>
          </Card>
        )}
        </>
        )}
      </main>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] font-bold text-white">
        <Shield size={11} className="text-orange-400" /> Admin
      </span>
    );
  }
  if (role === 'mentor') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
        <ShieldCheck size={11} /> Mentor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
      Student
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card className="p-5 shadow-2xs">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-slate-100">{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{sub}</p>
    </Card>
  );
}
