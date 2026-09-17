import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Megaphone,
  MessageSquare,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/useAuth';
import {
  createAnnouncement,
  createLiveSession,
  getAdminStats,
  listAnnouncements,
  listCommunityPosts,
  listLiveSessions,
  listUsers,
  updateUserRole,
  type AdminAnnouncement,
  type AdminStats,
  type CommunityPost,
  type LiveSession,
  type UserProfile,
} from '../lib/adminService';

const emptyStats: AdminStats = { users: 0, cohorts: 0, posts: 0, pendingSubmissions: 0 };

export function AdminOperations() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [announcement, setAnnouncement] = useState({ title: '', body: '' });
  const [session, setSession] = useState({ title: '', description: '', starts_at: '', meeting_url: '' });

  const [tab, setTab] = useState<'overview' | 'users' | 'announce' | 'sessions' | 'community'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User management search & filter state
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'mentor' | 'admin'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [nextStats, nextUsers, nextAnnouncements, nextSessions, nextPosts] = await Promise.all([
        getAdminStats(),
        listUsers(),
        listAnnouncements(),
        listLiveSessions(),
        listCommunityPosts(),
      ]);
      setStats(nextStats);
      setUsers(nextUsers);
      setAnnouncements(nextAnnouncements);
      setSessions(nextSessions);
      setPosts(nextPosts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load admin data.');
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminStats(),
      listUsers(),
      listAnnouncements(),
      listLiveSessions(),
      listCommunityPosts(),
    ])
      .then(([nextStats, nextUsers, nextAnnouncements, nextSessions, nextPosts]) => {
        if (!active) return;
        setStats(nextStats);
        setUsers(nextUsers);
        setAnnouncements(nextAnnouncements);
        setSessions(nextSessions);
        setPosts(nextPosts);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load admin data.');
      });

    return () => {
      active = false;
    };
  }, []);

  if (profile?.role !== 'admin') {
    return <div className="min-h-screen bg-[#f6f7f9] p-8 text-center text-slate-600">Admin access required.</div>;
  }

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    try {
      const item = await createAnnouncement(user.id, announcement.title, announcement.body);
      setAnnouncements((current) => [item, ...current]);
      setAnnouncement({ title: '', body: '' });
      setSuccess('Announcement published successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to publish announcement.');
    }
  };

  const schedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    try {
      const item = await createLiveSession(user.id, session);
      setSessions((current) => [...current, item]);
      setSession({ title: '', description: '', starts_at: '', meeting_url: '' });
      setSuccess('Live session scheduled successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to schedule session.');
    }
  };

  const handleRoleChange = async (targetUser: UserProfile, newRole: 'student' | 'mentor') => {
    if (targetUser.id === user?.id) {
      setError('You cannot modify your own administrative role.');
      return;
    }

    const actionLabel = newRole === 'mentor' ? 'promote this student to Mentor' : 'demote this mentor back to Student';
    if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) return;

    setUpdatingUserId(targetUser.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateUserRole(targetUser.id, newRole);
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
      setSuccess(`Successfully updated ${targetUser.full_name || targetUser.email}'s role to ${newRole}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const tabs = [
    { id: 'overview' as const, label: 'Overview & Roles' },
    { id: 'announce' as const, label: 'Announcements' },
    { id: 'sessions' as const, label: 'Live sessions' },
    { id: 'community' as const, label: 'Community' },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Admin operations</p>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Keep the room moving.</h1>
              <p className="mt-2 text-sm text-slate-500">User roles, permissions, communications, and live events.</p>
            </div>
            <a href="/admin/courses" className="text-sm font-bold text-orange-600 hover:text-orange-700">
              Manage course content →
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Users size={18} />} label="Total Users" value={stats.users} />
          <Stat icon={<CalendarDays size={18} />} label="Cohorts" value={stats.cohorts} />
          <Stat icon={<MessageSquare size={18} />} label="Community posts" value={stats.posts} />
          <Stat icon={<Megaphone size={18} />} label="Pending reviews" value={stats.pendingSubmissions} />
        </div>

        <nav className="my-8 flex gap-2 overflow-x-auto border-b border-slate-200">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold transition ${
                tab === item.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* OVERVIEW & USER ROLE MANAGEMENT */}
        {tab === 'overview' && (
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-black text-slate-950">User Management &amp; Access Roles</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage student registrations and promote trusted editors to Mentors for grading submissions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-40 bg-transparent outline-none sm:w-56"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="mentor">Mentors</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {filteredUsers.length ? (
                filteredUsers.map((item) => {
                  const isSelf = item.id === user?.id;
                  const isUpdating = updatingUserId === item.id;

                  return (
                    <div key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600">
                          {item.full_name?.charAt(0).toUpperCase() || item.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-slate-900">
                              {item.full_name || 'Unnamed User'}
                            </strong>
                            {isSelf && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{item.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <RoleBadge role={item.role} />

                        {/* Promotion / Demotion Actions */}
                        {item.role === 'student' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isUpdating}
                            onClick={() => void handleRoleChange(item, 'mentor')}
                            className="text-xs font-bold"
                          >
                            <UserCheck size={14} className="text-purple-600" /> Promote to Mentor
                          </Button>
                        )}

                        {item.role === 'mentor' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={isUpdating}
                            onClick={() => void handleRoleChange(item, 'student')}
                            className="text-xs font-bold text-amber-700 hover:text-amber-800"
                          >
                            <UserMinus size={14} /> Demote to Student
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
                <p className="py-8 text-center text-xs text-slate-400">No matching users found.</p>
              )}
            </div>
          </Card>
        )}

        {/* ANNOUNCEMENTS */}
        {tab === 'announce' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <FormCard title="Publish announcement" onSubmit={publish}>
              <Field
                label="Title"
                value={announcement.title}
                onChange={(title) => setAnnouncement({ ...announcement, title })}
                required
              />
              <Field
                label="Message"
                value={announcement.body}
                onChange={(body) => setAnnouncement({ ...announcement, body })}
                required
                textarea
              />
              <Button type="submit">
                <Megaphone size={16} /> Publish
              </Button>
            </FormCard>
            <Card className="p-6">
              <h2 className="text-xl font-black text-slate-950">Recent announcements</h2>
              {announcements.map((item) => (
                <div key={item.id} className="border-b border-slate-100 py-4">
                  <p className="font-bold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.body}</p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* LIVE SESSIONS */}
        {tab === 'sessions' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <FormCard title="Schedule live session" onSubmit={schedule}>
              <Field
                label="Session title"
                value={session.title}
                onChange={(title) => setSession({ ...session, title })}
                required
              />
              <Field
                label="Description"
                value={session.description}
                onChange={(description) => setSession({ ...session, description })}
              />
              <Field
                label="Start time"
                type="datetime-local"
                value={session.starts_at}
                onChange={(starts_at) => setSession({ ...session, starts_at })}
                required
              />
              <Field
                label="Meeting URL"
                type="url"
                value={session.meeting_url}
                onChange={(meeting_url) => setSession({ ...session, meeting_url })}
                required
              />
              <Button type="submit">
                <CalendarDays size={16} /> Schedule session
              </Button>
            </FormCard>
            <Card className="p-6">
              <h2 className="text-xl font-black text-slate-950">Upcoming sessions</h2>
              {sessions.map((item) => (
                <div key={item.id} className="border-b border-slate-100 py-4">
                  <p className="font-bold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(item.starts_at).toLocaleString()}</p>
                  <a href={item.meeting_url} className="mt-2 inline-block text-sm font-bold text-orange-600">
                    Join link →
                  </a>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* COMMUNITY */}
        {tab === 'community' && (
          <Card className="p-6">
            <h2 className="text-xl font-black text-slate-950">Community posts</h2>
            <p className="mt-1 text-sm text-slate-500">Recent posts from the cohort room.</p>
            {posts.map((item) => (
              <div key={item.id} className="border-b border-slate-100 py-4">
                <p className="text-sm text-slate-700">{item.body}</p>
                <p className="mt-1 text-xs text-slate-400">Author {item.author_id}</p>
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-0.5 text-xs font-bold text-white">
        <Shield size={11} className="text-orange-400" /> Admin
      </span>
    );
  }
  if (role === 'mentor') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
        <ShieldCheck size={11} /> Mentor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
      Student
    </span>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="mb-4 text-orange-500">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

function FormCard({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="mb-5 text-xl font-black text-slate-950">{title}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
          {...props}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
          {...props}
        />
      )}
    </label>
  );
}
