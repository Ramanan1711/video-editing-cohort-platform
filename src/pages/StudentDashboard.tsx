import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, WifiOff } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { StudentCatalogView } from '../components/student/StudentCatalogView';
import { StudentPlayerView, LessonPlayer } from '../components/student/StudentPlayerView';
import { CommunityTopNav } from '../components/community/CommunityTopNav';
import { LevelUpModal } from '../components/community/LevelUpModal';
import { WorkshopsModal } from '../components/community/WorkshopsModal';
import { CohortDiscoveryModal } from '../components/StudentFlowPanels';
import { WhatsAppSupportWidget } from '../components/internship/WhatsAppSupportWidget';
import { StateFallback } from '../components/ui/StateFallback';
import { Button } from '../components/ui/Button';
import { resolveTargetCohortId } from '../lib/cohortCheckoutPersistence';

// Lazy-loaded standalone modals
const CertificateModal = React.lazy(() =>
  import('../components/CertificateModal').then((m) => ({ default: m.CertificateModal }))
);
const InternshipReportModal = React.lazy(() =>
  import('../components/internship/InternshipReportModal').then((m) => ({ default: m.InternshipReportModal }))
);
const AchievementsModal = React.lazy(() => import('../components/student/AchievementsModal'));

// Backward compatibility re-export for player tests
export { LessonPlayer };

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const targetCohortId = useMemo(
    () => resolveTargetCohortId(searchParams),
    [searchParams]
  );

  const dashboard = useStudentDashboard(user?.id, undefined, targetCohortId);

  // Courses Catalog View vs Detailed Player View
  const viewParam = searchParams.get('view');
  const [dashboardView, setDashboardView] = useState<'catalog' | 'player'>(
    viewParam === 'player' ? 'player' : 'catalog'
  );

  useEffect(() => {
    setDashboardView(viewParam === 'player' ? 'player' : 'catalog');
  }, [viewParam]);

  const handleSetDashboardView = useCallback(
    (view: 'catalog' | 'player') => {
      setDashboardView(view);
      const newParams = new URLSearchParams(searchParams);
      if (view === 'player') {
        newParams.set('view', 'player');
      } else {
        newParams.delete('view');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Catalog search and filter state
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'in_progress' | 'completed' | 'expired' | 'paid'>('all');

  const filteredCatalogCourses = useMemo(() => {
    return dashboard.catalogCourses.filter((c) => {
      if (catalogFilter === 'in_progress' && c.status !== 'in_progress') return false;
      if (catalogFilter === 'completed' && c.status !== 'completed') return false;
      if (catalogFilter === 'paid' && c.status !== 'paid') return false;
      if (catalogSearchQuery.trim()) {
        const q = catalogSearchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.platform.toLowerCase().includes(q) ||
          c.headline.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dashboard.catalogCourses, catalogFilter, catalogSearchQuery]);

  const totalCatalogCount = dashboard.catalogCourses.length;
  const inProgressCatalogCount = dashboard.catalogCourses.filter((c) => c.status === 'in_progress').length;
  const completedCatalogCount = dashboard.catalogCourses.filter((c) => c.status === 'completed').length;

  // Modals state
  const [levelUpModalOpen, setLevelUpModalOpen] = useState(false);
  const [workshopsModalOpen, setWorkshopsModalOpen] = useState(false);
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(() => searchParams.get('tab') === 'internship_report');
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);

  // Online / Offline status
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleContinueCourse = useCallback(
    (cohortId: string) => {
      dashboard.setSelectedCohortId(cohortId);
      handleSetDashboardView('player');
    },
    [dashboard, handleSetDashboardView]
  );

  const handleUnlockCourse = useCallback(
    (cohortId: string) => {
      dashboard.setSelectedCohortId(cohortId);
      handleSetDashboardView('player');
    },
    [dashboard, handleSetDashboardView]
  );

  // Initial Platform Loading State
  if (dashboard.loading && !dashboard.course.cohort) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <CommunityTopNav
          activeTab="courses"
          onTabChange={(tab) => {
            if (tab === 'community') navigate('/community?tab=feed');
            else if (tab === 'messages') navigate('/community?tab=messages');
            else if (tab === 'levelup') navigate('/community?tab=levelup');
            else if (tab === 'workshops') navigate('/workshops');
            else if (tab === 'courses') handleSetDashboardView('catalog');
          }}
          onOpenLevelUpModal={() => setLevelUpModalOpen(true)}
          onOpenWorkshopsModal={() => setWorkshopsModalOpen(true)}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-4 h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="mb-8 h-5 w-64 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
            <div className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
            <div className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Fatal Error / Connection / Permission / Migration Failure
  if (dashboard.appError) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <CommunityTopNav
          activeTab="courses"
          onTabChange={(tab) => {
            if (tab === 'community') navigate('/community?tab=feed');
            else if (tab === 'messages') navigate('/community?tab=messages');
            else if (tab === 'levelup') navigate('/community?tab=levelup');
            else if (tab === 'workshops') navigate('/workshops');
            else if (tab === 'courses') handleSetDashboardView('catalog');
          }}
          onOpenLevelUpModal={() => setLevelUpModalOpen(true)}
          onOpenWorkshopsModal={() => setWorkshopsModalOpen(true)}
        />
        <div className="mx-auto max-w-2xl py-16 px-6">
          <StateFallback
            appError={dashboard.appError}
            onAction={() => {
              dashboard.setAppError(null);
              dashboard.setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white transition-colors duration-200">
      {/* Universal Top Navigation */}
      <CommunityTopNav
        activeTab="courses"
        onTabChange={(tab) => {
          if (tab === 'community') navigate('/community?tab=feed');
          else if (tab === 'messages') navigate('/community?tab=messages');
          else if (tab === 'levelup') navigate('/community?tab=levelup');
          else if (tab === 'workshops') navigate('/workshops');
          else if (tab === 'courses') handleSetDashboardView('catalog');
        }}
        onOpenLevelUpModal={() => setLevelUpModalOpen(true)}
        onOpenWorkshopsModal={() => setWorkshopsModalOpen(true)}
      />

      {/* Offline banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2"
        >
          <WifiOff size={14} />
          <span>You are currently working offline. Cached lessons remain accessible.</span>
        </div>
      )}

      {/* Main View Router */}
      {dashboardView === 'catalog' ? (
        <StudentCatalogView
          totalCatalogCount={totalCatalogCount}
          inProgressCatalogCount={inProgressCatalogCount}
          completedCatalogCount={completedCatalogCount}
          catalogSearchQuery={catalogSearchQuery}
          setCatalogSearchQuery={setCatalogSearchQuery}
          catalogFilter={catalogFilter}
          setCatalogFilter={setCatalogFilter}
          filteredCatalogCourses={filteredCatalogCourses}
          onRefresh={() => dashboard.setRefreshKey((k) => k + 1)}
          onContinueCourse={handleContinueCourse}
          onUnlockCourse={handleUnlockCourse}
        />
      ) : (
        <StudentPlayerView
          user={user}
          profile={profile}
          course={dashboard.course}
          targetCohortId={targetCohortId}
          allCohorts={dashboard.allCohorts}
          allLessons={dashboard.allLessons}
          selectedLesson={dashboard.selectedLesson}
          selectedLessonId={dashboard.selectedLessonId}
          completedIds={dashboard.completedIds}
          completedCount={dashboard.completedCount}
          progressPercent={dashboard.progressPercent}
          unifiedProgress={dashboard.unifiedProgress}
          sprintDays={dashboard.sprintDays}
          sprintCompletedCount={dashboard.sprintCompletedCount}
          sprintStreak={dashboard.sprintStreak}
          sprintScore={dashboard.sprintScore}
          totalSprintDays={dashboard.totalSprintDays}
          streak={dashboard.streak}
          gamification={dashboard.gamification}
          studioRecommendations={dashboard.studioRecommendations}
          learningTimeStr={dashboard.learningTimeStr}
          unreadFeedbackCount={dashboard.unreadFeedbackCount}
          liveSessions={dashboard.liveSessions}
          announcements={dashboard.announcements}
          loading={dashboard.loading}
          error={dashboard.error}
          setError={dashboard.setError}
          setRefreshKey={dashboard.setRefreshKey}
          prevLesson={dashboard.prevLesson}
          nextLesson={dashboard.nextLesson}
          selectLesson={dashboard.selectLesson}
          toggleComplete={dashboard.toggleComplete}
          handleWatchProgress={dashboard.handleWatchProgress}
          refreshSubmissions={dashboard.refreshSubmissions}
          onBackToCatalog={() => handleSetDashboardView('catalog')}
          onOpenAchievements={() => setAchievementsModalOpen(true)}
          onOpenCertificate={() => setCertificateModalOpen(true)}
          onOpenReportCard={() => setReportModalOpen(true)}
        />
      )}

      {/* Level Up Modal */}
      {levelUpModalOpen && (
        <LevelUpModal
          isOpen={levelUpModalOpen}
          onClose={() => setLevelUpModalOpen(false)}
        />
      )}

      {/* Workshops Modal */}
      {workshopsModalOpen && (
        <WorkshopsModal
          isOpen={workshopsModalOpen}
          onClose={() => setWorkshopsModalOpen(false)}
        />
      )}

      {/* Cohort Discovery / Switcher Modal */}
      {user && (
        <CohortDiscoveryModal
          userId={user.id}
          userEmail={user.email}
          userName={profile?.full_name || user.user_metadata?.full_name}
          isOpen={discoveryModalOpen}
          onClose={() => setDiscoveryModalOpen(false)}
          currentCohortId={dashboard.course.cohort?.id}
          onSelectCohort={(cohortId) => {
            dashboard.setSelectedCohortId(cohortId);
            dashboard.setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Standalone Modals (Lazy Loaded) */}
      <Suspense fallback={null}>
        {achievementsModalOpen && (
          <AchievementsModal
            isOpen={achievementsModalOpen}
            onClose={() => setAchievementsModalOpen(false)}
            gamification={dashboard.gamification}
          />
        )}

        {certificateModalOpen && user && dashboard.course.cohort && (
          <CertificateModal
            isOpen={certificateModalOpen}
            onClose={() => setCertificateModalOpen(false)}
            studentName={profile?.full_name || 'Student'}
            cohortName={dashboard.course.cohort.name}
            cohortId={dashboard.course.cohort.id}
            studentId={user.id}
          />
        )}

        {reportModalOpen && user && dashboard.course.cohort && (
          <InternshipReportModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            cohortId={dashboard.course.cohort.id}
            cohortName={dashboard.course.cohort.name}
            studentId={user.id}
            studentName={profile?.full_name || 'Student'}
            canEdit={false}
          />
        )}
      </Suspense>

      {/* Engagement & Watch Progress Warning Modal */}
      {dashboard.engagementAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">{dashboard.engagementAlert.title}</h3>
                <p className="text-[11px] font-bold text-amber-700">Watch Verification Required</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {dashboard.engagementAlert.message}
            </p>
            <div className="mt-5 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => dashboard.setEngagementAlert(null)}>
                Understood, Continue Watching
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Floating Mentor Support */}
      {user && (
        <WhatsAppSupportWidget
          userId={user.id}
          studentName={profile?.full_name || 'Student'}
          cohortName={dashboard.course.cohort?.name}
          currentDay={Math.min(dashboard.totalSprintDays, dashboard.sprintCompletedCount + 1)}
          initialPhone={profile?.whatsapp_number || ''}
        />
      )}
    </div>
  );
}

export default StudentDashboard;