import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  GraduationCap,
  Layers,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import { EnrolledCohortsModal } from './EnrolledCohortsModal';
import {
  isParentSuperAdmin,
  isChildSuperAdmin,
  type AdminSubRole,
} from '../../../lib/adminPermissions';
import {
  listCohortEnrollments,
  type AdminEnrollment,
  type UserProfile,
} from '../../../lib/adminService';
import type { Cohort } from '../../../lib/courseService';

export type UserRoleTab = 'student' | 'mentor' | 'admin' | 'all';
export type StudentSegregationFilter = 'all' | 'registered' | 'enrolled';

export interface UsersTabProps {
  users: UserProfile[];
  enrollments?: AdminEnrollment[];
  cohorts?: Cohort[];
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
  if (role === 'admin' || isChildSuperAdmin({ admin_role: adminRole })) {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs"
      >
        <ShieldCheck size={11} className="text-white fill-white" /> Child Super Admin
      </span>
    );
  }
  if (role === 'mentor') {
    return (
      <span
        data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
        className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300"
      >
        <ShieldCheck size={11} /> Mentor
      </span>
    );
  }
  return (
    <span
      data-testid={userId ? `role-badge-${userId}` : 'role-badge'}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300"
    >
      Student
    </span>
  );
}

export function UsersTab({
  users,
  enrollments: enrollmentsProp,
  cohorts,
  currentUserId,
  currentUserEmail: _currentUserEmail,
  canManageRoles: _canManageRoles,
  canManageStatus,
  isSuperAdmin,
  onRoleChange: _onRoleChange,
  onStatusChange,
  onAdminSubRoleChange: _onAdminSubRoleChange,
  onBulkUserStatus,
  onExportUsers,
  defaultRoleTab = 'student',
}: UsersTabProps) {
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRoleTab>(defaultRoleTab);
  const [studentView, setStudentView] = useState<StudentSegregationFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [registeredPage, setRegisteredPage] = useState(1);
  const [enrolledPage, setEnrolledPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exportingUsersCsv, setExportingUsersCsv] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [bulkUpdatingUsers, setBulkUpdatingUsers] = useState(false);
  const [internalEnrollments, setInternalEnrollments] = useState<AdminEnrollment[]>([]);
  const [selectedCohortModalUser, setSelectedCohortModalUser] = useState<{
    student: UserProfile;
    enrollments: AdminEnrollment[];
  } | null>(null);
  const [cohortDisplayMode, setCohortDisplayMode] = useState<'compact' | 'expanded'>('compact');

  // Fetch enrollments if not passed via props
  useEffect(() => {
    if (!enrollmentsProp || enrollmentsProp.length === 0) {
      listCohortEnrollments()
        .then((data) => setInternalEnrollments(data || []))
        .catch(() => {
          // Non-blocking fallback
        });
    }
  }, [enrollmentsProp]);

  const activeEnrollments = useMemo(() => {
    return enrollmentsProp && enrollmentsProp.length > 0 ? enrollmentsProp : internalEnrollments;
  }, [enrollmentsProp, internalEnrollments]);

  // Map user_id -> enrollments
  const enrollmentsByUserMap = useMemo(() => {
    const map = new Map<string, AdminEnrollment[]>();
    for (const e of activeEnrollments) {
      if (!e.user_id) continue;
      const list = map.get(e.user_id) ?? [];
      list.push(e);
      map.set(e.user_id, list);
    }
    return map;
  }, [activeEnrollments]);

  const roleCounts = useMemo(() => {
    let student = 0;
    let mentor = 0;
    let admin = 0;
    for (const u of users) {
      if (u.role === 'mentor') mentor++;
      else if (u.role === 'admin') admin++;
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
        description: 'Directory of registered and enrolled students across cohort production tracks.',
      },
    ],
    [roleCounts.student]
  );

  const handleTabChange = (newRole: UserRoleTab) => {
    setRoleFilter(newRole);
    setRegisteredPage(1);
    setEnrolledPage(1);
    setAdminPage(1);
    setSelectedUserIds(new Set());
  };

  // Base student filter
  const studentUsers = useMemo(() => {
    return users.filter((u) => u.role === 'student' || (!['mentor', 'admin'].includes(u.role)));
  }, [users]);

  // Segregate into:
  // 1. Enrolled students: have at least one valid cohort enrollment
  // 2. Registered students: registered but not yet enrolled
  const { allRegisteredStudents, allEnrolledStudents } = useMemo(() => {
    const registered: UserProfile[] = [];
    const enrolled: UserProfile[] = [];

    for (const student of studentUsers) {
      const userEnrolls = enrollmentsByUserMap.get(student.id) ?? [];
      const hasActiveEnrollment = userEnrolls.some((e) => e.status !== 'dropped');
      if (hasActiveEnrollment) {
        enrolled.push(student);
      } else {
        registered.push(student);
      }
    }

    return {
      allRegisteredStudents: registered,
      allEnrolledStudents: enrolled,
    };
  }, [studentUsers, enrollmentsByUserMap]);

  // Filter with Search and Status filter
  const filterList = (list: UserProfile[]) => {
    return list.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesStatus =
        statusFilter === 'all' || (u.status || 'active') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  const filteredRegisteredStudents = useMemo(
    () => filterList(allRegisteredStudents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRegisteredStudents, userSearch, statusFilter]
  );

  const filteredEnrolledStudents = useMemo(
    () => filterList(allEnrolledStudents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEnrolledStudents, userSearch, statusFilter]
  );

  const nonStudentUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesStatus =
        statusFilter === 'all' || (u.status || 'active') === statusFilter;
      return matchesRole && matchesSearch && matchesStatus;
    });
  }, [users, roleFilter, userSearch, statusFilter]);

  // Pagination for Registered Students
  const totalRegisteredPages = Math.ceil(filteredRegisteredStudents.length / pageSize) || 1;
  const safeRegisteredPage = Math.min(registeredPage, totalRegisteredPages);
  const pagedRegisteredStudents = useMemo(() => {
    const start = (safeRegisteredPage - 1) * pageSize;
    return filteredRegisteredStudents.slice(start, start + pageSize);
  }, [filteredRegisteredStudents, safeRegisteredPage, pageSize]);

  // Pagination for Enrolled Students
  const totalEnrolledPages = Math.ceil(filteredEnrolledStudents.length / pageSize) || 1;
  const safeEnrolledPage = Math.min(enrolledPage, totalEnrolledPages);
  const pagedEnrolledStudents = useMemo(() => {
    const start = (safeEnrolledPage - 1) * pageSize;
    return filteredEnrolledStudents.slice(start, start + pageSize);
  }, [filteredEnrolledStudents, safeEnrolledPage, pageSize]);

  // Pagination for Non-Student Users (e.g. admins)
  const totalAdminPages = Math.ceil(nonStudentUsers.length / pageSize) || 1;
  const safeAdminPage = Math.min(adminPage, totalAdminPages);
  const pagedAdminUsers = useMemo(() => {
    const start = (safeAdminPage - 1) * pageSize;
    return nonStudentUsers.slice(start, start + pageSize);
  }, [nonStudentUsers, safeAdminPage, pageSize]);

  // Total visible students matching current filter
  const totalVisibleStudents = filteredRegisteredStudents.length + filteredEnrolledStudents.length;

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

  // Helper for rendering Student Table Row
  const renderStudentRow = (student: UserProfile, isEnrolledTable: boolean) => {
    const isSelf = student.id === currentUserId;
    const isUpdating = updatingUserId === student.id;
    const isSuspended = student.status === 'suspended';
    const userEnrollments = enrollmentsByUserMap.get(student.id) ?? [];

    return (
      <tr
        key={student.id}
        className="border-b border-slate-100 hover:bg-slate-50/60 dark:border-slate-800/80 dark:hover:bg-slate-800/40 transition-colors"
      >
        {/* Select Checkbox */}
        <td className="py-3.5 px-3 text-center align-middle">
          {!isSelf && (
            <input
              type="checkbox"
              checked={selectedUserIds.has(student.id)}
              onChange={() => handleToggleSelectUser(student.id)}
              className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              aria-label={`Select ${student.full_name || student.email}`}
            />
          )}
        </td>

        {/* Student Name & Email */}
        <td className="py-3.5 px-4 align-middle">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
              {student.full_name?.charAt(0).toUpperCase() || student.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {student.full_name || 'Unnamed Student'}
                </strong>
                {isSelf && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    You
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{student.email}</p>
            </div>
          </div>
        </td>

        {/* Contact Info (Phone / WhatsApp) */}
        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
          {student.whatsapp_number || student.phone ? (
            <div className="flex items-center gap-1.5">
              <a
                href={`https://wa.me/${(student.whatsapp_number || student.phone)?.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                title="Chat on WhatsApp / Contact student"
              >
                <Phone size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{student.whatsapp_number || student.phone}</span>
              </a>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Not provided</span>
          )}
        </td>

        {/* If Enrolled Table: Enrolled Cohorts & Enrollment Status */}
        {isEnrolledTable && (
          <>
            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
              {userEnrollments.length === 0 ? (
                <span className="text-[11px] text-slate-400">—</span>
              ) : cohortDisplayMode === 'expanded' ? (
                <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                  {userEnrollments.map((enr, idx) => (
                    <button
                      key={`${enr.cohort_id}-${idx}`}
                      type="button"
                      onClick={() =>
                        setSelectedCohortModalUser({ student, enrollments: userEnrollments })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900 border border-orange-200/80 dark:border-orange-900/60 px-2 py-0.5 text-[11px] font-semibold text-orange-800 dark:text-orange-300 cursor-pointer transition-colors"
                      title={enr.cohort_name || 'Assigned Cohort'}
                    >
                      <BookOpen size={11} className="text-orange-600 dark:text-orange-400 shrink-0" />
                      <span className="truncate max-w-[140px]">{enr.cohort_name || 'Assigned Cohort'}</span>
                    </button>
                  ))}
                </div>
              ) : userEnrollments.length === 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCohortModalUser({ student, enrollments: userEnrollments })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900 border border-orange-200/80 dark:border-orange-900/60 px-2.5 py-1 text-[11px] font-semibold text-orange-800 dark:text-orange-300 cursor-pointer transition-colors max-w-[210px] truncate group"
                  title={`${userEnrollments[0].cohort_name || 'Assigned Cohort'} (Click to view details)`}
                >
                  <BookOpen size={11} className="text-orange-600 dark:text-orange-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">{userEnrollments[0].cohort_name || 'Assigned Cohort'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCohortModalUser({ student, enrollments: userEnrollments })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900 border border-orange-200/80 dark:border-orange-900/60 px-2.5 py-1 text-[11px] font-semibold text-orange-800 dark:text-orange-300 cursor-pointer transition-colors max-w-[155px] truncate group"
                    title={userEnrollments.map((e, i) => `${i + 1}. ${e.cohort_name || 'Assigned Cohort'}`).join('\n')}
                  >
                    <BookOpen size={11} className="text-orange-600 dark:text-orange-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{userEnrollments[0].cohort_name || 'Assigned Cohort'}</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`view-cohorts-${student.id}`}
                    onClick={() =>
                      setSelectedCohortModalUser({ student, enrollments: userEnrollments })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/70 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 border border-orange-300/80 dark:border-orange-700/80 px-2 py-1 text-[10px] font-black tracking-tight transition-all cursor-pointer shadow-2xs hover:scale-105"
                    title={`Click to view all ${userEnrollments.length} enrolled courses`}
                  >
                    <span>+{userEnrollments.length - 1} more</span>
                    <Layers size={10} className="text-orange-700 dark:text-orange-300 shrink-0" />
                  </button>
                </div>
              )}
            </td>

            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
              {userEnrollments.length === 0 ? (
                <span className="text-[11px] text-slate-400">—</span>
              ) : userEnrollments.length === 1 ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    userEnrollments[0].status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                      : userEnrollments[0].status === 'completed'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {userEnrollments[0].status || 'Enrolled'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {userEnrollments.filter((e) => e.status === 'active').length === userEnrollments.length
                    ? `${userEnrollments.length} Active`
                    : `${userEnrollments.filter((e) => e.status === 'active').length} Active / ${userEnrollments.length} Total`}
                </span>
              )}
            </td>
          </>
        )}

        {/* Date (Registration or Enrollment) */}
        <td className="py-3.5 px-4 align-middle whitespace-nowrap text-slate-600 dark:text-slate-400 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} className="text-slate-400" />
            {student.created_at
              ? new Date(student.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </span>
        </td>

        {/* Account Status Badge */}
        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
          {isSuspended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
              <Ban size={10} /> Suspended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={10} /> Active
            </span>
          )}
        </td>

        {/* Actions Button */}
        <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
          {canManageStatus && !isSelf && student.email !== 'ajayramanan17@gmail.com' ? (
            <Button
              variant="secondary"
              size="sm"
              loading={isUpdating}
              onClick={() => void handleStatus(student, isSuspended ? 'active' : 'suspended')}
              className={`text-xs font-bold ${
                isSuspended ? 'text-emerald-700' : 'text-rose-600 hover:text-rose-700'
              }`}
            >
              {isSuspended ? (
                <>
                  <Check size={12} /> Reactivate
                </>
              ) : (
                <>
                  <UserX size={12} /> Suspend
                </>
              )}
            </Button>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Card className="p-6">
      {/* Top Header & Search Bar */}
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
                setRegisteredPage(1);
                setEnrolledPage(1);
                setAdminPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-40 sm:w-56 bg-transparent outline-none text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setRegisteredPage(1);
              setEnrolledPage(1);
              setAdminPage(1);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Main Role Navigation Sub-Tabs (Students) */}
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

      {/* Sub-Filters specifically for Students Segregation */}
      {roleFilter === 'student' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 p-2.5 border border-slate-200/60 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
              View:
            </span>

            <button
              type="button"
              data-testid="student-filter-all"
              onClick={() => setStudentView('all')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer select-none ${
                studentView === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users size={13} />
              <span>All Students</span>
              <span className="rounded-full bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-black text-slate-700 dark:text-slate-300">
                {studentUsers.length}
              </span>
            </button>

            <button
              type="button"
              data-testid="student-filter-registered"
              onClick={() => setStudentView('registered')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer select-none ${
                studentView === 'registered'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Registered Students</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  studentView === 'registered'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}
              >
                {allRegisteredStudents.length}
              </span>
            </button>

            <button
              type="button"
              data-testid="student-filter-enrolled"
              onClick={() => setStudentView('enrolled')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer select-none ${
                studentView === 'enrolled'
                  ? 'bg-orange-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap size={13} />
              <span>Enrolled Students</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  studentView === 'enrolled'
                    ? 'bg-orange-700 text-white'
                    : 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300'
                }`}
              >
                {allEnrolledStudents.length}
              </span>
            </button>
          </div>

          <div className="text-right text-[11px] text-slate-500 dark:text-slate-400 font-mono pr-2">
            Showing {totalVisibleStudents} matching students
          </div>
        </div>
      )}

      {/* Bulk Action Controls */}
      {selectedUserIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-orange-950 dark:text-orange-200 bg-orange-100/70 dark:bg-orange-950/70 px-2.5 py-1 rounded-md">
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
          </div>

          <button
            type="button"
            onClick={() => setSelectedUserIds(new Set())}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
          >
            Deselect All
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. STUDENT SEGREGATION TABLES                                              */}
      {/* ========================================================================= */}
      {roleFilter === 'student' && (
        <div className="mt-6 space-y-8">
          {/* A. TABLE 1: REGISTERED STUDENTS (Registered but not enrolled) */}
          {(studentView === 'all' || studentView === 'registered') && (
            <div data-testid="registered-students-section" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Registered Students
                      </h3>
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 border border-amber-200/80 dark:border-amber-900/60">
                        Registered but not enrolled
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        ({filteredRegisteredStudents.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Students who signed up on the platform but have not yet enrolled in any cohort track.
                    </p>
                  </div>
                </div>
              </div>

              {pagedRegisteredStudents.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-3xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              pagedRegisteredStudents.filter((u) => u.id !== currentUserId).length > 0 &&
                              pagedRegisteredStudents
                                .filter((u) => u.id !== currentUserId)
                                .every((u) => selectedUserIds.has(u.id))
                            }
                            onChange={() =>
                              handleToggleSelectAllUsers(
                                pagedRegisteredStudents
                                  .filter((u) => u.id !== currentUserId)
                                  .map((u) => u.id)
                              )
                            }
                            className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            aria-label="Select all registered students"
                          />
                        </th>
                        <th className="py-3 px-4 font-black">Student</th>
                        <th className="py-3 px-4 font-black">Contact</th>
                        <th className="py-3 px-4 font-black">Registered On</th>
                        <th className="py-3 px-4 font-black">Account Status</th>
                        <th className="py-3 px-4 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {pagedRegisteredStudents.map((student) => renderStudentRow(student, false))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400 bg-slate-50/30 dark:bg-slate-900/30">
                  <UserCheck size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No unregistered or unenrolled students found.</p>
                  <p className="text-[11px] text-slate-500">
                    {userSearch
                      ? 'No students without enrollments match your search query.'
                      : 'All registered students are currently enrolled in active cohort tracks.'}
                  </p>
                </div>
              )}

              {/* Pagination for Registered Students if segregated view */}
              {studentView === 'registered' && filteredRegisteredStudents.length > pageSize && (
                <Pagination
                  currentPage={safeRegisteredPage}
                  totalPages={totalRegisteredPages}
                  totalItems={filteredRegisteredStudents.length}
                  pageSize={pageSize}
                  onPageChange={setRegisteredPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          )}

          {/* B. TABLE 2: ENROLLED STUDENTS (Registered -> enrolled) */}
          {(studentView === 'all' || studentView === 'enrolled') && (
            <div data-testid="enrolled-students-section" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
                    <GraduationCap size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Enrolled Students
                      </h3>
                      <span className="rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 text-[10px] font-black px-2 py-0.5 border border-orange-200/80 dark:border-orange-900/60">
                        Registered &rarr; Enrolled
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        ({filteredEnrolledStudents.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Students who registered and successfully enrolled in one or more cohort tracks.
                    </p>
                  </div>
                </div>

                {filteredEnrolledStudents.length > 0 && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                      Display:
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                      <button
                        type="button"
                        data-testid="cohort-display-compact"
                        onClick={() => setCohortDisplayMode('compact')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          cohortDisplayMode === 'compact'
                            ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-2xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Uniform single-line rows with +N more counter"
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        data-testid="cohort-display-expanded"
                        onClick={() => setCohortDisplayMode('expanded')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          cohortDisplayMode === 'expanded'
                            ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-2xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Display all enrolled cohort chips in each row"
                      >
                        Expanded
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {pagedEnrolledStudents.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-3xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              pagedEnrolledStudents.filter((u) => u.id !== currentUserId).length > 0 &&
                              pagedEnrolledStudents
                                .filter((u) => u.id !== currentUserId)
                                .every((u) => selectedUserIds.has(u.id))
                            }
                            onChange={() =>
                              handleToggleSelectAllUsers(
                                pagedEnrolledStudents
                                  .filter((u) => u.id !== currentUserId)
                                  .map((u) => u.id)
                              )
                            }
                            className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            aria-label="Select all enrolled students"
                          />
                        </th>
                        <th className="py-3 px-4 font-black">Student</th>
                        <th className="py-3 px-4 font-black">Contact</th>
                        <th className="py-3 px-4 font-black">Enrolled Cohort(s)</th>
                        <th className="py-3 px-4 font-black">Enrollment Status</th>
                        <th className="py-3 px-4 font-black">Joined Date</th>
                        <th className="py-3 px-4 font-black">Account Status</th>
                        <th className="py-3 px-4 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {pagedEnrolledStudents.map((student) => renderStudentRow(student, true))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400 bg-slate-50/30 dark:bg-slate-900/30">
                  <GraduationCap size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No enrolled students found.</p>
                  <p className="text-[11px] text-slate-500">
                    {userSearch
                      ? 'No enrolled students match your search criteria.'
                      : 'Students who complete registration will appear here once they enroll in a cohort.'}
                  </p>
                </div>
              )}

              {/* Pagination for Enrolled Students if segregated view */}
              {studentView === 'enrolled' && filteredEnrolledStudents.length > pageSize && (
                <Pagination
                  currentPage={safeEnrolledPage}
                  totalPages={totalEnrolledPages}
                  totalItems={filteredEnrolledStudents.length}
                  pageSize={pageSize}
                  onPageChange={setEnrolledPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          )}

          {/* Empty fallback if search yields 0 across both */}
          {totalVisibleStudents === 0 && (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300">No students found.</p>
              {userSearch && (
                <p className="text-[11px] text-slate-500">
                  Try adjusting your search criteria or clear the search query.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NON-STUDENT DIRECTORY (Mentors / Admins when filtered)                 */}
      {/* ========================================================================= */}
      {roleFilter !== 'student' && (
        <div className="mt-6 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-3xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        pagedAdminUsers.filter((u) => u.id !== currentUserId).length > 0 &&
                        pagedAdminUsers
                          .filter((u) => u.id !== currentUserId)
                          .every((u) => selectedUserIds.has(u.id))
                      }
                      onChange={() =>
                        handleToggleSelectAllUsers(
                          pagedAdminUsers
                            .filter((u) => u.id !== currentUserId)
                            .map((u) => u.id)
                        )
                      }
                      className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      aria-label="Select all staff"
                    />
                  </th>
                  <th className="py-3 px-4 font-black">Staff Member</th>
                  <th className="py-3 px-4 font-black">System Role</th>
                  <th className="py-3 px-4 font-black">Account Status</th>
                  <th className="py-3 px-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pagedAdminUsers.length > 0 ? (
                  pagedAdminUsers.map((item) => {
                    const isSelf = item.id === currentUserId;
                    const isUpdating = updatingUserId === item.id;
                    const isSuspended = item.status === 'suspended';

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50/60 dark:border-slate-800/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-3 text-center align-middle">
                          {!isSelf && (
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(item.id)}
                              onChange={() => handleToggleSelectUser(item.id)}
                              className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                              aria-label={`Select ${item.full_name || item.email}`}
                            />
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                              {item.full_name?.charAt(0).toUpperCase() || item.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-xs font-bold text-slate-900 dark:text-white">
                                  {item.full_name || 'Staff User'}
                                </strong>
                                {isSelf && (
                                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <RoleBadge
                            role={item.role}
                            adminRole={item.admin_role}
                            userId={item.id}
                            userEmail={item.email}
                          />
                          {item.role === 'admin' && (
                            <span
                              data-testid={`admin-subrole-badge-${item.id}`}
                              className="ml-2 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400"
                            >
                              {isParentSuperAdmin(item) ? 'Parent Super Admin' : 'Child Super Admin'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          {isSuspended ? (
                            <span className="rounded bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                              Suspended
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                          {canManageStatus && !isSelf && item.email !== 'ajayramanan17@gmail.com' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={isUpdating}
                              onClick={() => void handleStatus(item, isSuspended ? 'active' : 'suspended')}
                              className={`text-xs font-bold ${
                                isSuspended ? 'text-emerald-700' : 'text-rose-600 hover:text-rose-700'
                              }`}
                            >
                              {isSuspended ? (
                                <>
                                  <Check size={12} /> Reactivate
                                </>
                              ) : (
                                <>
                                  <UserX size={12} /> Suspend
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                      <p className="font-bold">No {roleFilter === 'all' ? 'users' : roleFilter + 's'} found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {nonStudentUsers.length > pageSize && (
            <Pagination
              currentPage={safeAdminPage}
              totalPages={totalAdminPages}
              totalItems={nonStudentUsers.length}
              pageSize={pageSize}
              onPageChange={setAdminPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}
      {/* Enrolled Cohorts Details Modal */}
      <EnrolledCohortsModal
        isOpen={Boolean(selectedCohortModalUser)}
        onClose={() => setSelectedCohortModalUser(null)}
        student={selectedCohortModalUser?.student ?? null}
        enrollments={selectedCohortModalUser?.enrollments ?? []}
        cohorts={cohorts}
      />
    </Card>
  );
}


