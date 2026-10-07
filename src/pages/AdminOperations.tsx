import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, X } from 'lucide-react';
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
  exportExecutiveReportCSV,
  exportAtRiskLearnersCSV,
  exportSubmissionsCSV,
  exportUsersCSV,
  getAdminExecutiveMetrics,
  getAdminStats,
  getBulkEnrollmentTemplateCSV,
  getCourseDemandReport,
  listAnnouncements,
  listAuditLogs,
  listCohortEnrollments,
  listCommunityPostsWithAuthors,
  listAdminCommunityReports,
  resolveAdminCommunityReport,
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
  type CommunityReport,
  type AdminEnrollment,
  type EnrollmentStatus,
  type AdminExecutiveMetrics,
  type AdminStats,
  type AuditLog,
  type CourseDemandMetric,
  type LiveSession,
  type MentorCohortAssignment,
  type UserProfile,
} from '../lib/adminService';
import { listCohorts, type Cohort } from '../lib/courseService';
import { runSystemHealthCheck, type SystemHealthReport } from '../lib/observability/healthCheck';
import { alertManager, type OperationalAlert } from '../lib/observability/alerts';
import {
  getPlatformAnalytics,
  getCohortReportingBaseline,
  type PlatformAnalytics,
  type CohortReportingBaseline,
} from '../lib/observability/analytics';
import { runDeploymentCheck, type DeploymentReport } from '../lib/observability/deploymentCheck';
import { evaluateLaunchReadinessGate, type LaunchGateReport } from '../lib/observability/launchReadinessGate';
import {
  errorTracker,
  type ErrorLogEntry,
  type DurableErrorTelemetryStats,
  type SentryVerificationResult,
} from '../lib/observability/errorTracking';

// Modular Tabs
import { OverviewTab } from '../components/admin/tabs/OverviewTab';
import { InsightsTab } from '../components/admin/tabs/InsightsTab';
import { UsersTab } from '../components/admin/tabs/UsersTab';
import { EnrollmentsTab, type RemovalWarningData } from '../components/admin/tabs/EnrollmentsTab';
import { AnnouncementsTab } from '../components/admin/tabs/AnnouncementsTab';
import { LiveSessionsTab } from '../components/admin/tabs/LiveSessionsTab';
import { CommunityTab } from '../components/admin/tabs/CommunityTab';
import { AuditLogsTab } from '../components/admin/tabs/AuditLogsTab';
import { SystemHealthTab } from '../components/admin/tabs/SystemHealthTab';
import { AdvertisementsTab } from '../components/admin/tabs/AdvertisementsTab';
import {
  listAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  toggleAdvertisementActive,
  type Advertisement,
  type CreateAdvertisementInput,
  type UpdateAdvertisementInput,
} from '../lib/advertisementService';

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
  | 'advertisements'
  | 'sessions'
  | 'community'
  | 'audit'
  | 'operations';

