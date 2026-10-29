import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useToast } from '../../../context/useToast';
import {
  getLessonResourceDownloadUrl,
  getSecureAssetUrl,
  isSecurableAsset,
  listLessonResources,
  parseVideoUrl,
  updateLessonWatchProgress,
  type Lesson,
  type LessonResource,
} from '../../../lib/courseService';
import { CommunityBoard } from '../../CommunityBoard';
import { VideoScreen } from './VideoScreen';
import { ResourceList } from './ResourceList';

export interface LessonPlayerProps {
  lesson: Lesson;
  completed: boolean;
  onToggleComplete: () => void;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
  userId?: string;
  cohortId?: string | null;
  initialWatchPercentage?: number;
  initialLastPositionSeconds?: number;
  onWatchProgressUpdate?: (lessonId: string, watchPercentage: number, autoCompleted: boolean, positionSeconds?: number) => void;
}

export function LessonPlayer({
  lesson,
  completed,
  onToggleComplete,
  prevLesson,
  nextLesson,
  onSelectLesson,
  userId,
  cohortId,
  initialWatchPercentage = 0,
  initialLastPositionSeconds = 0,
  onWatchProgressUpdate,
}: LessonPlayerProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'notes' | 'discussion'>('overview');
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [watchPercentage, setWatchPercentage] = useState<number>(initialWatchPercentage);
  const [downloadingResourceId, setDownloadingResourceId] = useState<string | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(lesson.video_url);
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(
    () => (initialLastPositionSeconds ?? 0) > 5
  );
  const [isRefreshingStream, setIsRefreshingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const lastKnownTimeRef = useRef<number>(initialLastPositionSeconds || 0);
  const signedAtRef = useRef<number>(Date.now());
  const isRefreshingRef = useRef<boolean>(false);
  const refreshAttemptsRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);

  // Sync state when lesson or initial progress values update
  useEffect(() => {
    setWatchPercentage(initialWatchPercentage);
    setShowResumePrompt((initialLastPositionSeconds ?? 0) > 5);
  }, [lesson.id, initialLastPositionSeconds, initialWatchPercentage]);

  // Optimistic UI for 80% watch completion and instant toggle
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean>(completed);
  useEffect(() => {
    setOptimisticCompleted(completed);
  }, [completed]);
  const effectiveCompleted = optimisticCompleted || completed || watchPercentage >= 80;

  // Video HUD feedback for keyboard interactions
  const [hudMessage, setHudMessage] = useState<{
    text: string;
    icon: 'play' | 'pause' | 'rewind' | 'forward' | 'fullscreen';
  } | null>(null);

  const triggerHud = useCallback(
    (text: string, icon: 'play' | 'pause' | 'rewind' | 'forward' | 'fullscreen') => {
      setHudMessage({ text, icon });
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      hudTimerRef.current = setTimeout(() => setHudMessage(null), 1200);
    },
    []
  );

  // Keyboard controls: Space (play/pause), F (fullscreen), ← / → (5s scrub)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (document.body.style.overflow === 'hidden') {
        return;
      }

      const vid = videoRef.current;
      if (!vid) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (vid.paused) {
          vid.play().catch(() => {});
          triggerHud('Playing', 'play');
        } else {
          vid.pause();
          triggerHud('Paused', 'pause');
        }
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const container = videoContainerRef.current || vid;
        if (!document.fullscreenElement) {
          if (container.requestFullscreen) {
            void container.requestFullscreen();
            triggerHud('Fullscreen', 'fullscreen');
          }
        } else {
          if (document.exitFullscreen) {
            void document.exitFullscreen();
            triggerHud('Exit Fullscreen', 'fullscreen');
          }
        }
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - 5);
        triggerHud('-5s Rewind', 'rewind');
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const dur = vid.duration || Infinity;
        vid.currentTime = Math.min(dur, vid.currentTime + 5);
        triggerHud('+5s Skip', 'forward');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [triggerHud]);

  useEffect(() => {
    let isMounted = true;
    setStreamError(null);
    refreshAttemptsRef.current = 0;

    if (!lesson.video_url) {
      setResolvedVideoUrl(null);
      return;
    }
    if (isSecurableAsset(lesson.video_url)) {
      void getSecureAssetUrl(lesson.video_url)
        .then((signed) => {
          if (isMounted) {
            signedAtRef.current = Date.now();
            setResolvedVideoUrl(signed);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Initial secure asset resolution error:', err);
            setStreamError('Could not authorize video stream access. Please refresh.');
          }
        });
    } else {
      setResolvedVideoUrl(lesson.video_url);
    }
    return () => {
      isMounted = false;
    };
  }, [lesson.video_url]);

  const videoMeta = parseVideoUrl(resolvedVideoUrl);

  const refreshSignedUrl = useCallback(
    async (resumeAt?: number, autoResume = true) => {
      if (!lesson.video_url) return;
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      setIsRefreshingStream(true);

      const targetPos =
        resumeAt !== undefined
          ? resumeAt
          : videoRef.current
          ? videoRef.current.currentTime
          : lastKnownTimeRef.current;

      try {
        const freshSignedUrl = await getSecureAssetUrl(lesson.video_url, 3600);
        signedAtRef.current = Date.now();
        setResolvedVideoUrl(freshSignedUrl);
        setStreamError(null);

        if (videoRef.current) {
          const vid = videoRef.current;
          if (vid.src !== freshSignedUrl) {
            vid.src = freshSignedUrl;
          }
          vid.load();

          const restorePlayback = () => {
            if (targetPos > 0) {
              try {
                vid.currentTime = targetPos;
              } catch {
                // Ignore if media not seekable yet
              }
            }
            if (autoResume) {
              vid.play().catch(() => {});
            }
          };

          if (vid.readyState >= 1) {
            restorePlayback();
          } else {
            vid.addEventListener('loadedmetadata', restorePlayback, { once: true });
            vid.addEventListener('canplay', restorePlayback, { once: true });
          }
        }

        toast.info('Video stream re-authenticated. Resuming playback...', 'Stream Renewed');
      } catch (err: unknown) {
        console.error('Failed to renew video signed URL:', err);
        setStreamError('Playback session expired or chunk fetch failed (HTTP 403). Click below to reconnect.');
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshingStream(false);
      }
    },
    [lesson.video_url, toast]
  );

  const handleVideoError = useCallback(async () => {
    if (isRefreshingRef.current) return;

    const currentVideo = videoRef.current;
    const currentSrc = currentVideo?.src || resolvedVideoUrl || '';
    const currentPos = currentVideo?.currentTime || lastKnownTimeRef.current;

    const isSecurable = isSecurableAsset(lesson.video_url) || isSecurableAsset(currentSrc);
    if (!isSecurable) {
      setStreamError('Video could not be loaded. Please check your network connection.');
    } else if (refreshAttemptsRef.current >= 3) {
      setStreamError('Playback session expired (HTTP 403) and auto-recovery failed. Click below to reconnect.');
    } else {
      refreshAttemptsRef.current += 1;

      // Check if chunk / range request returns 403 Forbidden
      let is403 = false;
      try {
        if (currentSrc && (currentSrc.startsWith('http://') || currentSrc.startsWith('https://'))) {
          const probeRes = await fetch(currentSrc, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
          });
          if (probeRes.status === 403 || probeRes.status === 401) {
            is403 = true;
          }
        }
      } catch {
        is403 = true;
      }

      const elapsedMs = Date.now() - signedAtRef.current;
      const isExpired = elapsedMs > 50 * 60 * 1000;

      if (is403 || isExpired || isSecurable) {
        await refreshSignedUrl(currentPos, wasPlayingRef.current || true);
      }
    }
  }, [lesson.video_url, resolvedVideoUrl, refreshSignedUrl]);

  const handlePlay = () => {
    wasPlayingRef.current = true;
    setStreamError(null);

    // If starting playback with resume prompt still active and video near beginning, seek to saved position
    if (showResumePrompt && initialLastPositionSeconds > 5 && videoRef.current) {
      if (videoRef.current.currentTime < 5) {
        try {
          videoRef.current.currentTime = initialLastPositionSeconds;
          lastKnownTimeRef.current = initialLastPositionSeconds;
        } catch {
          // ignore if seeking fails before ready
        }
      }
      setShowResumePrompt(false);
    }

    const isSecurable = isSecurableAsset(lesson.video_url) || isSecurableAsset(resolvedVideoUrl);
    if (isSecurable && Date.now() - signedAtRef.current > 50 * 60 * 1000) {
      const cur = videoRef.current ? videoRef.current.currentTime : lastKnownTimeRef.current;
      void refreshSignedUrl(cur, true);
    }
  };

  const handlePause = () => {
    wasPlayingRef.current = false;
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      lastKnownTimeRef.current = cur;
      const dur = videoRef.current.duration;
      const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : watchPercentage;
      if (pct > watchPercentage) {
        setWatchPercentage(pct);
      }
      syncWatchProgress(Math.max(watchPercentage, pct), cur);
    }
  };

  const handlePlaying = () => {
    refreshAttemptsRef.current = 0;
    setStreamError(null);
  };

  const handleLoadedMetadata = () => {
    if (initialLastPositionSeconds > 5 && videoRef.current) {
      try {
        videoRef.current.currentTime = initialLastPositionSeconds;
        lastKnownTimeRef.current = initialLastPositionSeconds;
      } catch {
        // ignore if seeking before interaction is restricted
      }
    }
  };

  const handleDownloadResource = async (resource: LessonResource) => {
    setDownloadingResourceId(resource.id);
    try {
      const secureUrl = await getLessonResourceDownloadUrl(resource.id, resource.url);
      if (!secureUrl) throw new Error('Could not resolve download link.');
      window.open(secureUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download resource.';
      if (message.includes('LOCKED_RESOURCE')) {
        toast.error('Mark this lesson complete first to unlock this download.');
      } else if (message.includes('UNAUTHORIZED')) {
        toast.error('You must be actively enrolled in this cohort to download this file.');
      } else {
        toast.error(message, 'Download Failed');
      }
    } finally {
      setDownloadingResourceId(null);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'resources' as const, label: `Downloads & Resources (${resources.length})` },
    { id: 'notes' as const, label: 'Timeline Notes' },
    { id: 'discussion' as const, label: 'Lesson Q&A & Discussion' },
  ];

  useEffect(() => {
    void listLessonResources(lesson.id).then(setResources);
  }, [lesson.id]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const syncWatchProgress = useCallback(
    (pct: number, currentTime: number) => {
      if (!userId) return;
      const isAutoCompleted = pct >= 80;
      if (isAutoCompleted) {
        setOptimisticCompleted(true);
      }
      // Optimistic UI: notify parent state immediately before background promise
      if (onWatchProgressUpdate) {
        onWatchProgressUpdate(lesson.id, pct, isAutoCompleted, currentTime);
      }
      void updateLessonWatchProgress(userId, lesson.id, pct, currentTime, playbackSpeed);
    },
    [userId, lesson.id, onWatchProgressUpdate, playbackSpeed]
  );

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    lastKnownTimeRef.current = cur;
    const dur = videoRef.current.duration;
    if (!dur || isNaN(dur)) return;

    const pct = Math.min(100, Math.round((cur / dur) * 100));
    if (pct > watchPercentage) {
      setWatchPercentage(pct);
    }
    if (pct >= 80 && !optimisticCompleted) {
      setOptimisticCompleted(true);
    }

    const now = Date.now();
    if (now - lastSyncTimeRef.current > 5000 || (pct >= 80 && watchPercentage < 80)) {
      lastSyncTimeRef.current = now;
      syncWatchProgress(Math.max(watchPercentage, pct), cur);
    }
  };

  const handleEnded = () => {
    setWatchPercentage(100);
    setOptimisticCompleted(true);
    if (videoRef.current) {
      syncWatchProgress(100, videoRef.current.duration || 0);
    }
  };

  const handleResumePlayback = () => {
    if (videoRef.current && initialLastPositionSeconds > 0) {
      try {
        videoRef.current.currentTime = initialLastPositionSeconds;
      } catch {
        // ignore
      }
      lastKnownTimeRef.current = initialLastPositionSeconds;
      void videoRef.current.play().catch(() => {});
    }
    setShowResumePrompt(false);
  };

  const handleStartOver = () => {
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      lastKnownTimeRef.current = 0;
    }
    setShowResumePrompt(false);
    syncWatchProgress(watchPercentage, 0);
  };

  // Flush watch progress on unmount or tab exit
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userId) return;
      const cur = videoRef.current ? videoRef.current.currentTime : lastKnownTimeRef.current;
      const dur = videoRef.current ? videoRef.current.duration : 0;
      const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : watchPercentage;
      void updateLessonWatchProgress(userId, lesson.id, Math.max(watchPercentage, pct), cur, playbackSpeed);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (userId) {
        const cur = lastKnownTimeRef.current;
        if (cur > 0) {
          void updateLessonWatchProgress(userId, lesson.id, watchPercentage, cur, playbackSpeed);
        }
      }
    };
  }, [userId, lesson.id, watchPercentage, playbackSpeed]);

  // Listen for progress updates from embed iframes (YouTube, Vimeo)
  useEffect(() => {
    if (videoMeta.type !== 'embed') return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        if (!raw) return;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

        // 1. YouTube PostMessage API (enablejsapi=1)
        if (data && data.event === 'infoDelivery' && data.info) {
          const cur = Number(data.info.currentTime);
          const dur = Number(data.info.duration);
          if (dur > 0 && !isNaN(cur)) {
            const pct = Math.min(100, Math.round((cur / dur) * 100));
            if (pct > watchPercentage) {
              setWatchPercentage(pct);
            }
            if (pct >= 80 && !optimisticCompleted) {
              setOptimisticCompleted(true);
            }
            const now = Date.now();
            if (now - lastSyncTimeRef.current > 5000 || (pct >= 80 && watchPercentage < 80)) {
              lastSyncTimeRef.current = now;
              syncWatchProgress(pct, cur);
            }
          }
        } else if (data && data.event === 'onStateChange' && data.info === 0) {
          // YouTube ended
          setWatchPercentage(100);
          setOptimisticCompleted(true);
          syncWatchProgress(100, 0);
        }

        // 2. Vimeo PostMessage API (api=1)
        if (data && (data.event === 'playProgress' || data.method === 'onPlayProgress') && data.data) {
          const pct = Math.min(100, Math.round((Number(data.data.percent) || 0) * 100));
          const cur = Number(data.data.seconds) || 0;
          if (pct > watchPercentage) {
            setWatchPercentage(pct);
          }
          if (pct >= 80 && !optimisticCompleted) {
            setOptimisticCompleted(true);
          }
          const now = Date.now();
          if (now - lastSyncTimeRef.current > 5000 || (pct >= 80 && watchPercentage < 80)) {
            lastSyncTimeRef.current = now;
            syncWatchProgress(pct, cur);
          }
        } else if (data && (data.event === 'finish' || data.method === 'onFinish')) {
          setWatchPercentage(100);
          setOptimisticCompleted(true);
          syncWatchProgress(100, 0);
        }
      } catch {
        // Non-JSON or third-party frame message, safely ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [videoMeta.type, watchPercentage, optimisticCompleted, syncWatchProgress]);

  const handleToggleComplete = () => {
    setOptimisticCompleted(!effectiveCompleted);
    onToggleComplete();
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-card shadow-lg shadow-slate-950/5">
      {/* Video Screen Component */}
      <VideoScreen
        lesson={lesson}
        videoRef={videoRef}
        videoContainerRef={videoContainerRef}
        videoMeta={videoMeta}
        hudMessage={hudMessage}
        showResumePrompt={showResumePrompt}
        initialLastPositionSeconds={initialLastPositionSeconds}
        handleResumePlayback={handleResumePlayback}
        handleStartOver={handleStartOver}
        setShowResumePrompt={setShowResumePrompt}
        isRefreshingStream={isRefreshingStream}
        streamError={streamError}
        refreshSignedUrl={refreshSignedUrl}
        watchPercentage={watchPercentage}
        effectiveCompleted={effectiveCompleted}
        playbackSpeed={playbackSpeed}
        handleSpeedChange={handleSpeedChange}
        handleTimeUpdate={handleTimeUpdate}
        handleLoadedMetadata={handleLoadedMetadata}
        handleEnded={handleEnded}
        handleVideoError={handleVideoError}
        handlePlay={handlePlay}
        handlePause={handlePause}
        handlePlaying={handlePlaying}
        lastKnownTimeRef={lastKnownTimeRef}
        refreshAttemptsRef={refreshAttemptsRef}
      />

      {/* Lesson Details & Prev/Next Controls */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Active Lesson</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{lesson.title}</h2>
            <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-600 dark:text-slate-400">
              {lesson.description ??
                'Sharpen your editing reflexes, storytelling pace, and master the technical timeline craft.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(() => {
              const hasDirectVideo = videoMeta.type === 'video' && Boolean(videoMeta.directUrl);
              const isLocked = !effectiveCompleted && hasDirectVideo && watchPercentage < 80;

              return (
                <button
                  onClick={handleToggleComplete}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? `Watch at least 80% to mark complete (currently ${watchPercentage}%)`
                      : effectiveCompleted
                      ? 'Click to toggle incomplete'
                      : 'Mark lesson as complete'
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                    effectiveCompleted
                      ? 'border border-emerald-300/80 dark:border-emerald-500/30 bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/90 dark:hover:bg-emerald-900/60 dark:hover:border-emerald-400/50 cursor-pointer shadow-emerald-950/20'
                      : isLocked
                      ? 'border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'border border-transparent dark:border-orange-500/30 bg-slate-950 dark:bg-orange-600 text-white hover:bg-orange-600 dark:hover:bg-orange-500 cursor-pointer'
                  }`}
                >
                  {effectiveCompleted ? (
                    <span className="flex items-center gap-1.5">
                      <Check size={15} className="text-emerald-700 dark:text-emerald-400" /> Completed
                    </span>
                  ) : isLocked ? (
                    <span className="flex items-center gap-1.5">
                      <Lock size={13} className="text-slate-400 dark:text-slate-500" /> Watch 80% to Complete ({watchPercentage}%)
                    </span>
                  ) : (
                    'Mark as Complete'
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Prev / Next Lesson Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between border-y border-slate-100 dark:border-white/10 py-3 text-xs font-bold gap-2">
          {prevLesson ? (
            <button
              onClick={() => onSelectLesson(prevLesson)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition max-w-[48%] truncate cursor-pointer"
              title={prevLesson.title}
            >
              <ChevronLeft size={16} className="shrink-0" />
              <span className="hidden sm:inline shrink-0">Previous:</span>
              <span className="truncate">{prevLesson.title}</span>
            </button>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <button
              onClick={() => onSelectLesson(nextLesson)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-transparent dark:border-orange-500/20 px-3 py-1.5 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition max-w-[48%] truncate justify-end cursor-pointer"
              title={nextLesson.title}
            >
              <span className="hidden sm:inline shrink-0">Next:</span>
              <span className="truncate">{nextLesson.title}</span>
              <ChevronRight size={16} className="shrink-0" />
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-4 sm:gap-6 border-b border-slate-100 dark:border-white/10 text-xs sm:text-sm font-bold overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap pb-2 cursor-pointer transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-24 pt-5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p>
                Watch the complete demonstration, apply the key cutting and pacing concepts in your timeline, and mark the
                lesson complete to track your streak.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Completing this lesson also automatically unlocks restricted downloadable resources and sample project
                files attached below.
              </p>
            </div>
          )}

          {activeTab === 'resources' && (
            <ResourceList
              resources={resources}
              completed={effectiveCompleted}
              onToggleComplete={handleToggleComplete}
              downloadingResourceId={downloadingResourceId}
              onDownloadResource={handleDownloadResource}
            />
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <p>
                Keep a dedicated notebook or editing journal to jot down timecodes, audio transition notes, and shortcut
                combinations demonstrated in this lesson.
              </p>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-xs">
                <strong className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Editor Pro-Tip:</strong>
                Always cut on subject action or kinetic eye-movement to disguise hard transitions and maintain viewer focus.
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="pt-2">
              <CommunityBoard
                userId={userId || ''}
                cohortId={cohortId}
                lessonId={lesson.id}
                isInlineLesson
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

