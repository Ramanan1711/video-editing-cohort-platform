import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Flame,
  Layers,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CurriculumSkeleton } from '../../components/ui/Skeletons';
import { StateFallback } from '../../components/ui/StateFallback';
import { TopRightControls } from '../../components/TopRightControls';
import { ROLE_LABELS, isParentSuperAdmin, type AdminSubRole } from '../../lib/adminPermissions';
import { DEFAULT_COHORT_FEE_INR, DEFAULT_CURRENCY } from '../../lib/paymentService';
import { UploadChallengeModal } from '../../components/admin/UploadChallengeModal';
import { useToast } from '../../context/useToast';

import { AdminCoursesProvider } from './context/AdminCoursesContext';
import { useAdminCourses } from './context/useAdminCourses';
import { StatCard } from './components/SharedSubcomponents';
import { CohortCurriculumTab } from './components/CohortCurriculumTab';
import { CourseChallengesTab } from './components/CourseChallengesTab';
import { SprintTrackStudio } from './components/SprintTrackStudio';
import { CohortEditorModal } from './modals/CohortEditorModal';
import { ModuleLessonModal } from './modals/ModuleLessonModal';
import { ChallengeEditorModal } from './modals/ChallengeEditorModal';
import { BulkSprintImportModal } from './modals/BulkSprintImportModal';

