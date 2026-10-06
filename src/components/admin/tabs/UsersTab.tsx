import { useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Download,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  UserX,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import { ROLE_LABELS, type AdminSubRole } from '../../../lib/adminPermissions';
import type { UserProfile } from '../../../lib/adminService';

export interface UsersTabProps {
  users: UserProfile[];
  currentUserId?: string;
  canManageRoles: boolean;
  canManageStatus: boolean;
  onRoleChange: (user: UserProfile, newRole: 'student' | 'mentor') => Promise<void>;
  onStatusChange: (user: UserProfile, newStatus: 'active' | 'suspended') => Promise<void>;
  onAdminSubRoleChange: (user: UserProfile, newAdminRole: AdminSubRole) => Promise<void>;
  onBulkUserStatus: (status: 'active' | 'suspended', selectedIds: string[]) => Promise<void>;
  onExportUsers: () => Promise<void>;
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

export function UsersTab({
  users,
  currentUserId,
  canManageRoles,
  canManageStatus,
  onRoleChange,
  onStatusChange,
  onAdminSubRoleChange,
  onBulkUserStatus,
  onExportUsers,
}: UsersTabProps) {
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'mentor' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);
  const [exportingUsersCsv, setExportingUsersCsv] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [bulkUpdatingUsers, setBulkUpdatingUsers] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
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

  const handleRole = async (targetUser: UserProfile, newRole: 'student' | 'mentor') => {
    setUpdatingUserId(targetUser.id);
    try {
      await onRoleChange(targetUser, newRole);
    } finally {
      setUpdatingUserId(null);
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

  const handleAdminSubRole = async (targetUser: UserProfile, newAdminRole: AdminSubRole) => {
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
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as typeof roleFilter);
              setUserPage(1);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="mentor">Mentors</option>
            <option value="admin">Admins</option>
          </select>

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

      {/* Bulk User Actions Bar */}
      {filteredUsers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 px-4 py-2.5">
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
                  <RoleBadge role={item.role} />

                  {/* Promotion / Demotion Actions */}
                  {canManageRoles && !isSelf && item.role === 'student' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isUpdating}
                      onClick={() => void handleRole(item, 'mentor')}
                      className="text-xs font-bold"
                    >
                      <UserCheck size={13} className="text-purple-600" /> Promote to Mentor
                    </Button>
                  )}

                  {canManageRoles && !isSelf && item.role === 'mentor' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isUpdating}
                      onClick={() => void handleRole(item, 'student')}
                      className="text-xs font-bold text-amber-700"
                    >
                      <UserMinus size={13} /> Demote to Student
                    </Button>
                  )}

                  {/* Suspend / Reactivate Actions */}
                  {canManageStatus && !isSelf && (
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

                  {item.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <ShieldCheck size={14} className="text-emerald-500" /> Admin
                      </span>
                      {canManageRoles ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-1">
                          <UserCog size={13} className="text-slate-400" />
                          <select
                            value={item.admin_role || 'super_admin'}
                            disabled={isSelf || isUpdating}
                            onChange={(e) =>
                              void handleAdminSubRole(item, e.target.value as AdminSubRole)
                            }
                            className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="content_admin">Content Admin</option>
                            <option value="operations_admin">Operations Admin</option>
                            <option value="moderator">Moderator</option>
                          </select>
                        </div>
                      ) : (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {ROLE_LABELS[item.admin_role || 'super_admin']}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-12 text-center text-xs text-slate-400">No matching users found.</p>
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

