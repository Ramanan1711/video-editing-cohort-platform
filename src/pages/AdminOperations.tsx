import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Award,
  Ban,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  ExternalLink,
  Flame,
  HardDrive,
  History,
  Layers,
  Lock,
  Megaphone,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UploadCloud,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { DashboardSkeleton } from '../components/ui/Skeletons';
import { StateFallback } from '../components/ui/StateFallback';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { parseDatabaseError, type AppError } from '../lib/errorHandling';
import { AdminNotificationCenter } from '../components/AdminNotificationCenter';
import { TopRightControls } from '../components/TopRightControls';
import {
  hasAdminPermission,
  ROLE_LABELS,
  type AdminPermission,
  type AdminSubRole,
} from '../lib/adminPermissions';
import {
  assignMentorToCohort,
  bulkEnrollStudents,
  bulkUpdateUserStatus,
  createAnnouncement,
  createLiveSession,
  deleteAnnouncement,
  deleteCommunityPost,
  deleteLiveSession,
  enrollUserInCohort,
  exportAuditLogsCSV,
  exportEnrollmentsCSV,
  exportSubmissionsCSV,
  exportUsersCSV,
  getAdminExecutiveMetrics,
  getAdminStats,
  getBulkEnrollmentTemplateCSV,
  listAnnouncements,
  listAuditLogs,
  listCohortEnrollments,
  listCommunityPostsWithAuthors,
  listLiveSessions,
  listMentorCohortAssignments,
  listUsers,
  removeEnrollment,
  removeMentorFromCohort,
  updateAdminSubRole,
  updateAnnouncement,
  updateEnrollmentStatus,
  updateLiveSession,
  updateUserRole,
  updateUserStatus,
  type AdminAnnouncement,
  type AdminCommunityPost,
  type AdminEnrollment,
  type AdminExecutiveMetrics,
  type AdminStats,
  type AuditLog,
  type BulkEnrollmentResponse,
  type LiveSession,
  type MentorCohortAssignment,
  type UserProfile,
} from '../lib/adminService';
import { listCohorts, type Cohort } from '../lib/courseService';
import { runSystemHealthCheck, type SystemHealthReport } from '../lib/observability/healthCheck';
import { alertManager, type OperationalAlert } from '../lib/observability/alerts';
import { getPlatformAnalytics, type PlatformAnalytics } from '../lib/observability/analytics';
import { runDeploymentCheck, type DeploymentReport, type DeploymentCheckItem } from '../lib/observability/deploymentCheck';
import { evaluateLaunchReadinessGate, type LaunchGateReport } from '../lib/observability/launchReadinessGate';

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

type AdminTab =
  | 'overview'
  | 'insights'
  | 'users'
  | 'enrollments'
  | 'announcements'
  | 'sessions'
  | 'community'
  | 'audit'
  | 'operations';

