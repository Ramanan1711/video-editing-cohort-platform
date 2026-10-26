import { useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Download,
  GraduationCap,
  Search,
  Shield,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import {
  ROLE_LABELS,
  isParentSuperAdmin,
  isChildSuperAdmin,
  type AdminSubRole,
} from '../../../lib/adminPermissions';
import type { UserProfile } from '../../../lib/adminService';

export type UserRoleTab = 'student' | 'mentor' | 'admin' | 'all';

export interface UsersTabProps {
  users: UserProfile[];
  currentUserId?: string;
  currentUserEmail?: string;
  canManageRoles: boolean;
  canManageStatus: boolean;
  isSuperAdmin?: boolean;
  onRoleChange?: (
    user: UserProfile,
    newRole: 'student' | 'mentor' | 'admin' | 'child_super_admin'
  ) => Promise<void>;
  onStatusChange: (user: UserProfile, newStatus: 'active' | 'suspended') => Promise<void>;
  onAdminSubRoleChange: (user: UserProfile, newAdminRole: AdminSubRole | null) => Promise<void>;
  onBulkUserStatus: (status: 'active' | 'suspended', selectedIds: string[]) => Promise<void>;
  onExportUsers: () => Promise<void>;
  defaultRoleTab?: UserRoleTab;
}

function RoleBadge({
  role,
  adminRole,
  userId,
  userEmail,
}: {
  role: string;
  adminRole?: AdminSubRole | string;
  userId?: string;
  userEmail?: string;
}) {
  const isParent = isParentSuperAdmin({ role, admin_role: adminRole, id: userId, email: userEmail });
  if (isParent) {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-600 px-2.5 py-0.5 text-[11px] font-black text-slate-950 shadow-xs"
      >
        <Shield size={11} className="text-slate-950 fill-slate-950" /> Parent Super Admin
      </span>
    );
  }
  const isChild = isChildSuperAdmin({ admin_role: adminRole });
  if (isChild) {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs"
      >
        <ShieldCheck size={11} className="text-white fill-white" /> Child Super Admin
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] font-bold text-white"
      >
        <Shield size={11} className="text-orange-400" /> {adminRole ? ROLE_LABELS[adminRole as AdminSubRole] || 'Admin' : 'Admin'}
      </span>
    );
  }
  if (role === 'mentor') {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-700"
      >
        <ShieldCheck size={11} /> Mentor
      </span>
    );
  }
  return (
    <span
      data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700"
    >
      Student
    </span>
  );
}

