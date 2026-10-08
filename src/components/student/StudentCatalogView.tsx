import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, Lock, RotateCw, Search, User, Video, X } from 'lucide-react';
import type { CatalogCourseItem, EnrolledCourseProgressSummary } from '../../hooks/useStudentDashboard';

export interface StudentCatalogViewProps {
  totalCatalogCount: number;
  inProgressCatalogCount: number;
  completedCatalogCount: number;
  catalogSearchQuery: string;
  setCatalogSearchQuery: (query: string) => void;
  catalogFilter: 'all' | 'in_progress' | 'completed' | 'expired' | 'paid';
  setCatalogFilter: (filter: 'all' | 'in_progress' | 'completed' | 'expired' | 'paid') => void;
  filteredCatalogCourses: CatalogCourseItem[];
  enrolledCoursesProgress?: EnrolledCourseProgressSummary[];
  onRefresh: () => void;
  onContinueCourse: (cohortId: string) => void;
  onUnlockCourse: (cohortId: string) => void;
}

export function StudentCatalogView({
  totalCatalogCount,
  inProgressCatalogCount,
  completedCatalogCount,
  catalogSearchQuery,
  setCatalogSearchQuery,
  catalogFilter,
  setCatalogFilter,
  filteredCatalogCourses,
  enrolledCoursesProgress,
  onRefresh,
  onContinueCourse,
  onUnlockCourse,
}: StudentCatalogViewProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Page Title & Subtitle with Refresh Button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Courses
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {totalCatalogCount} courses • {inProgressCatalogCount} in progress • {completedCatalogCount} completed
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/profile"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-200 dark:border-surface-subtle bg-orange-50 dark:bg-surface-card px-3.5 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-surface-elevated transition shadow-2xs"
          >
            <User size={13} />
            <span>My Profile &amp; Attendance</span>
          </Link>
          <button
            onClick={onRefresh}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition active:scale-95"
            title="Sync and refresh courses"
            aria-label="Sync and refresh courses"
          >
            <RotateCw size={15} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Multi-Course Real-Time Progress Overview */}
      {enrolledCoursesProgress && enrolledCoursesProgress.length > 0 && (
        <div className="mt-6 rounded-2xl border border-orange-100 dark:border-slate-800 bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
                <BookOpen size={13} />
              </span>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                My Enrolled Tracks &bull; Live Progress
              </h2>
            </div>
            <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
              {enrolledCoursesProgress.length} active {enrolledCoursesProgress.length === 1 ? 'enrollment' : 'enrollments'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrolledCoursesProgress.map((track) => (
              <div
                key={track.cohortId}
                onClick={() => onContinueCourse(track.cohortId)}
                className="group cursor-pointer rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-3.5 shadow-2xs hover:border-orange-400 dark:hover:border-orange-500 transition hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition truncate">
                      Track: {track.cohortName}
                    </h3>
                    <span className="shrink-0 rounded-full bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 text-[10px] font-black text-orange-700 dark:text-orange-300">
                      {track.progress}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${track.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-slate-400">
                  <span>
                    {track.completedLessons} of {track.totalLessons} lessons
                  </span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                    Continue &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pill Search Bar */}
      <div className="mt-6 flex items-center rounded-full border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-2xs focus-within:border-orange-500 transition">
        <button
          type="button"
          className="flex items-center gap-1.5 pr-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-r border-slate-200 dark:border-slate-800 shrink-0"
        >
          <span>Course</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
        <Search size={16} className="ml-3 text-slate-400 shrink-0" />
        <input
          type="text"
          value={catalogSearchQuery}
          onChange={(e) => setCatalogSearchQuery(e.target.value)}
          placeholder="Search by course, chapter, or section title"
          className="w-full bg-transparent px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
        />
        {catalogSearchQuery && (
          <button
            type="button"
            onClick={() => setCatalogSearchQuery('')}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Pills Row */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setCatalogFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition shadow-xs ${
            catalogFilter === 'all'
              ? 'bg-[#ea580c] text-white shadow-orange-500/20'
              : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setCatalogFilter('in_progress')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            catalogFilter === 'in_progress'
              ? 'bg-[#ea580c] text-white font-bold'
              : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          In Progress
        </button>
        <button
          onClick={() => setCatalogFilter('completed')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            catalogFilter === 'completed'
              ? 'bg-[#ea580c] text-white font-bold'
              : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setCatalogFilter('expired')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            catalogFilter === 'expired'
              ? 'bg-[#ea580c] text-white font-bold'
              : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Expired
        </button>
        <button
          onClick={() => setCatalogFilter('paid')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            catalogFilter === 'paid'
              ? 'bg-[#ea580c] text-white font-bold'
              : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Paid
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
        >
          <span>Service</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
        >
          <span>Duration</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
      </div>

      {/* 3-Column Courses Grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCatalogCourses.map((c) => {
          if (!c.isLocked) {
            // Card 1: Active Enrolled Course
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Dark Cinematic Banner */}
                <div className="relative h-48 bg-gradient-to-b from-[#1b1c20] via-[#121316] to-[#0a0b0d] p-6 flex flex-col items-center justify-center select-none overflow-hidden text-center">
                  {/* Corner Brackets */}
                  <span className="absolute top-3.5 left-3.5 size-3 border-t-2 border-l-2 border-white/25 pointer-events-none" />
                  <span className="absolute top-3.5 right-3.5 size-3 border-t-2 border-r-2 border-white/25 pointer-events-none" />
                  <span className="absolute bottom-3.5 left-3.5 size-3 border-b-2 border-l-2 border-white/25 pointer-events-none" />
                  <span className="absolute bottom-3.5 right-3.5 size-3 border-b-2 border-r-2 border-white/25 pointer-events-none" />

                  {/* Top ProCut Logo */}
                  <div className="flex flex-col items-center leading-none mb-1.5">
                    <span className="text-xs font-black tracking-widest text-[#f59e0b]">PROCUT</span>
                    <span className="text-[6px] font-bold tracking-widest text-slate-400 uppercase">HUB</span>
                  </div>

                  {/* Film Reel Icon */}
                  <div className="flex items-center justify-center text-[#f59e0b] mb-1">
                    <Video size={18} className="text-[#f59e0b]" />
                  </div>

                  {/* Banner Text */}
                  <h4 className="text-2xl sm:text-3xl font-black tracking-tight text-[#f59e0b] uppercase font-sans leading-none">
                    {c.headline}
                  </h4>
                  <p className="mt-1 text-[9px] font-bold tracking-[0.22em] text-white/90 uppercase">
                    {c.subheadline}
                  </p>
                  <span className="mt-1.5 inline-block text-[8px] font-black tracking-widest text-[#f59e0b] border border-[#f59e0b]/40 rounded px-1.5 py-0.5">
                    {c.batchTag}
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-1">
                      {c.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {c.platform}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {c.sections} sections • {c.lectures} lectures
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                        <span>Progress</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {c.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-orange-100 dark:bg-orange-950/40 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-[#ea580c] rounded-full transition-all duration-300"
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Continue Action Button */}
                  <button
                    type="button"
                    onClick={() => onContinueCourse(c.id)}
                    className="mt-5 w-full rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold py-2.5 px-4 text-sm transition shadow-sm hover:shadow active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    Continue
                  </button>
                </div>

                {/* Card Footer Banner */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 px-5 py-3 flex items-center gap-2 bg-slate-50/60 dark:bg-slate-900/60">
                  {c.unviewedVideoCount > 0 ? (
                    <>
                      <span className="rounded-full bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 tracking-wider uppercase">
                        NEW
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {c.unviewedVideoCount === 1
                          ? '1 new video recently added'
                          : `${c.unviewedVideoCount} new videos recently added`}
                      </span>
                    </>
                  ) : c.totalVideosCount > 0 ? (
                    <>
                      <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 tracking-wider uppercase border border-emerald-500/30">
                        UP TO DATE
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        All videos watched
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      No video lessons uploaded yet
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Cards 2 & 3: Locked Courses
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Dark Cinematic Banner with Lock Icon Overlay */}
              <div className="relative h-48 bg-gradient-to-b from-[#18191d] via-[#111215] to-[#090a0c] p-6 flex flex-col items-center justify-center select-none overflow-hidden text-center">
                {/* Corner Brackets */}
                <span className="absolute top-3.5 left-3.5 size-3 border-t-2 border-l-2 border-white/20 pointer-events-none" />
                <span className="absolute top-3.5 right-3.5 size-3 border-t-2 border-r-2 border-white/20 pointer-events-none" />
                <span className="absolute bottom-3.5 left-3.5 size-3 border-b-2 border-l-2 border-white/20 pointer-events-none" />
                <span className="absolute bottom-3.5 right-3.5 size-3 border-b-2 border-r-2 border-white/20 pointer-events-none" />

                {/* Top right badges */}
                {c.unviewedVideoCount > 0 && (
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                    <span className="text-[8px] font-black text-white/90 border border-white/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
                      NEW
                    </span>
                  </div>
                )}
                <div className="absolute top-3.5 left-3.5">
                  <div className="flex flex-col items-start leading-none opacity-80">
                    <span className="text-[9px] font-black tracking-widest text-[#f59e0b]">PRO</span>
                  </div>
                </div>

                {/* Subtle Background Text */}
                <div className="opacity-25 flex flex-col items-center pointer-events-none">
                  <h4 className="text-2xl font-black tracking-tight text-[#f59e0b] uppercase font-sans">
                    {c.headline}
                  </h4>
                  <p className="text-[8px] tracking-[0.2em] font-bold text-white uppercase">
                    {c.subheadline}
                  </p>
                  <p className="text-[8px] tracking-widest font-black text-[#f59e0b] mt-2">
                    {c.batchTag}
                  </p>
                </div>

                {/* Centered Circular Lock Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-black/65 backdrop-blur-xs text-white shadow-xl">
                    <Lock size={22} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-1">
                    {c.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {c.platform}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {c.sections} sections • {c.lectures} lectures
                  </p>
                </div>

                {/* Buy Now Button */}
                <button
                  type="button"
                  onClick={() => onUnlockCourse(c.id)}
                  className="mt-6 w-full rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold py-2.5 px-4 text-sm transition shadow-sm hover:shadow active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Buy now to unlock
                </button>
              </div>

              {/* Card Footer Banner */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 px-5 py-3 flex items-center gap-2 bg-slate-50/60 dark:bg-slate-900/60">
                {c.unviewedVideoCount > 0 ? (
                  <>
                    <span className="rounded-full bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 tracking-wider uppercase">
                      NEW
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {c.unviewedVideoCount === 1
                        ? '1 new video recently added'
                        : `${c.unviewedVideoCount} new videos recently added`}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {c.totalVideosCount > 0 ? `${c.totalVideosCount} videos available` : 'Curriculum in preparation'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCatalogCourses.length === 0 && (
        <div className="mt-12 text-center py-16 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <BookOpen className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={32} />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No courses match your filter</p>
          <button
            onClick={() => {
              setCatalogFilter('all');
              setCatalogSearchQuery('');
            }}
            className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 underline"
          >
            Reset filters
          </button>
        </div>
      )}
    </main>
  );
}

export default StudentCatalogView;