function AdminCoursesView() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile,
    cohorts,
    courses,
    modules,
    assignments,
    loading,
    retrying,
    error,
    setError,
    appError,
    success,
    setSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedCohortId,
    setExpandedCohortId,
    cohortActiveTab,
    challengesByCohort,
    courseChallengesByCohort,
    setCourseChallengesByCohort,
    showUploadChallengeModal,
    setShowUploadChallengeModal,
    uploadModalCohortId,
    setUploadModalCohortId,
    filteredCohorts,
    totalLessons,
    isAdmin,
    isMentor,
    canManageCurriculum,
    canPublish,
    canManageCohorts,
    handleRetry,
    handleSwitchCohortTab,
    openCohortEditor,
    openModuleEditor,
    openChallengeEditor,
    handleDelete,
    handleUpdateCohortStatus,
    handleClearCohortChallenges,
    setBulkImportTargetCohort,
  } = useAdminCourses();

  // Keep URL route cleanly scoped: mentors see /mentor/courses, admins see /admin/courses
  useEffect(() => {
    if (isMentor && location.pathname === '/admin/courses') {
      navigate(`/mentor/courses${location.search}`, { replace: true });
    }
  }, [isMentor, location.pathname, location.search, navigate]);

  if (profile?.role !== 'admin' && profile?.role !== 'mentor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] dark:bg-slate-950 p-8 text-center">
        <Card className="max-w-md p-8 dark:bg-slate-900 dark:border-slate-800">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
            <Lock size={22} />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-white">Access required</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You need mentor or administrator privileges to author and manage courses.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="pl-12 sm:pl-14 lg:pl-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">
              {isMentor ? 'Mentor studio' : 'Admin studio'}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {isMentor ? 'Course & Curriculum Authoring' : 'Course Authoring'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isMentor
                ? 'Design cohorts, build modules & lessons, upload resources, and configure student sprint tracks.'
                : 'Manage Cohorts, Modules, Lessons, Assignments, Deadlines & Lesson Resources.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isMentor ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 shadow-2xs dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                <Sparkles size={14} className="text-orange-500" />
                <span>Course Author / Mentor</span>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <ShieldCheck size={14} className="text-orange-500" />
                <span>
                  {profile?.admin_role
                    ? ROLE_LABELS[profile.admin_role as AdminSubRole] || 'Child Super Admin'
                    : isParentSuperAdmin(profile)
                      ? 'Parent Super Admin'
                      : 'Child Super Admin'}
                </span>
              </span>
            )}
            {isAdmin ? (
              <Button href="/admin/operations" variant="secondary" className="hidden sm:inline-flex">
                Control Room
              </Button>
            ) : (
              <Button href="/mentor" variant="secondary" className="hidden sm:inline-flex">
                Mentor Dashboard
              </Button>
            )}
            <Button href="/review/submissions" variant="secondary" className="hidden sm:inline-flex">
              Review Queue
            </Button>
            {canManageCurriculum && (
              <Button
                variant="secondary"
                onClick={() => {
                  setUploadModalCohortId(undefined);
                  setShowUploadChallengeModal(true);
                }}
                className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                <Upload size={15} className="mr-1 text-amber-600" /> Upload Challenge
              </Button>
            )}
            {canManageCohorts && (
              <Button onClick={() => openCohortEditor()}>
                <Plus size={17} /> New Cohort
              </Button>
            )}
            <TopRightControls />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {/* Mentor studio banner */}
        {isMentor && (
          <div className="mb-6 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/50 p-4 dark:border-orange-900/50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-orange-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Sparkles className="size-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-orange-950 dark:text-orange-200">
                    Mentor Course Authoring &amp; Curriculum Studio
                  </h4>
                  <p className="text-xs text-orange-900/80 dark:text-orange-300 mt-0.5 max-w-3xl leading-relaxed">
                    You can freely create new cohorts and upload all curriculum content (modules, lessons, videos, assignments, and sprint tracks) in <span className="font-bold">Draft</span> without needing prior admin permission. Draft content stays hidden from students. Once you finish uploading your course materials, click <span className="font-bold">Submit for Review</span>. Parent Super Admin (<span className="font-semibold underline">ajayramanan17@gmail.com</span>) or Child Super Admin (<span className="font-semibold underline">ajayramanan4444@gmail.com</span>) will review the uploaded lessons and grant approval, after which you can publish the cohort live to students.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => openCohortEditor()} className="shrink-0 self-start sm:self-center bg-orange-600 hover:bg-orange-700 text-white">
                <Plus size={14} /> New Cohort
              </Button>
            </div>
          </div>
        )}
        {/* Top Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard label="Master Courses" value={courses.length} icon={<FileText size={18} className="text-indigo-500" />} />
          <StatCard label="Cohorts" value={cohorts.length} icon={<Sparkles size={18} className="text-orange-500" />} />
          <StatCard label="Modules" value={modules.length} icon={<BookOpen size={18} className="text-blue-500" />} />
          <StatCard label="Lessons" value={totalLessons} icon={<Play size={18} className="text-emerald-500" />} />
          <StatCard label="Assignments" value={assignments.length} icon={<Calendar size={18} className="text-purple-500" />} />
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:text-red-900 dark:hover:text-red-100" aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Check size={17} className="shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="p-1 hover:text-emerald-900 dark:hover:text-emerald-100" aria-label="Dismiss message">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Controls / Filter Bar with Status Pills */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter size={13} /> Lifecycle:
            </span>
            {(['all', 'draft', 'review', 'published', 'archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition capitalize ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {s === 'all' ? 'All Cohorts' : s === 'review' ? 'In Review' : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 shadow-sm focus-within:border-orange-400">
            <Search size={17} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cohorts..."
              className="w-48 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 sm:w-64 text-xs dark:text-white"
            />
          </div>
        </div>

        {/* Cohorts List */}
        {loading ? (
          <CurriculumSkeleton />
        ) : appError && !cohorts.length ? (
          <StateFallback
            appError={appError}
            actionText="Retry Curriculum"
            onAction={handleRetry}
            isRetrying={retrying}
          />
        ) : filteredCohorts.length ? (
          <div className="space-y-6">
            {filteredCohorts.map((cohort) => {
              const cohortModules = modules
                .filter((m) => m.cohort_id === cohort.id)
                .sort((a, b) => a.position - b.position);
              const isExpanded = expandedCohortId === cohort.id;

              return (
                <Card key={cohort.id} className="overflow-hidden shadow-sm transition dark:bg-slate-900 dark:border-slate-800">
                  {/* Cohort Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center">
                    <button
                      onClick={() => setExpandedCohortId(isExpanded ? null : cohort.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ChevronDown
                        className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : ''}`}
                        size={20}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="truncate text-lg font-black text-slate-950 dark:text-white">{cohort.name}</h2>
                          {cohort.course_id && (
                            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                              Course: {courses.find((c) => c.id === cohort.course_id)?.title || 'Master Syllabus'}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              cohort.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                : cohort.status === 'approved'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
                                : cohort.status === 'review' || cohort.status === 'reviewing'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                                : cohort.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                                : cohort.status === 'draft'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                : 'bg-slate-200 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                          >
                            {cohort.status === 'published'
                              ? '● Published'
                              : cohort.status === 'approved'
                              ? '✓ Approved'
                              : cohort.status === 'review' || cohort.status === 'reviewing'
                              ? '◐ In Review'
                              : cohort.status === 'rejected'
                              ? '✕ Rejected'
                              : cohort.status === 'draft'
                              ? '○ Draft'
                              : '✕ Archived'}
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                            {cohortModules.length} {cohortModules.length === 1 ? 'module' : 'modules'}
                          </span>
                          {cohort.capacity && (
                            <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              Cap: {cohort.capacity} seats
                            </span>
                          )}
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            ₹{(cohort.price_inr ?? DEFAULT_COHORT_FEE_INR).toLocaleString('en-IN')} {cohort.currency || DEFAULT_CURRENCY}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {cohort.description || 'No description set'}
                        </p>
                        {cohort.review_feedback && (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-bold">Feedback:</span> {cohort.review_feedback}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2 flex-wrap">
                      {/* Cohort Quick Lifecycle Transitions & Review Controls */}
                      {isAdmin && canPublish && (cohort.status === 'draft' || !cohort.status) && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUpdateCohortStatus(cohort.id, 'reviewing', cohort.name);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                            title="Set cohort in review status"
                          >
                            <Send size={12} /> Mark Reviewing
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUpdateCohortStatus(cohort.id, 'approved', cohort.name);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition"
                            title="Approve cohort proposal"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        </>
                      )}
                      {isAdmin && canPublish && (cohort.status === 'review' || cohort.status === 'reviewing') && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUpdateCohortStatus(cohort.id, 'approved', cohort.name);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition"
                            title="Approve cohort proposal"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const feedback = window.prompt('Enter reason / feedback for rejection:');
                              if (feedback !== null) {
                                void handleUpdateCohortStatus(cohort.id, 'rejected', cohort.name, feedback);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
                            title="Reject cohort proposal with feedback"
                          >
                            <X size={12} /> Reject
                          </button>
                        </>
                      )}
                      {isAdmin && canPublish && cohort.status === 'approved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'published', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                          title="Publish cohort"
                        >
                          <CheckCircle2 size={12} /> Publish Cohort
                        </button>
                      )}
                      {isAdmin && canPublish && cohort.status === 'rejected' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'approved', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition"
                          title="Approve cohort"
                        >
                          <CheckCircle2 size={12} /> Approve
                        </button>
                      )}
                      {isAdmin && canPublish && cohort.status === 'published' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'archived', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="Archive cohort"
                        >
                          <Archive size={12} /> Archive
                        </button>
                      )}
                      {isAdmin && canPublish && cohort.status === 'archived' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'draft', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="Restore cohort to draft"
                        >
                          <RotateCcw size={12} /> Restore Draft
                        </button>
                      )}

                      {/* Mentor-Specific Quick Lifecycle Actions */}
                      {isMentor && (cohort.status === 'draft' || !cohort.status) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'reviewing', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                          title="Submit proposal for administrator review"
                        >
                          <Send size={12} /> Submit for Review
                        </button>
                      )}
                      {isMentor && (cohort.status === 'review' || cohort.status === 'reviewing') && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <Clock size={12} /> In Review
                        </span>
                      )}
                      {isMentor && cohort.status === 'approved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'published', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                          title="Publish approved cohort"
                        >
                          <CheckCircle2 size={12} /> Publish Cohort
                        </button>
                      )}
                      {isMentor && cohort.status === 'rejected' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdateCohortStatus(cohort.id, 'draft', cohort.name);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
                          title="Revise rejected proposal"
                        >
                          <RotateCcw size={12} /> Revise Draft
                        </button>
                      )}
                      {isMentor && cohort.status === 'published' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.error('This cohort is Live & Published. Uploads, curriculum edits, or structural modifications require permission from Parent Super Admin (ajayramanan17@gmail.com) or Child Super Admin (ajayramanan4444@gmail.com).');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition"
                          title="Published cohort is locked from editing without Super Admin permission"
                        >
                          <Lock size={12} /> Live (Admin Permission Required)
                        </button>
                      )}

                      {canManageCurriculum && (
                        isMentor && cohort.status === 'published' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.error('Modifications to published cohorts require permission from Parent Super Admin or Child Super Admin.');
                            }}
                            className="opacity-60 cursor-not-allowed border-dashed"
                            title="Published cohort is locked from editing without Super Admin permission"
                          >
                            <Lock size={13} className="mr-1" /> Add Module
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => openModuleEditor(cohort.id)}>
                            <Plus size={15} /> Add Module
                          </Button>
                        )
                      )}
                      {canManageCohorts && (
                        <>
                          {isMentor && cohort.status === 'published' ? (
                            <button
                              onClick={() => toast.error('Modifications to published cohorts require permission from Parent Super Admin or Child Super Admin.')}
                              className="rounded-lg p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              title="Editing published cohort requires admin permission"
                              aria-label="Edit Cohort Locked"
                            >
                              <Lock size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openCohortEditor(cohort)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white transition"
                              title="Edit Cohort"
                              aria-label="Edit Cohort"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => void handleDelete('cohort', cohort.id, cohort.name)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
                              title="Delete Cohort"
                              aria-label="Delete Cohort"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cohort Contents (Modules & Lessons vs Course Challenges vs 15-Day Sprint Challenges) */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 dark:bg-slate-950/50 p-5 lg:p-6">
                      {/* Cohort Sub-tabs */}
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSwitchCohortTab(cohort.id, 'curriculum')}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                              (cohortActiveTab[cohort.id] || 'curriculum') === 'curriculum'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                            }`}
                          >
                            <BookOpen size={15} />
                            Curriculum (Modules &amp; Lessons)
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                (cohortActiveTab[cohort.id] || 'curriculum') === 'curriculum'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {cohortModules.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchCohortTab(cohort.id, 'challenges', cohort.name)}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                              cohortActiveTab[cohort.id] === 'challenges'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Flame
                              size={15}
                              className={
                                cohortActiveTab[cohort.id] === 'challenges' ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'
                              }
                            />
                            Course Challenges &amp; Projects
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                cohortActiveTab[cohort.id] === 'challenges'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {courseChallengesByCohort[cohort.id]?.length ?? 'Quests'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchCohortTab(cohort.id, 'sprint')}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                              cohortActiveTab[cohort.id] === 'sprint'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Calendar
                              size={15}
                              className={
                                cohortActiveTab[cohort.id] === 'sprint' ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'
                              }
                            />
                            Sprint Track (Daily Tasks)
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                cohortActiveTab[cohort.id] === 'sprint'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              }`}
                            >
                              {challengesByCohort[cohort.id]?.length ?? 0}
                            </span>
                          </button>
                        </div>

                        {cohortActiveTab[cohort.id] === 'challenges' && canManageCurriculum && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setUploadModalCohortId(cohort.id);
                                setShowUploadChallengeModal(true);
                              }}
                              className="text-xs bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
                            >
                              <Upload size={14} className="mr-1" /> Upload Challenge for this Course
                            </Button>
                          </div>
                        )}

                        {cohortActiveTab[cohort.id] === 'sprint' && canManageCurriculum && (
                          <div className="flex items-center gap-2">
                            {(challengesByCohort[cohort.id]?.length || 0) > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleClearCohortChallenges(cohort.id, cohort.name)}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                title="Wipe out all daily challenges for this cohort"
                              >
                                <Trash2 size={14} className="mr-1 text-rose-500" />
                                Clear All Tasks
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setBulkImportTargetCohort({ id: cohort.id, title: cohort.name });
                              }}
                              className="text-xs"
                              title="Bulk import sprint curriculum from JSON or CSV"
                            >
                              <Layers size={14} className="mr-1 text-indigo-500" />
                              Bulk Import Sprint Track
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openChallengeEditor(cohort.id)}
                              className="text-xs"
                            >
                              <Plus size={14} className="mr-1" /> Add Daily Challenge
                            </Button>
                          </div>
                        )}
                      </div>

                      {(cohortActiveTab[cohort.id] || 'curriculum') === 'curriculum' ? (
                        <CohortCurriculumTab cohort={cohort} />
                      ) : cohortActiveTab[cohort.id] === 'challenges' ? (
                        <CourseChallengesTab cohort={cohort} />
                      ) : (
                        <SprintTrackStudio cohort={cohort} />
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <StateFallback
            type="empty"
            title="No cohorts found"
            description={search ? 'Try clearing your search query.' : 'Create your first cohort to begin authoring courses.'}
            actionText={search ? 'Reset Search' : 'Create Cohort'}
            onAction={() => {
              if (search) {
                setSearch('');
                setStatusFilter('all');
              } else {
                openCohortEditor();
              }
            }}
          />
        )}
      </main>

      {/* Unified Modals */}
      <CohortEditorModal />
      <ModuleLessonModal />
      <ChallengeEditorModal />
      <BulkSprintImportModal />

      {/* Upload Course Challenge Modal */}
      <UploadChallengeModal
        isOpen={showUploadChallengeModal}
        onClose={() => {
          setShowUploadChallengeModal(false);
          setUploadModalCohortId(undefined);
        }}
        courses={cohorts.map((c) => ({ id: c.id, title: c.name }))}
        defaultCohortId={uploadModalCohortId}
        onChallengeCreated={(newChallenge) => {
          const cId = newChallenge.cohortId || uploadModalCohortId || 'default';
          setCourseChallengesByCohort((prev) => ({
            ...prev,
            [cId]: [newChallenge, ...(prev[cId] || [])],
          }));
          toast.success(`Challenge "${newChallenge.title}" uploaded successfully!`);
          setShowUploadChallengeModal(false);
          setUploadModalCohortId(undefined);
        }}
      />
    </div>
  );
}

export function AdminCourses() {
  return (
    <AdminCoursesProvider>
      <AdminCoursesView />
    </AdminCoursesProvider>
  );
}

export default AdminCourses;