export function AdminOperations() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [execMetrics, setExecMetrics] = useState<AdminExecutiveMetrics | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User Management state
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'mentor' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkUpdatingUsers, setBulkUpdatingUsers] = useState(false);
  const [exportingUsersCsv, setExportingUsersCsv] = useState(false);
  const [exportingSubmissionsCsv, setExportingSubmissionsCsv] = useState(false);

  // Enrollment Management state
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollTargetCohortId, setEnrollTargetCohortId] = useState('');
  const [enrollingUser, setEnrollingUser] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingAuditCsv, setExportingAuditCsv] = useState(false);

  // Bulk Enrollment state
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState('');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkEnrollmentResponse | null>(null);

  // Student Removal Impact Warning state
  const [removalWarningUser, setRemovalWarningUser] = useState<{
    userId: string;
    cohortId: string;
    studentName: string;
    cohortName: string;
  } | null>(null);
  const [removingEnrollment, setRemovingEnrollment] = useState(false);

  // Audit Logs state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [selectedAuditMeta, setSelectedAuditMeta] = useState<AuditLog | null>(null);

  // Mentor Assignment state
  const [mentorAssignments, setMentorAssignments] = useState<MentorCohortAssignment[]>([]);
  const [enrollmentView, setEnrollmentView] = useState<'students' | 'mentors'>('students');
  const [removingMentorId, setRemovingMentorId] = useState<string | null>(null);
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

  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);

  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentPageSize, setEnrollmentPageSize] = useState(25);

  const [announcementPage, setAnnouncementPage] = useState(1);
  const [announcementPageSize, setAnnouncementPageSize] = useState(10);

  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);

  // Observability & Operations state
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deploymentReport, setDeploymentReport] = useState<DeploymentReport | null>(null);
  const [launchGateReport, setLaunchGateReport] = useState<LaunchGateReport | null>(null);
  const [auditingGate, setAuditingGate] = useState(false);

  const canManageRoles = hasAdminPermission(profile?.admin_role, 'manage_roles');
  const canManageStatus = hasAdminPermission(profile?.admin_role, 'manage_user_status');
  const canManageEnrollments = hasAdminPermission(profile?.admin_role, 'manage_enrollments');
  const canBroadcastAnnouncements = hasAdminPermission(profile?.admin_role, 'broadcast_announcements');
  const canScheduleSessions = hasAdminPermission(profile?.admin_role, 'schedule_sessions');
  const canModerateCommunity = hasAdminPermission(profile?.admin_role, 'moderate_community');
  const canViewAuditLogs = hasAdminPermission(profile?.admin_role, 'view_audit_logs');
  const canViewInsights = hasAdminPermission(profile?.admin_role, 'view_insights');

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
      getAdminExecutiveMetrics(),
      listAuditLogs({ limit: 100 }),
      listMentorCohortAssignments(),
    ])
      .then(([
        nextStats,
        nextUsers,
        nextCohorts,
        nextEnrollments,
        nextAnnouncements,
        nextSessions,
        nextPosts,
        nextMetrics,
        nextLogs,
        nextMentorAssignments,
      ]) => {
        if (!active) return;
        setStats(nextStats);
        setUsers(nextUsers);
        setCohorts(nextCohorts);
        setEnrollments(nextEnrollments);
        setAnnouncements(nextAnnouncements);
        setSessions(nextSessions);
        setPosts(nextPosts);
        setExecMetrics(nextMetrics);
        setAuditLogs(nextLogs);
        setMentorAssignments(nextMentorAssignments);
        setError(null);
        setAppError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const parsed = parseDatabaseError(reason);
        setAppError(parsed);
        setError(parsed.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRetrying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [profile?.role, reloadTrigger]);

  const handleRetry = () => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  };

  // --- OBSERVABILITY & OPERATIONS LIFECYCLE ---
  useEffect(() => {
    const unsubscribe = alertManager.subscribe((activeAlerts) => {
      setAlerts(activeAlerts);
    });
    return () => unsubscribe();
  }, []);

  const handleLoadOperationsData = async () => {
    setHealthChecking(true);
    setAnalyticsLoading(true);
    try {
      const [health, analytics, deployment, gate] = await Promise.all([
        runSystemHealthCheck(),
        getPlatformAnalytics(),
        Promise.resolve(runDeploymentCheck()),
        evaluateLaunchReadinessGate(),
      ]);
      setHealthReport(health);
      setPlatformAnalytics(analytics);
      setDeploymentReport(deployment);
      setLaunchGateReport(gate);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to refresh operations data');
    } finally {
      setHealthChecking(false);
      setAnalyticsLoading(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const report = await runSystemHealthCheck();
      setHealthReport(report);
      toast.success(`Health diagnostic completed: status is ${report.status.toUpperCase()}`);
    } catch {
      toast.error('Failed to run system health check');
    } finally {
      setHealthChecking(false);
    }
  };

  const handleRunLaunchGateAudit = async () => {
    setAuditingGate(true);
    try {
      const report = await evaluateLaunchReadinessGate();
      setLaunchGateReport(report);
      if (report.overallStatus === 'READY_FOR_LAUNCH') {
        toast.success(`Launch Readiness Gate: 100% Passed (${report.passedCriteria}/${report.totalCriteria} criteria certified)`);
      } else {
        toast.warning(`Launch Readiness Gate: Action required (${report.failedCriteria} criteria failed)`);
      }
    } catch {
      toast.error('Failed to evaluate launch readiness gate');
    } finally {
      setAuditingGate(false);
    }
  };

  useEffect(() => {
    if (tab !== 'operations') return;
    let active = true;

    Promise.all([
      runSystemHealthCheck(),
      getPlatformAnalytics(),
      Promise.resolve(runDeploymentCheck()),
      evaluateLaunchReadinessGate(),
    ])
      .then(([health, analytics, deployment, gate]) => {
        if (!active) return;
        setHealthReport(health);
        setPlatformAnalytics(analytics);
        setDeploymentReport(deployment);
        setLaunchGateReport(gate);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const parsed = parseDatabaseError(err);
        toast.error(parsed.message, 'Failed to refresh operations data');
      });

    return () => {
      active = false;
    };
  }, [tab, toast]);

  // --- USER ACTIONS ---
  const handleRoleChange = async (targetUser: UserProfile, newRole: 'student' | 'mentor') => {
    if (targetUser.id === user?.id) {
      setError('You cannot modify your own administrative role.');
      return;
    }
    setUpdatingUserId(targetUser.id);
    setError(null);
    try {
      const updated = await updateUserRole(targetUser.id, newRole, user?.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const msg = `Role for ${targetUser.full_name || targetUser.email} updated to ${newRole}.`;
      setSuccess(msg);
      toast.success(msg);
      void getAdminStats().then(setStats);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Role Update Failed');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAdminSubRoleChange = async (targetUser: UserProfile, newAdminRole: AdminSubRole) => {
    setUpdatingUserId(targetUser.id);
    setError(null);
    try {
      await updateAdminSubRole(targetUser.id, newAdminRole, user?.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, admin_role: newAdminRole } : u))
      );
      const msg = `Sub-role for ${targetUser.full_name || targetUser.email} set to ${newAdminRole.replace('_', ' ')}.`;
      setSuccess(msg);
      toast.success(msg);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Sub-Role Update Failed');
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
      const updated = await updateUserStatus(targetUser.id, newStatus, user?.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const msg = `Account status for ${targetUser.full_name || targetUser.email} set to ${newStatus}.`;
      setSuccess(msg);
      if (newStatus === 'suspended') toast.warning(msg);
      else toast.success(msg);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Status Update Failed');
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
      await enrollUserInCohort(enrollStudentId, enrollTargetCohortId, 'active', user?.id);
      setSuccess('Student successfully enrolled into cohort.');
      toast.success('Student successfully enrolled into cohort.');
      setShowEnrollModal(false);
      setEnrollStudentId('');
      setEnrollTargetCohortId('');
      const updatedEnrollments = await listCohortEnrollments();
      setEnrollments(updatedEnrollments);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Enrollment Failed');
    } finally {
      setEnrollingUser(false);
    }
  };

  const handleUpdateEnrollmentStatus = async (
    userId: string,
    cohortId: string,
    status: 'active' | 'completed' | 'dropped' | 'waitlisted'
  ) => {
    try {
      await updateEnrollmentStatus(userId, cohortId, status, user?.id);
      setEnrollments((prev) =>
        prev.map((item) =>
          item.user_id === userId && item.cohort_id === cohortId ? { ...item, status } : item
        )
      );
      setSuccess('Enrollment status updated.');
      toast.success(`Enrollment status set to ${status}.`);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Update Failed');
    }
  };

  const handleConfirmRemoval = async () => {
    if (!removalWarningUser) return;
    setRemovingEnrollment(true);
    setError(null);
    try {
      await removeEnrollment(removalWarningUser.userId, removalWarningUser.cohortId, user?.id);
      setEnrollments((prev) =>
        prev.filter(
          (item) =>
            !(item.user_id === removalWarningUser.userId && item.cohort_id === removalWarningUser.cohortId)
        )
      );
      const msg = `Removed ${removalWarningUser.studentName} from cohort.`;
      setSuccess(msg);
      toast.info(msg);
      setRemovalWarningUser(null);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Removal Failed');
    } finally {
      setRemovingEnrollment(false);
    }
  };

  const handleExportCSV = async () => {
    setExportingCsv(true);
    setError(null);
    try {
      const csv = await exportEnrollmentsCSV(selectedCohortId === 'all' ? undefined : selectedCohortId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cohort-enrollments-${selectedCohortId}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Enrollment CSV exported successfully.');
      toast.success('Enrollment CSV exported successfully.');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Export Failed');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportUsers = async () => {
    setExportingUsersCsv(true);
    setError(null);
    try {
      const csv = await exportUsersCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `platform-users-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('User directory CSV exported successfully.');
      toast.success('User directory CSV exported successfully.');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Export Failed');
    } finally {
      setExportingUsersCsv(false);
    }
  };

  const handleExportSubmissions = async () => {
    setExportingSubmissionsCsv(true);
    setError(null);
    try {
      const csv = await exportSubmissionsCSV(selectedCohortId === 'all' ? undefined : selectedCohortId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student-submissions-${selectedCohortId}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Submissions CSV exported successfully.');
      toast.success('Submissions CSV exported successfully.');
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Export Failed');
    } finally {
      setExportingSubmissionsCsv(false);
    }
  };

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

  const handleBulkUserStatus = async (status: 'active' | 'suspended') => {
    if (selectedUserIds.size === 0) return;
    setBulkUpdatingUsers(true);
    setError(null);
    try {
      const ids = Array.from(selectedUserIds);
      const res = await bulkUpdateUserStatus(ids, status, user?.id);
      if (res.errors.length > 0) {
        const warnMsg = `Updated ${res.updatedCount} user(s). Note: ${res.errors[0]}`;
        setError(warnMsg);
        toast.warning(warnMsg);
      } else {
        const successMsg = `Successfully updated ${res.updatedCount} user(s) to ${status}.`;
        setSuccess(successMsg);
        toast.success(successMsg);
      }
      setSelectedUserIds(new Set());
      const updated = await listUsers();
      setUsers(updated);
      void getAdminStats().then(setStats);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Bulk Update Failed');
    } finally {
      setBulkUpdatingUsers(false);
    }
  };

  const handleBulkEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCohortId || !bulkCsvText.trim()) return;
    setBulkProcessing(true);
    setError(null);
    setBulkResult(null);
    try {
      const lines = bulkCsvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const studentsToEnroll: Array<{ email: string; name?: string }> = [];

      for (const line of lines) {
        const [rawEmail, rawName] = line.split(',').map((part) => part.trim());
        if (rawEmail && rawEmail.includes('@')) {
          studentsToEnroll.push({
            email: rawEmail,
            name: rawName || undefined,
          });
        }
      }

      if (!studentsToEnroll.length) {
        throw new Error('No valid email addresses found in the provided CSV text.');
      }

      const res = await bulkEnrollStudents(bulkCohortId, studentsToEnroll, user?.id);
      setBulkResult(res);
      setSuccess(
        `Bulk enrollment processed: ${res.added} enrolled directly, ${res.invitations || 0} pre-enrollment invitations recorded, ${res.skipped} skipped.`
      );
      const updatedEnrollments = await listCohortEnrollments();
      setEnrollments(updatedEnrollments);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process bulk enrollment.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExportAuditCSV = async () => {
    setExportingAuditCsv(true);
    try {
      const csv = await exportAuditLogsCSV(auditActionFilter === 'all' ? undefined : auditActionFilter);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Audit trail CSV exported successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit trail CSV.');
    } finally {
      setExportingAuditCsv(false);
    }
  };

  const handleDownloadBulkTemplate = () => {
    const template = getBulkEnrollmentTemplateCSV();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_bulk_enrollment_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setBulkCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignMentorId || !assignCohortId) return;
    try {
      setAssigningMentor(true);
      await assignMentorToCohort(assignMentorId, assignCohortId, user?.id);
      setSuccess('Mentor successfully assigned to cohort.');
      setShowAssignMentorModal(false);
      setAssignMentorId('');
      setAssignCohortId('');
      const updated = await listMentorCohortAssignments();
      setMentorAssignments(updated);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign mentor to cohort.');
    } finally {
      setAssigningMentor(false);
    }
  };

  const handleRemoveMentor = async (mentorId: string, cohortId: string, mentorName: string, cohortName: string) => {
    if (
      !window.confirm(
        `Remove mentor ${mentorName} from ${cohortName}? They will immediately lose access to review submissions in this cohort.`
      )
    ) {
      return;
    }
    try {
      setRemovingMentorId(`${mentorId}-${cohortId}`);
      await removeMentorFromCohort(mentorId, cohortId, user?.id);
      setSuccess(`Removed ${mentorName} from ${cohortName}.`);
      const updated = await listMentorCohortAssignments();
      setMentorAssignments(updated);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove mentor from cohort.');
    } finally {
      setRemovingMentorId(null);
    }
  };

  // --- ANNOUNCEMENT ACTIONS ---
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!canBroadcastAnnouncements) {
      setError('You do not hold permission to broadcast announcements.');
      return;
    }
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
    if (!canBroadcastAnnouncements) {
      setError('You do not hold permission to delete announcements.');
      return;
    }
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
    if (!canScheduleSessions) {
      setError('You do not hold permission to schedule live sessions.');
      return;
    }
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
    if (!canScheduleSessions) {
      setError('You do not hold permission to delete live sessions.');
      return;
    }
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

  // Filtered Mentor Cohort Assignments
  const filteredMentorAssignments = useMemo(() => {
    if (selectedCohortId === 'all') return mentorAssignments;
    return mentorAssignments.filter((m) => m.cohort_id === selectedCohortId);
  }, [mentorAssignments, selectedCohortId]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = auditSearch.toLowerCase();
      const matchesSearch =
        q === '' ||
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
        (log.actor?.full_name && log.actor.full_name.toLowerCase().includes(q)) ||
        (log.actor?.email && log.actor.email.toLowerCase().includes(q));

      const matchesAction = auditActionFilter === 'all' || log.action.includes(auditActionFilter);
      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  // Paginated Slices with safe clamped pages
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const pagedUsers = useMemo(() => {
    const start = (safeUserPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, safeUserPage, userPageSize]);

  const totalEnrollmentPages = Math.max(1, Math.ceil(filteredEnrollments.length / enrollmentPageSize));
  const safeEnrollmentPage = Math.min(enrollmentPage, totalEnrollmentPages);
  const pagedEnrollments = useMemo(() => {
    const start = (safeEnrollmentPage - 1) * enrollmentPageSize;
    return filteredEnrollments.slice(start, start + enrollmentPageSize);
  }, [filteredEnrollments, safeEnrollmentPage, enrollmentPageSize]);

  const totalAnnouncementPages = Math.max(1, Math.ceil(announcements.length / announcementPageSize));
  const safeAnnouncementPage = Math.min(announcementPage, totalAnnouncementPages);
  const pagedAnnouncements = useMemo(() => {
    const start = (safeAnnouncementPage - 1) * announcementPageSize;
    return announcements.slice(start, start + announcementPageSize);
  }, [announcements, safeAnnouncementPage, announcementPageSize]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditLogs.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAuditLogs = useMemo(() => {
    const start = (safeAuditPage - 1) * auditPageSize;
    return filteredAuditLogs.slice(start, start + auditPageSize);
  }, [filteredAuditLogs, safeAuditPage, auditPageSize]);

  const tabs: { id: AdminTab; label: string; count?: number; permission?: AdminPermission }[] = [
    { id: 'overview', label: 'Summary Dashboard' },
    {
      id: 'insights',
      label: 'Executive Insights',
      count: canViewInsights ? execMetrics?.atRiskLearners.length : undefined,
      permission: 'view_insights',
    },
    { id: 'users', label: 'User Roles & Status', count: users.length, permission: 'manage_roles' },
    { id: 'enrollments', label: 'Cohort Enrollments', count: enrollments.length, permission: 'manage_enrollments' },
    { id: 'announcements', label: 'Announcements', count: announcements.length, permission: 'broadcast_announcements' },
    { id: 'sessions', label: 'Live Sessions', count: sessions.length, permission: 'schedule_sessions' },
    { id: 'community', label: 'Community Moderation', count: posts.length, permission: 'moderate_community' },
    { id: 'audit', label: 'Audit Logs', count: canViewAuditLogs ? auditLogs.length : undefined, permission: 'view_audit_logs' },
    { id: 'operations', label: 'Operations & Health', count: alerts.length > 0 ? alerts.length : undefined },
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
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="pl-12 sm:pl-14 lg:pl-0 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-slate-950 text-white shadow-2xs">
                  <Shield size={16} />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Administration Control Room</p>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Operations &amp; Governance</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                User roles, cohort enrollments, broadcast communications, live mentorship sessions, and moderation.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
              <span className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 shadow-2xs whitespace-nowrap dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <ShieldCheck size={14} className="text-orange-500" />
                <span>{ROLE_LABELS[profile?.admin_role || 'super_admin']}</span>
              </span>

              <AdminNotificationCenter onNavigateTab={(t) => setTab(t as AdminTab)} />

              <Link
                to="/admin/courses"
                className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 whitespace-nowrap dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Course Studio →
              </Link>
              <Link
                to="/review/submissions"
                className="inline-flex h-9 items-center rounded-xl bg-slate-950 px-3.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 whitespace-nowrap dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Review Room →
              </Link>

              <TopRightControls />
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
          {tabs.map((item) => {
            const hasAccess = !item.permission || hasAdminPermission(profile?.admin_role, item.permission);
            if (!hasAccess && item.id === 'audit') return null;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (hasAccess) {
                    setTab(item.id);
                  } else {
                    setError(
                      `Your sub-role (${ROLE_LABELS[profile?.admin_role || 'super_admin']}) does not hold the "${item.label}" administrative privilege.`
                    );
                  }
                }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 transition ${
                  tab === item.id
                    ? 'bg-orange-500 text-white shadow-2xs font-black'
                    : hasAccess
                    ? 'text-slate-600 hover:bg-slate-200/60'
                    : 'text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                {!hasAccess && <Lock size={12} className="text-slate-400" />}
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      tab === item.id ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {loading ? (
          <DashboardSkeleton cardsCount={4} showChart={true} />
        ) : appError && stats.users === 0 ? (
          <StateFallback
            appError={appError}
            actionText="Retry Operations Console"
            onAction={handleRetry}
            isRetrying={retrying}
          />
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

            {/* Actionable Executive Intelligence */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Activity size={16} className="text-orange-500" /> Executive Analytics &amp; Academy Health
                  </h2>
                  <p className="text-xs text-slate-500">Real-time conversion, completion velocity, and operational bottlenecks.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Enrollment Conversion</span>
                    <TrendingUp size={15} className="text-emerald-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {execMetrics ? `${execMetrics.enrollmentConversionRate}%` : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">of registered</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, execMetrics?.enrollmentConversionRate ?? 0)}%` }}
                    />
                  </div>
                </Card>

                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Course Completion</span>
                    <CheckCircle2 size={15} className="text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {execMetrics ? `${execMetrics.courseCompletionRate}%` : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">graduation rate</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, execMetrics?.courseCompletionRate ?? 0)}%` }}
                    />
                  </div>
                </Card>

                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Avg Review Turnaround</span>
                    <Clock size={15} className="text-purple-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {execMetrics?.avgMentorReviewHours != null ? `${execMetrics.avgMentorReviewHours}h` : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">submission to review</span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {execMetrics?.avgMentorReviewHours && execMetrics.avgMentorReviewHours < 24
                      ? '⚡ Rapid mentor turnaround'
                      : 'Target SLA: under 24 hours'}
                  </p>
                </Card>

                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Dropout Risk Flags</span>
                    <AlertTriangle size={15} className={(execMetrics?.dropoutRiskCount ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className={`text-2xl font-black ${(execMetrics?.dropoutRiskCount ?? 0) > 0 ? 'text-amber-600' : 'text-slate-950'}`}>
                      {execMetrics ? execMetrics.dropoutRiskCount : '0'}
                    </span>
                    <span className="text-[11px] text-slate-400">students flagged</span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {(execMetrics?.dropoutRiskCount ?? 0) > 0
                      ? 'Stalled > 7 days or ≥ 2 revisions'
                      : '✓ All learners pacing on schedule'}
                  </p>
                </Card>
              </div>
            </div>

            {/* Review Aging & Active User Velocity Row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Review Aging Distribution */}
              <Card className="p-5 border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                      <Clock size={15} className="text-orange-500" /> Pending Review Aging
                    </h3>
                    <p className="text-xs text-slate-500">Turnaround queue age for submitted student cuts.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {stats.pendingSubmissions} total queue
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase text-emerald-800">&lt; 12h</span>
                    <strong className="mt-1 block text-lg font-black text-emerald-700">
                      {execMetrics?.reviewAging.lessThan12h ?? 0}
                    </strong>
                    <span className="text-[10px] text-emerald-600 font-semibold">Fresh</span>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase text-blue-800">12 - 24h</span>
                    <strong className="mt-1 block text-lg font-black text-blue-700">
                      {execMetrics?.reviewAging.between12and24h ?? 0}
                    </strong>
                    <span className="text-[10px] text-blue-600 font-semibold">Normal</span>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase text-amber-800">24 - 48h</span>
                    <strong className="mt-1 block text-lg font-black text-amber-700">
                      {execMetrics?.reviewAging.between24and48h ?? 0}
                    </strong>
                    <span className="text-[10px] text-amber-600 font-semibold">Warning</span>
                  </div>
                  <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase text-red-800">&gt; 48h</span>
                    <strong className="mt-1 block text-lg font-black text-red-700">
                      {execMetrics?.reviewAging.over48h ?? 0}
                    </strong>
                    <span className="text-[10px] text-red-600 font-semibold">Overdue</span>
                  </div>
                </div>
              </Card>

              {/* Active Users Velocity */}
              <Card className="p-5 border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                    <Flame size={15} className="text-orange-500" /> Platform User Activity
                  </h3>
                  <p className="text-xs text-slate-500">Learners and mentors actively logging in or submitting.</p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-center">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">7 Days</span>
                    <strong className="mt-1 block text-xl font-black text-slate-950">
                      {execMetrics?.activeUsers7d ?? 0}
                    </strong>
                    <span className="text-[10px] text-emerald-600 font-semibold">Active members</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-center">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">30 Days</span>
                    <strong className="mt-1 block text-xl font-black text-slate-950">
                      {execMetrics?.activeUsers30d ?? 0}
                    </strong>
                    <span className="text-[10px] text-blue-600 font-semibold">Monthly active</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-center">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">90 Days</span>
                    <strong className="mt-1 block text-xl font-black text-slate-950">
                      {execMetrics?.activeUsers90d ?? 0}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-semibold">Quarterly active</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Cohort Comparison Matrix */}
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                    <Layers size={15} className="text-orange-500" /> Cohort Performance Comparison Matrix
                  </h3>
                  <p className="text-xs text-slate-500">Benchmarking capacity, fill rate, completion, and submission velocity.</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setTab('enrollments')}
                  className="text-xs font-bold"
                >
                  Manage Rosters →
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Cohort</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Enrollment / Capacity</th>
                      <th className="py-2.5 px-3">Fill Rate</th>
                      <th className="py-2.5 px-3">Completion</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {execMetrics?.cohortComparisons?.length ? (
                      execMetrics.cohortComparisons.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-3">
                            <strong className="text-slate-950 font-bold block">{c.name}</strong>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                c.status === 'published'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : c.status === 'draft'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {c.enrolledCount} / {c.capacity} students
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${
                                    c.fillPct >= 90 ? 'bg-orange-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, c.fillPct)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-600">{c.fillPct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900">{c.completionPct}%</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedCohortId(c.id);
                                setTab('enrollments');
                              }}
                              className="text-[11px] font-bold text-orange-600 hover:underline"
                            >
                              View Roster →
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No cohorts recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

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

            {/* Live Operational Activity Stream */}
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    <Activity size={15} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">Live Operational Activity Stream</h3>
                    <p className="text-xs text-slate-500">Real-time platform operations and system events across all cohorts.</p>
                  </div>
                </div>
                {canViewAuditLogs && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setTab('audit')}
                    className="text-xs font-bold"
                  >
                    View Complete Audit Trail →
                  </Button>
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {auditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                        {log.action.startsWith('user') ? (
                          <UserCheck size={14} />
                        ) : log.action.startsWith('cohort') ? (
                          <Layers size={14} />
                        ) : log.action.startsWith('announcement') ? (
                          <Megaphone size={14} />
                        ) : (
                          <Activity size={14} />
                        )}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">
                          <span className="font-semibold text-slate-600">{log.actor_name || 'System'}</span>:{' '}
                          <span className="capitalize">{log.action.replace(/\./g, ' › ').replace(/_/g, ' ')}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {log.entity_type} {log.entity_id ? `• ${log.entity_id.slice(0, 8)}...` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
                {!auditLogs.length && (
                  <p className="py-6 text-center text-xs text-slate-400">No operational activities recorded recently.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: EXECUTIVE INSIGHTS & ATTRITION DRILLDOWN */}
        {tab === 'insights' && (
          <div className="space-y-8">
            {/* Insights KPI Row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4 border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Overall Cohort Churn</span>
                  <AlertTriangle size={15} className="text-rose-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-600">
                    {execMetrics?.overallChurnRatePct ?? 0}%
                  </span>
                  <span className="text-[11px] text-slate-400">drop rate</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Calculated across all dropped student enrollments.
                </p>
              </Card>

              <Card className="p-4 border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>At-Risk Learners</span>
                  <Users size={15} className="text-amber-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-600">
                    {execMetrics?.atRiskLearners.length ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-400">students stalled</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Stalled &gt; 7 days or ≥ 2 revision requests.
                </p>
              </Card>

              <Card className="p-4 border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Curriculum Modules</span>
                  <BookOpen size={15} className="text-blue-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-950">
                    {execMetrics?.curriculumDropOff.length ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-400">active modules</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Tracking milestone completion velocity.
                </p>
              </Card>

              <Card className="p-4 border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Active Mentors</span>
                  <Award size={15} className="text-purple-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-950">
                    {execMetrics?.mentorLeaderboard.length ?? 0}
                  </span>
                  <span className="text-[11px] text-slate-400">reviewers on staff</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Avg turnaround: {execMetrics?.avgMentorReviewHours != null ? `${execMetrics.avgMentorReviewHours}h` : '—'}
                </p>
              </Card>
            </div>

            {/* Section 1: At-Risk Learners Table (Dropout Risk Drilldown) */}
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
                      <AlertTriangle size={15} />
                    </span>
                    <h2 className="text-base font-black text-slate-950">
                      At-Risk Student Intervention Roster ({execMetrics?.atRiskLearners.length ?? 0})
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Learners showing inactivity or friction patterns requiring mentor or administrative check-ins.
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Cohort</th>
                      <th className="py-2.5 px-3">Inactivity</th>
                      <th className="py-2.5 px-3">Revisions</th>
                      <th className="py-2.5 px-3">Risk Factor</th>
                      <th className="py-2.5 px-3 text-right">Intervention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {execMetrics?.atRiskLearners.length ? (
                      execMetrics.atRiskLearners.map((student) => (
                        <tr key={student.studentId} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-3">
                            <strong className="text-slate-900 block">{student.studentName}</strong>
                            <span className="text-[11px] text-slate-400">{student.studentEmail}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              {student.cohortName}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <span className="font-bold text-amber-700">{student.daysInactive} days</span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={
                                student.resubmissionsCount >= 2
                                  ? 'text-rose-600 font-bold'
                                  : 'text-slate-600'
                              }
                            >
                              {student.resubmissionsCount} pending revisions
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                student.riskReason === 'multiple_resubmissions'
                                  ? 'bg-rose-100 text-rose-800'
                                  : student.riskReason === 'stalled_inactivity'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {student.riskReason.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const message = `Hi ${student.studentName}, checking in from CUT / CRAFT! We noticed you haven't been active in ${student.cohortName} lately. Do you need help with your current timeline cut or feedback revisions?`;
                                navigator.clipboard.writeText(message);
                                setSuccess(`Check-in message copied to clipboard for ${student.studentName}!`);
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-orange-600"
                            >
                              Copy Check-in Note
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          ✓ No learners currently flagged as at-risk.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Section 2: Curriculum Drop-Off Funnel & Cohort Churn */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Curriculum Funnel */}
              <Card className="p-6">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                  <Layers size={16} className="text-orange-500" /> Curriculum Drop-Off Funnel
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Module-by-module completion rates across all enrolled students to identify pedagogical bottlenecks.
                </p>

                <div className="mt-5 space-y-4">
                  {execMetrics?.curriculumDropOff.length ? (
                    execMetrics.curriculumDropOff.map((m) => (
                      <div key={m.moduleId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-900">
                            Module {m.position}: {m.moduleTitle}
                          </span>
                          <span className="text-slate-600 font-mono">{m.completionRatePct}% complete</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              m.completionRatePct >= 75
                                ? 'bg-emerald-500'
                                : m.completionRatePct >= 40
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.max(4, m.completionRatePct)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{m.lessonCount} lessons</span>
                          <span>{m.stalledStudentCount} students yet to complete</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-400">No modules found.</p>
                  )}
                </div>
              </Card>

              {/* Cohort Churn Breakdown */}
              <Card className="p-6">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                  <Activity size={16} className="text-rose-500" /> Cohort Attrition &amp; Retention
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Active vs completed vs dropped student distribution by cohort.
                </p>

                <div className="mt-5 space-y-4">
                  {execMetrics?.cohortChurn.length ? (
                    execMetrics.cohortChurn.map((c) => (
                      <div key={c.cohortId} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-bold text-slate-900">{c.cohortName}</strong>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              c.churnRatePct >= 20
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {c.churnRatePct}% Churn
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
                          <div className="rounded bg-white p-2 shadow-3xs">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Enrolled</span>
                            <strong className="text-slate-900 font-bold">{c.totalEnrolled}</strong>
                          </div>
                          <div className="rounded bg-white p-2 shadow-3xs">
                            <span className="block text-[10px] text-emerald-600 font-bold uppercase">Active</span>
                            <strong className="text-emerald-700 font-bold">{c.activeCount}</strong>
                          </div>
                          <div className="rounded bg-white p-2 shadow-3xs">
                            <span className="block text-[10px] text-blue-600 font-bold uppercase">Graduated</span>
                            <strong className="text-blue-700 font-bold">{c.completedCount}</strong>
                          </div>
                          <div className="rounded bg-white p-2 shadow-3xs">
                            <span className="block text-[10px] text-rose-600 font-bold uppercase">Dropped</span>
                            <strong className="text-rose-700 font-bold">{c.droppedCount}</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-400">No cohort data available.</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Section 3: Mentor Performance & SLA Review Velocity */}
            <Card className="p-6">
              <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                <Clock size={16} className="text-purple-500" /> Mentor Review Performance &amp; SLA Velocity
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Review turnaround velocity, critique output, and revision request ratios across mentoring staff.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Mentor</th>
                      <th className="py-2.5 px-3">Total Reviews Completed</th>
                      <th className="py-2.5 px-3">Avg Turnaround Time</th>
                      <th className="py-2.5 px-3">SLA Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {execMetrics?.mentorLeaderboard.length ? (
                      execMetrics.mentorLeaderboard.map((m) => (
                        <tr key={m.mentorId} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-3">
                            <strong className="text-slate-900 block">{m.mentorName}</strong>
                            <span className="text-[11px] text-slate-400">{m.mentorEmail}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <span className="font-bold text-slate-950">{m.reviewsCount}</span> critiques
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {m.avgTurnaroundHours != null ? `${m.avgTurnaroundHours} hours` : '—'}
                          </td>
                          <td className="py-3 px-3">
                            {m.avgTurnaroundHours != null ? (
                              m.avgTurnaroundHours <= 24 ? (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                                  ✓ Rapid SLA
                                </span>
                              ) : (
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                                  SLA Warning (&gt;24h)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[10px]">No reviews yet</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No mentor performance recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                <Button
                  variant="secondary"
                  size="sm"
                  loading={exportingUsersCsv}
                  onClick={handleExportUsers}
                  className="text-xs font-bold"
                >
                  <Download size={13} /> Export Users
                </Button>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Only</option>
                </select>
              </div>
            </div>

            {/* Bulk User Actions Bar */}
            {filteredUsers.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      filteredUsers.filter((u) => u.id !== user?.id).length > 0 &&
                      filteredUsers
                        .filter((u) => u.id !== user?.id)
                        .every((u) => selectedUserIds.has(u.id))
                    }
                    onChange={() =>
                      handleToggleSelectAllUsers(
                        filteredUsers.filter((u) => u.id !== user?.id).map((u) => u.id)
                      )
                    }
                    className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Select All ({filteredUsers.filter((u) => u.id !== user?.id).length})</span>
                </label>

                {selectedUserIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-orange-950 bg-orange-100/70 px-2 py-1 rounded-md">
                      {selectedUserIds.size} Selected
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={bulkUpdatingUsers}
                      onClick={() => handleBulkUserStatus('active')}
                      className="text-[11px] font-bold"
                    >
                      <CheckCircle2 size={12} className="text-emerald-600" /> Activate
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={bulkUpdatingUsers}
                      onClick={() => handleBulkUserStatus('suspended')}
                      className="text-[11px] font-bold text-rose-700"
                    >
                      <Ban size={12} className="text-rose-600" /> Suspend
                    </Button>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds(new Set())}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline ml-1"
                    >
                      Deselect
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 divide-y divide-slate-100">
              {pagedUsers.length ? (
                pagedUsers.map((item) => {
                  const isSelf = item.id === user?.id;
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
                        {canManageRoles && !isSelf && item.role === 'student' && (
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

                        {canManageRoles && !isSelf && item.role === 'mentor' && (
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
                        {canManageStatus && !isSelf && (
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
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                              <ShieldCheck size={14} className="text-emerald-500" /> Admin
                            </span>
                            {canManageRoles ? (
                              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                                <UserCog size={13} className="text-slate-400" />
                                <select
                                  value={item.admin_role || 'super_admin'}
                                  disabled={isSelf || isUpdating}
                                  onChange={(e) =>
                                    void handleAdminSubRoleChange(item, e.target.value as AdminSubRole)
                                  }
                                  className="bg-transparent text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                                >
                                  <option value="super_admin">Super Admin</option>
                                  <option value="content_admin">Content Admin</option>
                                  <option value="operations_admin">Operations Admin</option>
                                  <option value="moderator">Moderator</option>
                                </select>
                              </div>
                            ) : (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
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
                    onChange={(e) => {
                      setSelectedCohortId(e.target.value);
                      setEnrollmentPage(1);
                    }}
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
                  loading={exportingCsv}
                  onClick={() => void handleExportCSV()}
                  className="text-xs font-bold"
                  title="Export cohort enrollments as CSV"
                >
                  <Download size={14} /> Export CSV
                  <Download size={14} /> Export Enrollments
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  loading={exportingSubmissionsCsv}
                  onClick={() => void handleExportSubmissions()}
                  className="text-xs font-bold"
                  title="Export student submissions as CSV"
                >
                  <Download size={14} /> Export Submissions
                </Button>

                {canManageEnrollments && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setBulkCohortId(selectedCohortId !== 'all' ? selectedCohortId : (cohorts[0]?.id || ''));
                        setShowBulkEnrollModal(true);
                        setBulkResult(null);
                        setBulkCsvText('');
                      }}
                      className="text-xs font-bold"
                    >
                      <UploadCloud size={14} /> Bulk CSV Import
                    </Button>

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
                  </>
                )}
              </div>
            </div>

            {/* View Selector: Student Rosters vs Mentor Cohort Scoping */}
            <div className="mt-5 flex gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setEnrollmentView('students')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  enrollmentView === 'students'
                    ? 'bg-orange-500 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Student Rosters ({filteredEnrollments.length})
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentView('mentors')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  enrollmentView === 'mentors'
                    ? 'bg-orange-500 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={13} />
                Mentor Scoping &amp; Staffing ({filteredMentorAssignments.length})
              </button>
            </div>

            {/* View 1: Student Enrollments */}
            {enrollmentView === 'students' && (
              <div className="mt-6 divide-y divide-slate-100">
                {pagedEnrollments.length ? (
                  pagedEnrollments.map((item) => (
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
                          disabled={!canManageEnrollments}
                          onChange={(e) =>
                            void handleUpdateEnrollmentStatus(
                              item.user_id,
                              item.cohort_id,
                              e.target.value as 'active' | 'completed' | 'dropped' | 'waitlisted'
                            )
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold outline-none ${
                            !canManageEnrollments ? 'cursor-not-allowed opacity-75 ' : ''
                          }${
                            item.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : item.status === 'completed'
                              ? 'border-purple-200 bg-purple-50 text-purple-800'
                              : item.status === 'waitlisted'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="dropped">Dropped</option>
                          <option value="waitlisted">Waitlisted</option>
                        </select>

                        {canManageEnrollments && (
                          <button
                            onClick={() =>
                              setRemovalWarningUser({
                                userId: item.user_id,
                                cohortId: item.cohort_id,
                                studentName: item.student_name,
                                cohortName: item.cohort_name,
                              })
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Remove from cohort"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-12 text-center text-xs text-slate-400">No student enrollments found for this filter.</p>
                )}

                {filteredEnrollments.length > enrollmentPageSize && (
                  <div className="pt-2">
                    <Pagination
                      currentPage={safeEnrollmentPage}
                      totalPages={totalEnrollmentPages}
                      totalItems={filteredEnrollments.length}
                      pageSize={enrollmentPageSize}
                      onPageChange={setEnrollmentPage}
                      onPageSizeChange={setEnrollmentPageSize}
                    />
                  </div>
                )}
              </div>
            )}

            {/* View 2: Mentor Cohort Scoping */}
            {enrollmentView === 'mentors' && (
              <div className="mt-6">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-black text-slate-950">Mentor Cohort Scoping &amp; Staffing</h3>
                    <p className="text-xs text-slate-500">
                      Assigned mentors are strictly isolated to review submissions and student rosters within their designated cohorts.
                    </p>
                  </div>
                  {canManageEnrollments && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setShowAssignMentorModal(true)}
                      className="text-xs font-bold shrink-0"
                    >
                      <Sparkles size={14} /> Assign Mentor to Cohort
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Mentor</th>
                        <th className="py-2.5 px-3">Assigned Cohort</th>
                        <th className="py-2.5 px-3">Access Scope</th>
                        <th className="py-2.5 px-3">Assigned Date</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredMentorAssignments.length ? (
                        filteredMentorAssignments.map((assignment) => (
                          <tr key={`${assignment.mentor_id}-${assignment.cohort_id}`} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-orange-100 font-bold text-orange-700 text-xs">
                                  {assignment.mentor?.full_name?.[0] || 'M'}
                                </div>
                                <div>
                                  <strong className="text-slate-900 block font-bold">
                                    {assignment.mentor?.full_name || 'Mentor'}
                                  </strong>
                                  <span className="text-[11px] text-slate-400">{assignment.mentor?.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200/60">
                                {assignment.cohort?.name || 'Cohort'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                <ShieldCheck size={11} className="text-emerald-600" /> RLS &amp; RPC Scoped
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {assignment.assigned_at
                                ? new Date(assignment.assigned_at).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Active'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {canManageEnrollments && (
                                <button
                                  type="button"
                                  disabled={removingMentorId === `${assignment.mentor_id}-${assignment.cohort_id}`}
                                  onClick={() =>
                                    void handleRemoveMentor(
                                      assignment.mentor_id,
                                      assignment.cohort_id,
                                      assignment.mentor?.full_name || 'Mentor',
                                      assignment.cohort?.name || 'Cohort'
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Unassign mentor from cohort"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400">
                            No mentor cohort assignments found for this filter. Click &ldquo;Assign Mentor&rdquo; above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

            {/* Bulk CSV Enrollment Modal */}
            {showBulkEnrollModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
                <form
                  onSubmit={handleBulkEnroll}
                  className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <UploadCloud className="text-orange-500" size={18} />
                      <h3 className="text-base font-black text-slate-950">Bulk CSV Student Enrollment</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBulkEnrollModal(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Target Cohort
                      <select
                        value={bulkCohortId}
                        onChange={(e) => setBulkCohortId(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400"
                      >
                        <option value="">Choose target cohort...</option>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          CSV Data (email, full_name)
                        </label>
                        <button
                          type="button"
                          onClick={handleDownloadBulkTemplate}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          <Download size={12} /> Download CSV Template
                        </button>
                      </div>

                      <div className="mt-1.5 mb-2.5 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-2.5">
                        <UploadCloud size={16} className="text-slate-400 shrink-0" />
                        <div className="flex-1 text-[11px] text-slate-600">
                          <label className="cursor-pointer font-bold text-orange-600 hover:underline">
                            <span>Upload .csv file</span>
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              onChange={handleBulkFileUpload}
                              className="sr-only"
                            />
                          </label>
                          <span className="text-slate-400 ml-1">or paste rows directly below</span>
                        </div>
                      </div>

                      <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                        Format: One entry per line. Example: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">alex@example.com, Alex Turner</code>
                      </p>
                      <textarea
                        rows={5}
                        required
                        value={bulkCsvText}
                        onChange={(e) => setBulkCsvText(e.target.value)}
                        placeholder={`jane@example.com, Jane Doe\njohn@example.com, John Smith\nsam@example.com`}
                        className="mt-1.5 block w-full resize-none font-mono text-xs rounded-xl border border-slate-200 p-2.5 outline-none focus:border-orange-400"
                      />
                    </div>

                    {bulkResult && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
                        <p className="font-bold text-emerald-800">
                          ✓ Bulk Enrollment Completed: {bulkResult.added} enrolled directly, {bulkResult.invitations || 0} pre-enrollment invitations recorded, {bulkResult.skipped} already enrolled/skipped.
                        </p>
                        {bulkResult.errors.length > 0 && (
                          <ul className="mt-1.5 list-disc pl-4 text-[11px] text-red-600">
                            {bulkResult.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setShowBulkEnrollModal(false)}
                    >
                      Close
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={bulkProcessing}>
                      <UploadCloud size={14} /> Process Enrollments
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Student Removal Impact Warning Modal */}
            {removalWarningUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-600 shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-950">Confirm Student Removal</h3>
                      <p className="text-xs text-slate-500">Irreversible roster membership modification</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 text-xs text-slate-600 leading-relaxed">
                    <p>
                      Are you sure you want to remove <strong className="text-slate-950 font-bold">{removalWarningUser.studentName}</strong> from <strong className="text-slate-950 font-bold">{removalWarningUser.cohortName}</strong>?
                    </p>
                    <div className="rounded-xl border border-red-100 bg-red-50/60 p-3.5 text-[11px] text-red-800 space-y-1.5">
                      <strong className="block font-bold">Removal Impact Notice:</strong>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Immediately revokes student access to cohort lessons, assets, and assignment briefs.</li>
                        <li>Prevents student from submitting new cuts or requesting revision reviews.</li>
                        <li>Hides cohort announcements and discussion posts.</li>
                        <li>Historical submission scores and mentor reviews are permanently retained for institutional auditing.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={removingEnrollment}
                      onClick={() => setRemovalWarningUser(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={removingEnrollment}
                      onClick={() => void handleConfirmRemoval()}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 size={14} /> Remove from Cohort
                    </Button>
                  </div>
                </div>
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
              <div className="mt-4 space-y-3 pr-1">
                {pagedAnnouncements.length ? (
                  pagedAnnouncements.map((item) => (
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

              {announcements.length > announcementPageSize && (
                <div className="pt-3">
                  <Pagination
                    currentPage={safeAnnouncementPage}
                    totalPages={totalAnnouncementPages}
                    totalItems={announcements.length}
                    pageSize={announcementPageSize}
                    onPageChange={setAnnouncementPage}
                    onPageSizeChange={setAnnouncementPageSize}
                  />
                </div>
              )}
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

                    {canModerateCommunity && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDeletePost(post.id)}
                        className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                      >
                        <Trash2 size={13} /> Remove Post
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-xs text-slate-400">No community posts found.</p>
              )}
            </div>
          </Card>
        )}

        {/* TAB 7: AUDIT LOGS & GOVERNANCE STREAM */}
        {tab === 'audit' && (
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <History className="text-orange-500" size={18} />
                  <h2 className="text-lg font-black text-slate-950">Audit Logs &amp; Governance</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Immutable event log of administrative mutations, security modifications, enrollments, and content transitions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                    }}
                    placeholder="Search action, actor, entity..."
                    className="w-40 sm:w-56 bg-transparent outline-none text-xs"
                  />
                </div>

                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Actions ({auditLogs.length})</option>
                  <option value="role">Role Changes</option>
                  <option value="status">Status &amp; Suspensions</option>
                  <option value="enrollment">Enrollments</option>
                  <option value="cohort">Cohort Settings</option>
                  <option value="announcement">Announcements</option>
                  <option value="session">Live Sessions</option>
                  <option value="post">Moderation</option>
                </select>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleExportAuditCSV()}
                  loading={exportingAuditCsv}
                  className="text-xs font-bold gap-1.5"
                >
                  <Download size={13} /> Export Audit CSV
                </Button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target Entity</th>
                    <th className="py-2.5 px-3">Metadata Preview</th>
                    <th className="py-2.5 px-3 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {pagedAuditLogs.length ? (
                    pagedAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-bold whitespace-nowrap">
                          {log.actor?.full_name || log.actor?.email || (log.actor_id ? log.actor_id.slice(0, 8) : 'System')}
                        </td>
                        <td className="py-3 px-3">
                          <AuditActionBadge action={log.action} />
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-500 font-mono text-[11px]">
                          {JSON.stringify(log.metadata)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedAuditMeta(log)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-orange-600"
                          >
                            View JSON
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No audit log events match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredAuditLogs.length > auditPageSize && (
              <div className="pt-3">
                <Pagination
                  currentPage={safeAuditPage}
                  totalPages={totalAuditPages}
                  totalItems={filteredAuditLogs.length}
                  pageSize={auditPageSize}
                  onPageChange={setAuditPage}
                  onPageSizeChange={setAuditPageSize}
                />
              </div>
            )}
          </Card>
        )}

        {/* Operations & Observability Tab */}
        {tab === 'operations' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Control Bar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
                  <Activity className="text-orange-500" size={22} /> System Operations &amp; Observability
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Real-time health probes, active operational alerts, application SaaS analytics, and deployment preflight validation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRunHealthCheck()}
                  disabled={healthChecking}
                  className="gap-2"
                >
                  <RefreshCw size={14} className={healthChecking ? 'animate-spin' : ''} />
                  {healthChecking ? 'Probing Services...' : 'Run Diagnostics'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleLoadOperationsData()}
                  disabled={healthChecking || analyticsLoading}
                  className="gap-2"
                >
                  <RefreshCw size={14} className={analyticsLoading ? 'animate-spin' : ''} />
                  Refresh All
                </Button>
              </div>
            </div>

            {/* Launch Readiness Gate Certification Card */}
            <Card className="p-6 border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white shadow-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        Checklist 8: Launch Readiness Gate
                        {launchGateReport && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              launchGateReport.overallStatus === 'READY_FOR_LAUNCH'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {launchGateReport.overallStatus === 'READY_FOR_LAUNCH'
                              ? 'READY FOR LAUNCH (100%)'
                              : 'ACTION REQUIRED'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mandatory security-first pre-launch gate certifying database RLS, upload privacy, route locks, data isolation, error resilience, automated QA, monitoring, and controlled RBAC.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Passed Gates</p>
                    <p className="text-lg font-black text-emerald-400">
                      {launchGateReport ? `${launchGateReport.passedCriteria} / ${launchGateReport.totalCriteria}` : '—'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleRunLaunchGateAudit()}
                    disabled={auditingGate}
                    className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  >
                    <RefreshCw size={14} className={auditingGate ? 'animate-spin' : ''} />
                    {auditingGate ? 'Evaluating Gates...' : 'Audit Launch Readiness'}
                  </Button>
                </div>
              </div>

              {/* 8 Gate Criteria Grid */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {launchGateReport?.criteria.map((gate) => (
                  <div
                    key={gate.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      gate.status === 'PASSED'
                        ? 'border-emerald-500/30 bg-slate-900/80 hover:border-emerald-500/50'
                        : 'border-red-500/40 bg-red-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black text-slate-400">
                        GATE 0{gate.number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          gate.status === 'PASSED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {gate.status === 'PASSED' ? <Check size={10} /> : <AlertTriangle size={10} />}
                        {gate.status}
                      </span>
                    </div>
                    <h4 className="mt-2 text-xs font-bold text-white line-clamp-1">{gate.title}</h4>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {gate.requirement}
                    </p>
                    <p className="mt-2 text-[10px] font-mono text-emerald-400/90 border-t border-slate-800/80 pt-2 truncate">
                      ✓ {gate.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Health Probes Banner */}
            <Card className="p-5 border-slate-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Overall System Health</span>
                    {healthReport ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          healthReport.status === 'healthy'
                            ? 'bg-emerald-100 text-emerald-800'
                            : healthReport.status === 'degraded'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {healthReport.status === 'healthy' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        {healthReport.status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Evaluating...</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Checked at: {healthReport ? new Date(healthReport.timestamp).toLocaleTimeString() : '—'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Database Probe */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Server size={14} className="text-slate-500" />
                        <span>Database</span>
                      </div>
                      <span
                        className={`inline-block size-2 rounded-full ${
                          healthReport?.services.database.status === 'healthy'
                            ? 'bg-emerald-500'
                            : healthReport?.services.database.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {healthReport?.services.database.latencyMs != null
                          ? `${healthReport.services.database.latencyMs}ms`
                          : '—'}
                      </span>
                      <span className="capitalize text-[11px] text-slate-500">
                        {healthReport?.services.database.status || 'unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Storage Probe */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <HardDrive size={14} className="text-slate-500" />
                        <span>Storage</span>
                      </div>
                      <span
                        className={`inline-block size-2 rounded-full ${
                          healthReport?.services.storage.status === 'healthy'
                            ? 'bg-emerald-500'
                            : healthReport?.services.storage.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {healthReport?.services.storage.latencyMs != null
                          ? `${healthReport.services.storage.latencyMs}ms`
                          : '—'}
                      </span>
                      <span className="capitalize text-[11px] text-slate-500">
                        {healthReport?.services.storage.status || 'unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Auth Probe */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Lock size={14} className="text-slate-500" />
                        <span>Auth Engine</span>
                      </div>
                      <span
                        className={`inline-block size-2 rounded-full ${
                          healthReport?.services.auth.status === 'healthy'
                            ? 'bg-emerald-500'
                            : healthReport?.services.auth.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {healthReport?.services.auth.latencyMs != null
                          ? `${healthReport.services.auth.latencyMs}ms`
                          : '—'}
                      </span>
                      <span className="capitalize text-[11px] text-slate-500">
                        {healthReport?.services.auth.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Active Operational Alerts Feed */}
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-orange-500" />
                  <h3 className="text-sm font-black text-slate-950">Active Operational Alerts</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {alerts.length}
                  </span>
                </div>
                {alerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      alertManager.clearAlerts();
                      toast.info('All alerts dismissed');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear All
                  </Button>
                )}
              </div>

              <div className="mt-4 space-y-2.5">
                {alerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={24} />
                    All operational metrics and error thresholds are nominal. No active incident alerts.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start justify-between rounded-xl border p-3.5 transition-colors ${
                        alert.severity === 'critical'
                          ? 'border-red-200 bg-red-50/50'
                          : alert.severity === 'warning'
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-blue-200 bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex rounded-full p-1 ${
                            alert.severity === 'critical'
                              ? 'bg-red-100 text-red-600'
                              : alert.severity === 'warning'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          <AlertTriangle size={14} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                              {alert.type}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">{alert.message}</p>
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => alertManager.dismissAlert(alert.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                        title="Dismiss Alert"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Application SaaS Telemetry Analytics */}
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-orange-500" /> SaaS Telemetry &amp; Learning Analytics
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated metrics covering user activation, completion velocities, assignment SLA, and cohort retention.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Active Users */}
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Active Users &amp; Roles</span>
                    <Users size={15} className="text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {platformAnalytics?.activeUsers.total ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-400">total accounts</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>Students: <strong className="text-slate-800">{platformAnalytics?.activeUsers.students ?? 0}</strong></span>
                    <span>Mentors: <strong className="text-slate-800">{platformAnalytics?.activeUsers.mentors ?? 0}</strong></span>
                    <span>Admins: <strong className="text-slate-800">{platformAnalytics?.activeUsers.admins ?? 0}</strong></span>
                  </div>
                </Card>

                {/* Lesson Completion Rate */}
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Curriculum Completion</span>
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {platformAnalytics ? `${platformAnalytics.lessonCompletion.completionRatePct}%` : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">completion rate</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, platformAnalytics?.lessonCompletion.completionRatePct ?? 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {platformAnalytics?.lessonCompletion.completedLessons ?? 0} completed across {platformAnalytics?.lessonCompletion.totalEnrollments ?? 0} enrollments ({platformAnalytics?.lessonCompletion.avgWatchPercentage ?? 0}% avg watch)
                  </p>
                </Card>

                {/* Assignment Timeliness */}
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Submission Timeliness</span>
                    <Clock size={15} className="text-purple-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {platformAnalytics ? `${platformAnalytics.assignmentSubmissions.onTimeRatePct}%` : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">on-time rate</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, platformAnalytics?.assignmentSubmissions.onTimeRatePct ?? 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {platformAnalytics?.assignmentSubmissions.onTimeSubmissions ?? 0} on-time · {platformAnalytics?.assignmentSubmissions.lateSubmissions ?? 0} late · {platformAnalytics?.assignmentSubmissions.totalSubmissions ?? 0} total
                  </p>
                </Card>

                {/* Review SLA Compliance */}
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Mentor Review Turnaround</span>
                    <ShieldCheck size={15} className="text-orange-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">
                      {platformAnalytics?.reviewTurnaround.avgTurnaroundHours != null
                        ? `${platformAnalytics.reviewTurnaround.avgTurnaroundHours}h`
                        : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400">avg turnaround</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>SLA &lt;24h: <strong className="text-slate-800">{platformAnalytics ? `${platformAnalytics.reviewTurnaround.slaComplianceRatePct}%` : '—'}</strong></span>
                    <span>Graded: <strong className="text-slate-800">{platformAnalytics?.reviewTurnaround.totalGraded ?? 0}</strong></span>
                    <span>Queue: <strong className="text-slate-800">{platformAnalytics?.reviewTurnaround.pendingQueue ?? 0}</strong></span>
                  </div>
                </Card>
              </div>
            </div>

            {/* Deployment & Environment Preflight Audit */}
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                    <Shield size={16} className="text-blue-500" /> Deployment Preflight &amp; Security Validation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verifies client configuration, environment integrity, and browser crypto capability.
                  </p>
                </div>
                {deploymentReport && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      deploymentReport.status === 'pass'
                        ? 'bg-emerald-100 text-emerald-800'
                        : deploymentReport.status === 'warn'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {deploymentReport.status.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {deploymentReport?.items.map((check: DeploymentCheckItem, idx: number) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 inline-flex rounded-full p-1 ${
                          check.status === 'pass'
                            ? 'bg-emerald-50 text-emerald-600'
                            : check.status === 'warn'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {check.status === 'pass' ? (
                          <Check size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{check.name}</p>
                        <p className="text-xs text-slate-600">{check.message}</p>
                        {check.details && (
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{check.details}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        check.status === 'pass'
                          ? 'bg-emerald-50 text-emerald-700'
                          : check.status === 'warn'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* JSON Metadata Inspector Modal */}
        {selectedAuditMeta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-950">Audit Event Metadata</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedAuditMeta.action} · {new Date(selectedAuditMeta.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAuditMeta(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 max-h-96 overflow-y-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-emerald-400">
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(
                    {
                      id: selectedAuditMeta.id,
                      action: selectedAuditMeta.action,
                      actor: selectedAuditMeta.actor,
                      actor_id: selectedAuditMeta.actor_id,
                      entity_type: selectedAuditMeta.entity_type,
                      entity_id: selectedAuditMeta.entity_id,
                      metadata: selectedAuditMeta.metadata,
                      created_at: selectedAuditMeta.created_at,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="mt-5 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setSelectedAuditMeta(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
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

function AuditActionBadge({ action }: { action: string }) {
  if (action.includes('role')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
        <UserCheck size={11} /> {action}
      </span>
    );
  }
  if (action.includes('status') || action.includes('suspend')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        <UserX size={11} /> {action}
      </span>
    );
  }
  if (action.includes('enrollment')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        <Layers size={11} /> {action}
      </span>
    );
  }
  if (action.includes('delete') || action.includes('remove')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
        <Trash2 size={11} /> {action}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
      <History size={11} /> {action}
    </span>
  );
}