export function UsersTab({
  users,
  currentUserId,
  currentUserEmail,
  canManageRoles,
  canManageStatus,
  isSuperAdmin,
  onRoleChange: _onRoleChange,
  onStatusChange,
  onAdminSubRoleChange,
  onBulkUserStatus,
  onExportUsers,
  defaultRoleTab = 'student',
}: UsersTabProps) {
  const isParentAdminEffective =
    isParentSuperAdmin({ email: currentUserEmail, id: currentUserId }) ||
    isSuperAdmin ||
    canManageRoles;
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRoleTab>(defaultRoleTab);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);
  const [exportingUsersCsv, setExportingUsersCsv] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [bulkUpdatingUsers, setBulkUpdatingUsers] = useState(false);

  const roleCounts = useMemo(() => {
    let student = 0;
    let mentor = 0;
    let admin = 0;
    for (const u of users) {
      if (u.role === 'mentor') mentor++;
      else if (u.role === 'admin' || u.role === 'super_admin') admin++;
      else student++;
    }
    return {
      student,
      mentor,
      admin,
      all: users.length,
    };
  }, [users]);

  const roleTabs = useMemo(
    () => [
      {
        id: 'student' as const,
        label: 'Students',
        icon: GraduationCap,
        count: roleCounts.student,
        description: 'Active and enrolled students across cohort production tracks.',
      },
      {
        id: 'mentor' as const,
        label: 'Mentors',
        icon: ShieldCheck,
        count: roleCounts.mentor,
        description: 'Assigned cohort mentors providing feedback, reviews, and grading.',
      },
      {
        id: 'admin' as const,
        label: 'Admins',
        icon: Shield,
        count: roleCounts.admin,
        description: 'Platform administrators holding governance and system operations access.',
      },
      {
        id: 'all' as const,
        label: 'All Users',
        icon: Users,
        count: roleCounts.all,
        description: 'Complete cross-role platform user directory.',
      },
    ],
    [roleCounts]
  );

  const handleTabChange = (newRole: UserRoleTab) => {
    setRoleFilter(newRole);
    setUserPage(1);
    setSelectedUserIds(new Set());
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesRole =
        roleFilter === 'all' ||
        u.role === roleFilter ||
        (roleFilter === 'admin' && (u.role === 'admin' || u.role === 'super_admin'));
      const matchesStatus =
        statusFilter === 'all' || (u.status || 'active') === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  const totalUserPages = Math.ceil(filteredUsers.length / userPageSize) || 1;
  const safeUserPage = Math.min(userPage, totalUserPages);

  const pagedUsers = useMemo(() => {
    const start = (safeUserPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, safeUserPage, userPageSize]);

  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllUsers = (visibleIds: string[]) => {
    setSelectedUserIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  };

  const handleExport = async () => {
    setExportingUsersCsv(true);
    try {
      await onExportUsers();
    } finally {
      setExportingUsersCsv(false);
    }
  };

  const handleBulkStatus = async (status: 'active' | 'suspended') => {
    if (selectedUserIds.size === 0) return;
    setBulkUpdatingUsers(true);
    try {
      await onBulkUserStatus(status, Array.from(selectedUserIds));
      setSelectedUserIds(new Set());
    } finally {
      setBulkUpdatingUsers(false);
    }
  };

  const handleStatus = async (targetUser: UserProfile, newStatus: 'active' | 'suspended') => {
    setUpdatingUserId(targetUser.id);
    try {
      await onStatusChange(targetUser, newStatus);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAdminSubRole = async (targetUser: UserProfile, newAdminRole: AdminSubRole | null) => {
    setUpdatingUserId(targetUser.id);
    try {
      await onAdminSubRoleChange(targetUser, newAdminRole);
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white">User Directory &amp; Permissions</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage platform members, promote trusted editors to Mentors, or suspend abusive accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <a
              href="/admin/super-admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-500 whitespace-nowrap transition-colors"
            >
              <UserPlus size={13} />
              Register Staff
            </a>
          )}

          <Button
            variant="secondary"
            size="sm"
            loading={exportingUsersCsv}
            onClick={handleExport}
            className="text-xs font-bold"
          >
            <Download size={13} /> Export Users
          </Button>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-2xs">
            <Search size={14} className="text-slate-400" />
            <input
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-40 sm:w-56 bg-transparent outline-none text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setUserPage(1);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Role Navigation Sub-Tabs (Student, Mentor, Admin, All Users) */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3.5">
        {roleTabs.map((rt) => {
          const Icon = rt.icon;
          const isActive = roleFilter === rt.id;
          return (
            <button
              key={rt.id}
              type="button"
              data-testid={`user-role-tab-${rt.id}`}
              onClick={() => handleTabChange(rt.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30 font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
              <span>{rt.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive
                    ? 'bg-orange-600/90 text-white'
                    : 'bg-slate-200/90 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {rt.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <p>{roleTabs.find((rt) => rt.id === roleFilter)?.description}</p>
        <span className="font-mono text-[11px] font-semibold">
          Showing {filteredUsers.length} of {roleCounts[roleFilter]} {roleFilter === 'all' ? 'users' : roleFilter + 's'}
        </span>
      </div>

      {/* Bulk User Actions Bar */}
      {filteredUsers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70 px-4 py-2.5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={
                filteredUsers.filter((u) => u.id !== currentUserId).length > 0 &&
                filteredUsers
                  .filter((u) => u.id !== currentUserId)
                  .every((u) => selectedUserIds.has(u.id))
              }
              onChange={() =>
                handleToggleSelectAllUsers(
                  filteredUsers.filter((u) => u.id !== currentUserId).map((u) => u.id)
                )
              }
              className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            <span>Select All ({filteredUsers.filter((u) => u.id !== currentUserId).length})</span>
          </label>

          {selectedUserIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-orange-950 dark:text-orange-200 bg-orange-100/70 dark:bg-orange-950/70 px-2 py-1 rounded-md">
                {selectedUserIds.size} Selected
              </span>
              <Button
                variant="secondary"
                size="sm"
                loading={bulkUpdatingUsers}
                onClick={() => handleBulkStatus('active')}
                className="text-[11px] font-bold"
              >
                <CheckCircle2 size={12} className="text-emerald-600" /> Activate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={bulkUpdatingUsers}
                onClick={() => handleBulkStatus('suspended')}
                className="text-[11px] font-bold text-rose-700"
              >
                <Ban size={12} className="text-rose-600" /> Suspend
              </Button>
              <button
                type="button"
                onClick={() => setSelectedUserIds(new Set())}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-1"
              >
                Deselect
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 divide-y divide-slate-100 dark:divide-slate-800">
        {pagedUsers.length ? (
          pagedUsers.map((item) => {
            const isSelf = item.id === currentUserId;
            const isUpdating = updatingUserId === item.id;
            const isSuspended = item.status === 'suspended';

            return (
              <div key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  {!isSelf && (
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(item.id)}
                      onChange={() => handleToggleSelectUser(item.id)}
                      className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0"
                      aria-label={`Select ${item.full_name || item.email}`}
                    />
                  )}
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    {item.full_name?.charAt(0).toUpperCase() || item.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-slate-950 dark:text-white">
                        {item.full_name || 'Unnamed User'}
                      </strong>
                      {isSelf && (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          You
                        </span>
                      )}
                      {isSuspended ? (
                        <span className="rounded bg-red-100 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                          Suspended
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={item.role} adminRole={item.admin_role} userId={item.id} userEmail={item.email} />

                  {/* Suspend / Reactivate Actions */}
                  {canManageStatus && !isSelf && item.email !== 'ajayramanan17@gmail.com' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isUpdating}
                      onClick={() => void handleStatus(item, isSuspended ? 'active' : 'suspended')}
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

                  {(item.role === 'admin' || item.role === 'super_admin') && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {canManageRoles && isParentAdminEffective && !isSelf && item.email !== 'ajayramanan17@gmail.com' ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-1">
                          <UserCog size={13} className="text-slate-400" />
                          <select
                            value={item.admin_role === 'child_super_admin' ? 'child_super_admin' : 'admin'}
                            disabled={isUpdating}
                            onChange={(e) => {
                              const val = e.target.value;
                              const targetAdminRole = val === 'child_super_admin' ? 'child_super_admin' : null;
                              void handleAdminSubRole(item, targetAdminRole);
                            }}
                            className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                            data-testid={`admin-subrole-select-${item.id}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="child_super_admin">Child Super Admin</option>
                          </select>
                        </div>
                      ) : (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {item.admin_role === 'child_super_admin' ? 'Child Super Admin' : 'Admin'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 space-y-1">
            <p className="font-bold">No {roleFilter === 'all' ? 'users' : roleFilter + 's'} found.</p>
            {userSearch && (
              <p className="text-[11px] text-slate-500">Try adjusting your search criteria or clear the search query.</p>
            )}
          </div>
        )}
      </div>

      {filteredUsers.length > userPageSize && (
        <Pagination
          currentPage={safeUserPage}
          totalPages={totalUserPages}
          totalItems={filteredUsers.length}
          pageSize={userPageSize}
          onPageChange={setUserPage}
          onPageSizeChange={setUserPageSize}
        />
      )}
    </Card>
  );
}