export function AdminOperations() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');

  // Core Data
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [execMetrics, setExecMetrics] = useState<AdminExecutiveMetrics | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [updatingTimeframe, setUpdatingTimeframe] = useState(false);
  const [exportingExecutiveReport, setExportingExecutiveReport] = useState(false);
  const [exportingAtRiskReport, setExportingAtRiskReport] = useState(false);
  const [courseDemand, setCourseDemand] = useState<CourseDemandMetric[]>([]);
  const [courseDemandLoading, setCourseDemandLoading] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [mentorAssignments, setMentorAssignments] = useState<MentorCohortAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Observability & System Ops
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [alerts, setAlerts] = useState<OperationalAlert[]>(() => alertManager.getActiveAlerts());
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [cohortBaseline, setCohortBaseline] = useState<CohortReportingBaseline | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsCohortFilter, setAnalyticsCohortFilter] = useState<string>('all');
  const [deploymentReport, setDeploymentReport] = useState<DeploymentReport | null>(null);
  const [launchGateReport, setLaunchGateReport] = useState<LaunchGateReport | null>(null);
  const [auditingGate, setAuditingGate] = useState(false);

  // Durable Error Telemetry
  const [errorStats, setErrorStats] = useState<DurableErrorTelemetryStats | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [sentryTesting, setSentryTesting] = useState(false);
  const [sentryProbeResult, setSentryProbeResult] = useState<SentryVerificationResult | null>(null);
  const [errorLevelFilter, setErrorLevelFilter] = useState<'all' | 'error' | 'fatal' | 'warning' | 'info'>('all');
  const [errorSearch, setErrorSearch] = useState('');

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Controlled Modals & Selection from Overview
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // CSV Export Loading States
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingSubmissionsCsv, setExportingSubmissionsCsv] = useState(false);
  const [exportingAuditCsv, setExportingAuditCsv] = useState(false);

  // Permissions
  const canManageRoles = hasAdminPermission(profile?.admin_role, 'manage_roles');
  const canManageStatus = hasAdminPermission(profile?.admin_role, 'manage_user_status');
  const canManageEnrollments = hasAdminPermission(profile?.admin_role, 'manage_enrollments');
  const canBroadcastAnnouncements = hasAdminPermission(profile?.admin_role, 'broadcast_announcements');
  const canScheduleSessions = hasAdminPermission(profile?.admin_role, 'schedule_sessions');
  const canModerateCommunity = hasAdminPermission(profile?.admin_role, 'moderate_community');
  const canViewAuditLogs = hasAdminPermission(profile?.admin_role, 'view_audit_logs');
  const canViewInsights = hasAdminPermission(profile?.admin_role, 'view_insights');

  // Initial Data Fetch
  useEffect(() => {
    if (profile?.role !== 'admin') return;
    let active = true;

    Promise.allSettled([
      getAdminStats(),
      listUsers(),
      listCohorts(),
      listCohortEnrollments(),
      listAnnouncements(),
      listAdvertisements(),
      listLiveSessions(),
      listCommunityPostsWithAuthors(),
      getAdminExecutiveMetrics(selectedTimeframe),
      canViewAuditLogs ? listAuditLogs({ limit: 100 }) : Promise.resolve([]),
      listMentorCohortAssignments(),
      canModerateCommunity ? listAdminCommunityReports() : Promise.resolve([]),
      getCourseDemandReport(),
    ])
      .then((results) => {
        if (!active) return;
        const [
          nextStats,
          nextUsers,
          nextCohorts,
          nextEnrollments,
          nextAnnouncements,
          nextAds,
          nextSessions,
          nextPosts,
          nextMetrics,
          nextLogs,
          nextMentorAssignments,
          nextReports,
          nextDemand,
        ] = results;

        if (nextStats.status === 'fulfilled') setStats(nextStats.value);
        if (nextUsers.status === 'fulfilled') setUsers(nextUsers.value);
        if (nextCohorts.status === 'fulfilled') setCohorts(nextCohorts.value);
        if (nextEnrollments.status === 'fulfilled') setEnrollments(nextEnrollments.value);
        if (nextAnnouncements.status === 'fulfilled') setAnnouncements(nextAnnouncements.value);
        if (nextAds.status === 'fulfilled') setAdvertisements(nextAds.value);
        if (nextSessions.status === 'fulfilled') setSessions(nextSessions.value);
        if (nextPosts.status === 'fulfilled') setPosts(nextPosts.value);
        if (nextMetrics.status === 'fulfilled') {
          setExecMetrics(nextMetrics.value);
          if (nextMetrics.value.courseDemand?.length) {
            setCourseDemand(nextMetrics.value.courseDemand);
          }
        }
        if (nextLogs.status === 'fulfilled') setAuditLogs(nextLogs.value);
        if (nextMentorAssignments.status === 'fulfilled') setMentorAssignments(nextMentorAssignments.value);
        if (nextReports.status === 'fulfilled') setReports(nextReports.value);
        if (nextDemand.status === 'fulfilled' && nextDemand.value.length) {
          setCourseDemand(nextDemand.value);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const parsed = parseDatabaseError(err);
        setError(parsed.message);
        setAppError(parsed);
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
  }, [profile?.role, reloadTrigger, canViewAuditLogs, canModerateCommunity, selectedTimeframe]);

  const handleRetry = () => {
    setRetrying(true);
    setReloadTrigger((prev) => prev + 1);
  };

  // --- EXECUTIVE INSIGHTS HANDLERS ---
  const handleTimeframeChange = async (tf: '7d' | '30d' | '90d' | 'all') => {
    setSelectedTimeframe(tf);
    setUpdatingTimeframe(true);
    try {
      const [updatedMetrics, updatedDemand] = await Promise.all([
        getAdminExecutiveMetrics(tf),
        getCourseDemandReport(),
      ]);
      setExecMetrics(updatedMetrics);
      if (updatedDemand.length) {
        setCourseDemand(updatedDemand);
      } else if (updatedMetrics.courseDemand?.length) {
        setCourseDemand(updatedMetrics.courseDemand);
      }
    } catch (err) {
      console.warn('Failed to update timeframe metrics:', err);
    } finally {
      setUpdatingTimeframe(false);
    }
  };

  const handleRefreshCourseDemand = async () => {
    setCourseDemandLoading(true);
    try {
      const demand = await getCourseDemandReport();
      setCourseDemand(demand);
      toast.success('Course demand report refreshed.');
    } catch {
      toast.error('Failed to refresh course demand report.');
    } finally {
      setCourseDemandLoading(false);
    }
  };

  const handleExportExecutiveReport = () => {
    if (!execMetrics) return;
    setExportingExecutiveReport(true);
    try {
      const csv = exportExecutiveReportCSV(execMetrics);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `executive-platform-report-${selectedTimeframe}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Executive platform report CSV exported successfully.');
      toast.success('Executive platform report exported.');
    } catch {
      toast.error('Failed to export executive report');
    } finally {
      setExportingExecutiveReport(false);
    }
  };

  const handleExportAtRiskLearners = () => {
    if (!execMetrics || !execMetrics.atRiskLearners.length) return;
    setExportingAtRiskReport(true);
    try {
      const csv = exportAtRiskLearnersCSV(execMetrics.atRiskLearners);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `at-risk-learners-${selectedTimeframe}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('At-risk student roster CSV exported successfully.');
      toast.success('At-risk student roster exported.');
    } catch {
      toast.error('Failed to export at-risk student roster');
    } finally {
      setExportingAtRiskReport(false);
    }
  };

  // --- OBSERVABILITY & OPERATIONS LIFECYCLE ---
  useEffect(() => {
    const unsubscribe = alertManager.subscribe((activeAlerts) => {
      setAlerts(activeAlerts);
    });
    return () => unsubscribe();
  }, []);

  const handleLoadErrorTelemetry = useCallback(async () => {
    setErrorLogsLoading(true);
    try {
      const [logs, stats] = await Promise.all([
        errorTracker.fetchDurableErrorLogs({
          level: errorLevelFilter === 'all' ? undefined : errorLevelFilter,
          search: errorSearch || undefined,
        }),
        errorTracker.fetchErrorTelemetryStats(),
      ]);
      setErrorLogs(logs);
      setErrorStats(stats);
    } catch (err) {
      console.error('Failed to load error telemetry:', err);
    } finally {
      setErrorLogsLoading(false);
    }
  }, [errorLevelFilter, errorSearch]);

  const handleLoadOperationsData = async () => {
    setHealthChecking(true);
    setAnalyticsLoading(true);
    try {
      const selectedCohort = analyticsCohortFilter === 'all' ? undefined : analyticsCohortFilter;
      const [health, analytics, baseline, deployment, gate] = await Promise.all([
        runSystemHealthCheck(),
        getPlatformAnalytics(true, selectedCohort),
        selectedCohort ? getCohortReportingBaseline(selectedCohort, true) : Promise.resolve(null),
        Promise.resolve(runDeploymentCheck()),
        evaluateLaunchReadinessGate(),
      ]);
      setHealthReport(health);
      setPlatformAnalytics(analytics);
      setCohortBaseline(baseline);
      setDeploymentReport(deployment);
      setLaunchGateReport(gate);
      void handleLoadErrorTelemetry();
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to refresh operations data');
    } finally {
      setHealthChecking(false);
      setAnalyticsLoading(false);
    }
  };

  const handleAnalyticsCohortChange = async (cohortId: string) => {
    setAnalyticsCohortFilter(cohortId);
    setAnalyticsLoading(true);
    try {
      const selected = cohortId === 'all' ? undefined : cohortId;
      const [analytics, baseline] = await Promise.all([
        getPlatformAnalytics(true, selected),
        selected ? getCohortReportingBaseline(selected, true) : Promise.resolve(null),
      ]);
      setPlatformAnalytics(analytics);
      setCohortBaseline(baseline);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      toast.error(parsed.message, 'Failed to update cohort analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleTestSentryConnection = async () => {
    setSentryTesting(true);
    try {
      const result = await errorTracker.verifySentryConnection();
      setSentryProbeResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch {
      toast.error('Failed to test Sentry connection');
    } finally {
      setSentryTesting(false);
    }
  };

  const handleResolveError = async (id: string, currentResolved?: boolean) => {
    try {
      const newStatus = !currentResolved;
      const ok = await errorTracker.resolveErrorLog(id, newStatus);
      if (ok) {
        toast.success(newStatus ? 'Error marked as resolved' : 'Error reopened');
        void handleLoadErrorTelemetry();
      } else {
        toast.error('Failed to update error resolution status');
      }
    } catch {
      toast.error('Failed to update error resolution status');
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
        void handleLoadErrorTelemetry();
      })
      .catch((err: unknown) => {
        if (!active) return;
        const parsed = parseDatabaseError(err);
        toast.error(parsed.message, 'Failed to refresh operations data');
      });

    return () => {
      active = false;
    };
  }, [tab, toast, handleLoadErrorTelemetry]);

  // --- USER ACTIONS ---
  const handleRoleChange = async (targetUser: UserProfile, newRole: 'student' | 'mentor') => {
    if (targetUser.id === user?.id) {
      setError('You cannot modify your own administrative role.');
      return;
    }
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
    }
  };

  const handleAdminSubRoleChange = async (targetUser: UserProfile, newAdminRole: AdminSubRole) => {
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
    }
  };

  const handleStatusChange = async (targetUser: UserProfile, newStatus: 'active' | 'suspended') => {
    if (targetUser.id === user?.id) {
      setError('You cannot suspend your own administrative account.');
      return;
    }
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
    }
  };

  const handleBulkUserStatus = async (status: 'active' | 'suspended', selectedIds: string[]) => {
    if (selectedIds.length === 0) return;
    setError(null);
    try {
      const res = await bulkUpdateUserStatus(selectedIds, status, user?.id);
      if (res.errors.length > 0) {
        const warnMsg = `Updated ${res.updatedCount} user(s). Note: ${res.errors[0]}`;
        setError(warnMsg);
        toast.warning(warnMsg);
      } else {
        const successMsg = `Successfully updated ${res.updatedCount} user(s) to ${status}.`;
        setSuccess(successMsg);
        toast.success(successMsg);
      }
      const updated = await listUsers();
      setUsers(updated);
      void getAdminStats().then(setStats);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Bulk Update Failed');
    }
  };

  const handleExportUsers = async () => {
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
    }
  };

  // --- ENROLLMENT ACTIONS ---
  const handleEnrollStudent = async (studentId: string, cohortId: string) => {
    setError(null);
    try {
      await enrollUserInCohort(studentId, cohortId, 'active', user?.id);
      setSuccess('Student successfully enrolled into cohort.');
      toast.success('Student successfully enrolled into cohort.');
      const updatedEnrollments = await listCohortEnrollments();
      setEnrollments(updatedEnrollments);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Enrollment Failed');
      throw err;
    }
  };

  const handleUpdateEnrollmentStatus = async (
    userId: string,
    cohortId: string,
    status: EnrollmentStatus
  ) => {
    try {
      await updateEnrollmentStatus(userId, cohortId, status, user?.id);
      setEnrollments((prev) =>
        prev.map((item) => {
          if (item.user_id === userId) {
            if (item.cohort_id === cohortId) {
              return { ...item, status };
            }
            if (status === 'active' && item.status === 'active') {
              return { ...item, status: 'inactive' };
            }
          }
          return item;
        })
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

  const handleConfirmRemoval = async (removal: RemovalWarningData) => {
    setError(null);
    try {
      await removeEnrollment(removal.userId, removal.cohortId, user?.id);
      setEnrollments((prev) =>
        prev.filter(
          (item) => !(item.user_id === removal.userId && item.cohort_id === removal.cohortId)
        )
      );
      const msg = `Removed ${removal.studentName} from cohort.`;
      setSuccess(msg);
      toast.info(msg);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const parsed = parseDatabaseError(err);
      setError(parsed.message);
      toast.error(parsed.message, 'Removal Failed');
      throw err;
    }
  };

  const handleBulkEnroll = async (
    cohortId: string,
    students: Array<{ email: string; name?: string }>
  ) => {
    setError(null);
    try {
      const res = await bulkEnrollStudents(cohortId, students, user?.id);
      setSuccess(
        `Bulk enrollment processed: ${res.added} enrolled directly, ${res.invitations || 0} pre-enrollment invitations recorded, ${res.skipped} skipped.`
      );
      const updatedEnrollments = await listCohortEnrollments();
      setEnrollments(updatedEnrollments);
      void getAdminStats().then(setStats);
      void getAdminExecutiveMetrics().then(setExecMetrics);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process bulk enrollment.';
      setError(msg);
      throw err;
    }
  };

  const handleAssignMentor = async (mentorId: string, cohortId: string) => {
    try {
      await assignMentorToCohort(mentorId, cohortId, user?.id);
      setSuccess('Mentor successfully assigned to cohort.');
      toast.success('Mentor successfully assigned to cohort.');
      const updated = await listMentorCohortAssignments();
      setMentorAssignments(updated);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign mentor to cohort.';
      setError(msg);
      toast.error(msg);
      throw err;
    }
  };

  const handleRemoveMentor = async (
    mentorId: string,
    cohortId: string,
    mentorName: string,
    cohortName: string
  ) => {
    if (
      !window.confirm(
        `Remove mentor ${mentorName} from ${cohortName}? They will immediately lose access to review submissions in this cohort.`
      )
    ) {
      return;
    }
    try {
      await removeMentorFromCohort(mentorId, cohortId, user?.id);
      setSuccess(`Removed ${mentorName} from ${cohortName}.`);
      toast.info(`Removed ${mentorName} from ${cohortName}.`);
      const updated = await listMentorCohortAssignments();
      setMentorAssignments(updated);
      void listAuditLogs({ limit: 100 }).then(setAuditLogs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove mentor from cohort.';
      setError(msg);
      toast.error(msg);
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

  // --- ANNOUNCEMENT ACTIONS ---
  const handleSaveAnnouncement = async (
    data: { title: string; body: string; cohort_id: string | null },
    editingId?: string
  ) => {
    if (!user) return;
    if (!canBroadcastAnnouncements) {
      setError('You do not hold permission to broadcast announcements.');
      return;
    }
    setError(null);
    try {
      if (editingId) {
        const updated = await updateAnnouncement(editingId, data);
        setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSuccess('Announcement updated successfully.');
        toast.success('Announcement updated successfully.');
      } else {
        const created = await createAnnouncement(user.id, data.title, data.body, data.cohort_id);
        setAnnouncements((prev) => [created, ...prev]);
        setSuccess('Announcement broadcasted successfully.');
        toast.success('Announcement broadcasted successfully.');
      }
      void getAdminStats().then(setStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save announcement.';
      setError(msg);
      toast.error(msg);
      throw err;
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
      toast.info('Announcement deleted.');
      void getAdminStats().then(setStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete announcement.';
      setError(msg);
      toast.error(msg);
    }
  };

  // --- ADVERTISEMENT ACTIONS ---
  const handleSaveAdvertisement = async (
    input: CreateAdvertisementInput | UpdateAdvertisementInput,
    editingId?: string
  ) => {
    setAdsLoading(true);
    try {
      if (editingId) {
        const updated = await updateAdvertisement(editingId, input);
        setAdvertisements((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        setSuccess('Advertisement updated successfully.');
        toast.success('Advertisement updated successfully.');
      } else {
        const created = await createAdvertisement(input as CreateAdvertisementInput, user?.id);
        setAdvertisements((prev) => [created, ...prev]);
        setSuccess('Advertisement published live on Homepage.');
        toast.success('Advertisement published live on Homepage.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save advertisement.';
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setAdsLoading(false);
    }
  };

  const handleDeleteAdvertisement = async (id: string) => {
    try {
      await deleteAdvertisement(id);
      setAdvertisements((prev) => prev.filter((a) => a.id !== id));
      setSuccess('Advertisement deleted.');
      toast.info('Advertisement deleted.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete advertisement.';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleToggleAdActive = async (id: string, nextActive: boolean) => {
    try {
      const updated = await toggleAdvertisementActive(id, nextActive);
      setAdvertisements((prev) => prev.map((a) => (a.id === id ? updated : a)));
      const msg = nextActive ? 'Advertisement activated on Homepage.' : 'Advertisement paused.';
      setSuccess(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle status.';
      setError(msg);
      toast.error(msg);
    }
  };

  // --- LIVE SESSION ACTIONS ---
  const handleSaveSession = async (
    data: { title: string; description: string; starts_at: string; meeting_url: string },
    editingId?: string
  ) => {
    if (!user) return;
    if (!canScheduleSessions) {
      setError('You do not hold permission to schedule live sessions.');
      return;
    }
    setError(null);
    try {
      if (editingId) {
        const updated = await updateLiveSession(editingId, data);
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSuccess('Live session updated.');
        toast.success('Live session updated.');
      } else {
        const created = await createLiveSession(user.id, data);
        setSessions((prev) => [...prev, created]);
        setSuccess('Live session scheduled.');
        toast.success('Live session scheduled.');
      }
      void getAdminStats().then(setStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save live session.';
      setError(msg);
      toast.error(msg);
      throw err;
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
      toast.info('Live session removed.');
      void getAdminStats().then(setStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete live session.';
      setError(msg);
      toast.error(msg);
    }
  };

  // --- COMMUNITY MODERATION ---
  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this community post?')) return;
    try {
      await deleteCommunityPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setReports((prev) => prev.filter((r) => r.post_id !== id));
      setSuccess('Community post removed.');
      toast.info('Community post removed.');
      void getAdminStats().then(setStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete community post.';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await resolveAdminCommunityReport(reportId, status, profile?.id);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      setSuccess(`Report ${status}.`);
      toast.success(`Report ${status}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update report status.';
      setError(msg);
      toast.error(msg);
    }
  };

  // --- AUDIT TRAIL EXPORT ---
  const handleExportAuditCSV = async (actionFilter?: string) => {
    setExportingAuditCsv(true);
    try {
      const csv = await exportAuditLogsCSV(actionFilter);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Audit trail CSV exported successfully.');
      toast.success('Audit trail CSV exported successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export audit trail CSV.';
      setError(msg);
      toast.error(msg);
    } finally {
      setExportingAuditCsv(false);
    }
  };

  // Navigation Tabs Configuration
  const tabs: Array<{
    id: AdminTab;
    label: string;
    count?: number;
    permission?: AdminPermission;
  }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'insights', label: 'Executive Insights', permission: 'view_insights' },
    { id: 'users', label: 'Users & Roles', count: stats.users, permission: 'manage_roles' },
    { id: 'enrollments', label: 'Cohort Enrollments', count: stats.enrollments, permission: 'manage_enrollments' },
    { id: 'announcements', label: 'Announcements', count: stats.announcements, permission: 'broadcast_announcements' },
    {
      id: 'advertisements',
      label: 'Homepage Ads & Promos',
      count: advertisements.filter((a) => a.is_active).length,
      permission: 'broadcast_announcements',
    },
    { id: 'sessions', label: 'Live Sessions', count: stats.sessions, permission: 'schedule_sessions' },
    { id: 'community', label: 'Community Moderation', count: stats.posts, permission: 'moderate_community' },
    { id: 'audit', label: 'Audit Trail', count: auditLogs.length, permission: 'view_audit_logs' },
    { id: 'operations', label: 'Observability & System Ops', count: alerts.length, permission: 'view_audit_logs' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 lg:px-8">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">
              Operations &amp; Governance
            </span>
            <h1 className="text-lg font-black text-slate-950 dark:text-white">Admin Console</h1>
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
            {/* TAB 1: OVERVIEW */}
            {tab === 'overview' && (
              <OverviewTab
                stats={stats}
                execMetrics={execMetrics}
                auditLogs={auditLogs}
                canViewAuditLogs={canViewAuditLogs}
                onNavigateTab={(t) => setTab(t as AdminTab)}
                onSelectCohort={(cId) => {
                  setSelectedCohortId(cId);
                  setTab('enrollments');
                }}
                onOpenEnrollModal={() => {
                  setTab('enrollments');
                  setShowEnrollModal(true);
                }}
              />
            )}

            {/* TAB 2: EXECUTIVE INSIGHTS */}
            {tab === 'insights' && canViewInsights && (
              <InsightsTab
                execMetrics={execMetrics}
                selectedTimeframe={selectedTimeframe}
                updatingTimeframe={updatingTimeframe}
                onTimeframeChange={(tf) => void handleTimeframeChange(tf)}
                exportingExecutiveReport={exportingExecutiveReport}
                onExportExecutiveReport={handleExportExecutiveReport}
                exportingAtRiskReport={exportingAtRiskReport}
                onExportAtRiskLearners={handleExportAtRiskLearners}
                courseDemand={courseDemand}
                courseDemandLoading={courseDemandLoading}
                onRefreshCourseDemand={() => void handleRefreshCourseDemand()}
                onCopyNoteSuccess={(msg) => toast.success(msg)}
              />
            )}

            {/* TAB 3: USERS & ROLES */}
            {tab === 'users' && (
              <UsersTab
                users={users}
                currentUserId={user?.id}
                canManageRoles={canManageRoles}
                canManageStatus={canManageStatus}
                onRoleChange={handleRoleChange}
                onStatusChange={handleStatusChange}
                onAdminSubRoleChange={handleAdminSubRoleChange}
                onBulkUserStatus={handleBulkUserStatus}
                onExportUsers={handleExportUsers}
              />
            )}

            {/* TAB 4: COHORT ENROLLMENTS */}
            {tab === 'enrollments' && (
              <EnrollmentsTab
                cohorts={cohorts}
                enrollments={enrollments}
                mentorAssignments={mentorAssignments}
                users={users}
                canManageEnrollments={canManageEnrollments}
                selectedCohortId={selectedCohortId}
                onSelectCohortId={setSelectedCohortId}
                showEnrollModal={showEnrollModal}
                setShowEnrollModal={setShowEnrollModal}
                onEnrollStudent={handleEnrollStudent}
                onUpdateEnrollmentStatus={handleUpdateEnrollmentStatus}
                onConfirmRemoval={handleConfirmRemoval}
                onBulkEnroll={handleBulkEnroll}
                onAssignMentor={handleAssignMentor}
                onRemoveMentor={handleRemoveMentor}
                onExportCSV={handleExportCSV}
                onExportSubmissions={handleExportSubmissions}
                onDownloadBulkTemplate={handleDownloadBulkTemplate}
                exportingCsv={exportingCsv}
                exportingSubmissionsCsv={exportingSubmissionsCsv}
              />
            )}

            {/* TAB 5: ANNOUNCEMENTS */}
            {tab === 'announcements' && (
              <AnnouncementsTab
                cohorts={cohorts}
                announcements={announcements}
                canBroadcastAnnouncements={canBroadcastAnnouncements}
                onSaveAnnouncement={handleSaveAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
              />
            )}

            {/* TAB: HOMEPAGE ADVERTISEMENTS & PROMOTIONS */}
            {tab === 'advertisements' && (
              <AdvertisementsTab
                advertisements={advertisements}
                loading={adsLoading}
                onSaveAdvertisement={handleSaveAdvertisement}
                onDeleteAdvertisement={handleDeleteAdvertisement}
                onToggleActive={handleToggleAdActive}
              />
            )}

            {/* TAB 6: LIVE SESSIONS */}
            {tab === 'sessions' && (
              <LiveSessionsTab
                sessions={sessions}
                onSaveSession={handleSaveSession}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {/* TAB 7: COMMUNITY MODERATION */}
            {tab === 'community' && (
              <CommunityTab
                posts={posts}
                reports={reports}
                canModerateCommunity={canModerateCommunity}
                onDeletePost={handleDeletePost}
                onResolveReport={handleResolveReport}
              />
            )}

            {/* TAB 8: AUDIT TRAIL */}
            {tab === 'audit' && canViewAuditLogs && (
              <AuditLogsTab
                auditLogs={auditLogs}
                onExportAuditCSV={handleExportAuditCSV}
                exportingAuditCsv={exportingAuditCsv}
              />
            )}

            {/* TAB 9: OBSERVABILITY & OPERATIONS */}
            {tab === 'operations' && (
              <SystemHealthTab
                healthReport={healthReport}
                healthChecking={healthChecking}
                onRunHealthCheck={handleRunHealthCheck}
                onRefreshOperations={handleLoadOperationsData}
                launchGateReport={launchGateReport}
                auditingGate={auditingGate}
                onRunLaunchGateAudit={handleRunLaunchGateAudit}
                alerts={alerts}
                onDismissAlert={(id) => alertManager.dismissAlert(id)}
                onClearAlerts={() => {
                  alertManager.clearAlerts();
                  toast.info('All alerts dismissed');
                }}
                cohorts={cohorts}
                analyticsCohortFilter={analyticsCohortFilter}
                onAnalyticsCohortChange={handleAnalyticsCohortChange}
                analyticsLoading={analyticsLoading}
                cohortBaseline={cohortBaseline}
                platformAnalytics={platformAnalytics}
                deploymentReport={deploymentReport}
                sentryTesting={sentryTesting}
                sentryProbeResult={sentryProbeResult}
                onTestSentry={handleTestSentryConnection}
                onClearSentryProbeResult={() => setSentryProbeResult(null)}
                errorStats={errorStats}
                errorLogs={errorLogs}
                errorLogsLoading={errorLogsLoading}
                errorSearch={errorSearch}
                onErrorSearchChange={setErrorSearch}
                errorLevelFilter={errorLevelFilter}
                onErrorLevelFilterChange={setErrorLevelFilter}
                onLoadErrorTelemetry={handleLoadErrorTelemetry}
                onResolveError={handleResolveError}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
