import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  Link2,
  FileText,
  Film,
  Image as ImageIcon,
  Archive,
  Code2,
  Video,
  Play,
  Layout,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Cloud,
  FileCheck,
  Info,
  Loader2,
  MessageSquare,
  Lock,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import {
  uploadSubmissionFile,
  formatFileSize,
  getSecureSubmissionUrl,
} from '../../lib/services/assetStorageService';
import { generateWhatsAppClickToChatUrl } from '../../lib/whatsappService';
import {
  type SubmissionMode,
  detectCloudPlatform,
  validateDeliverableFile,
  isDirectFileUrl,
  getTrackFilterConfig,
  MAX_CHALLENGE_FILE_SIZE_BYTES,
} from '../../lib/services/challengeUploadService';

export interface DynamicChallengeSubmissionBoxProps {
  userId: string;
  challengeId: string;
  initialUrl?: string | null;
  initialNotes?: string | null;
  isExistingSubmission?: boolean;
  submitting?: boolean;
  maxFileSizeBytes?: number;
  trackType?: 'coding' | 'non_coding' | 'general' | 'video' | string | null;
  onSubmit: (data: {
    submissionUrl: string;
    notes: string;
    fileType?: string;
    fileName?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
  mentorPhone?: string;
  studentName?: string;
  cohortName?: string;
  dayTitle?: string;
  dayNumber?: number;
}

export const DynamicChallengeSubmissionBox: React.FC<DynamicChallengeSubmissionBoxProps> = ({
  userId,
  challengeId,
  initialUrl = '',
  initialNotes = '',
  isExistingSubmission = false,
  submitting = false,
  maxFileSizeBytes,
  trackType,
  onSubmit,
  onCancel,
  mentorPhone = '919876543210',
  studentName = 'Student',
  cohortName = 'Production Cohort',
  dayTitle = 'Sprint Challenge',
  dayNumber = 1,
}) => {
  const toast = useToast();
  const safeInitialUrl = initialUrl || '';
  const safeInitialNotes = initialNotes || '';

  // Determine course-aware track filters and size limits
  const trackFilterConfig = useMemo(() => {
    return getTrackFilterConfig(trackType, cohortName);
  }, [trackType, cohortName]);

  const effectiveMaxFileSizeBytes = useMemo(() => {
    if (typeof maxFileSizeBytes === 'number' && maxFileSizeBytes > 0) {
      return maxFileSizeBytes;
    }
    // If trackType was explicitly provided, use course-specific limit
    if (trackType) {
      return trackFilterConfig.maxSizeBytes;
    }
    return MAX_CHALLENGE_FILE_SIZE_BYTES;
  }, [maxFileSizeBytes, trackType, trackFilterConfig.maxSizeBytes]);

  // Determine smart initial mode
  const initialMode: SubmissionMode = useMemo(() => {
    if (safeInitialUrl && !isDirectFileUrl(safeInitialUrl)) {
      return 'link';
    }
    return 'file';
  }, [safeInitialUrl]);

  const [mode, setMode] = useState<SubmissionMode>(initialMode);
  const [cloudUrl, setCloudUrl] = useState(safeInitialUrl && !isDirectFileUrl(safeInitialUrl) ? safeInitialUrl : '');
  const [notes, setNotes] = useState(safeInitialNotes);

  // Draft auto-save state
  const draftStorageKey = useMemo(() => {
    return userId && challengeId ? `procuthub_draft_notes_${userId}_${challengeId}` : null;
  }, [userId, challengeId]);
  const [draftSaved, setDraftSaved] = useState(false);

  // Restore draft notes on mount if no initial notes exist
  useEffect(() => {
    if (!draftStorageKey || safeInitialNotes) return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved && saved.trim()) {
        setNotes(saved);
        setDraftSaved(true);
      }
    } catch {
      // LocalStorage access may fail in private mode
    }
  }, [draftStorageKey, safeInitialNotes]);

  // Auto-save draft notes debounced
  useEffect(() => {
    if (!draftStorageKey) return;
    if (!notes.trim() || notes.trim() === safeInitialNotes.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftStorageKey, notes.trim());
        setDraftSaved(true);
      } catch {
        // Ignore localStorage quota or restriction errors
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [notes, draftStorageKey, safeInitialNotes]);

  // Network offline and slow connection awareness
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    interface NetworkInformationLike {
      effectiveType?: string;
      saveData?: boolean;
      addEventListener?: (event: string, fn: () => void) => void;
      removeEventListener?: (event: string, fn: () => void) => void;
    }

    const nav = navigator as unknown as {
      connection?: NetworkInformationLike;
      mozConnection?: NetworkInformationLike;
      webkitConnection?: NetworkInformationLike;
    };

    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    const checkSpeed = () => {
      if (conn?.effectiveType) {
        const slow =
          conn.effectiveType === 'slow-2g' ||
          conn.effectiveType === '2g' ||
          conn.effectiveType === '3g' ||
          Boolean(conn.saveData);
        setIsSlowConnection(slow);
      }
    };

    checkSpeed();
    if (conn?.addEventListener) {
      conn.addEventListener('change', checkSpeed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn?.removeEventListener) {
        conn.removeEventListener('change', checkSpeed);
      }
    };
  }, []);

  // File upload state & abort controller
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(
    safeInitialUrl && isDirectFileUrl(safeInitialUrl) ? safeInitialUrl : null
  );
  const [resolvedExistingUrl, setResolvedExistingUrl] = useState<string | null>(null);
  const [isResolvingSignedUrl, setIsResolvingSignedUrl] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Automatically generate a secure expiring signed URL for existing private deliverables
  useEffect(() => {
    if (!existingFileUrl) {
      setResolvedExistingUrl(null);
      return;
    }
    let active = true;
    setIsResolvingSignedUrl(true);
    getSecureSubmissionUrl(existingFileUrl, 3600)
      .then((url) => {
        if (active) {
          setResolvedExistingUrl(url);
          setIsResolvingSignedUrl(false);
        }
      })
      .catch((err) => {
        console.warn('Could not generate secure signed URL for existing deliverable:', err);
        if (active) {
          setResolvedExistingUrl(existingFileUrl);
          setIsResolvingSignedUrl(false);
        }
      });

    return () => {
      active = false;
    };
  }, [existingFileUrl]);

  // Auto-detect cloud platform
  const detectedPlatform = useMemo(() => {
    return detectCloudPlatform(cloudUrl);
  }, [cloudUrl]);

  // File validation memo
  const fileValidation = useMemo(() => {
    if (!selectedFile) return null;
    return validateDeliverableFile(
      selectedFile,
      trackFilterConfig.track,
      effectiveMaxFileSizeBytes,
      cohortName
    );
  }, [selectedFile, trackFilterConfig.track, effectiveMaxFileSizeBytes, cohortName]);

  // Generate thumbnail preview for images
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedFile]);

  // Handle file selection
  const handleSelectFile = (file: File) => {
    setFileError(null);
    const validation = validateDeliverableFile(
      file,
      trackFilterConfig.track,
      effectiveMaxFileSizeBytes,
      cohortName
    );
    if (!validation.valid) {
      const errorMsg = validation.error || 'Invalid file.';
      setFileError(errorMsg);
      toast.error(errorMsg);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setExistingFileUrl(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleSelectFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExistingFileUrl(null);
    setResolvedExistingUrl(null);
    setFileError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setFileError('Upload was cancelled. You can select another file or submit via Cloud Link.');
  };

  const handleInspectExistingDeliverable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!existingFileUrl) return;
    try {
      setIsResolvingSignedUrl(true);
      const secureUrl = await getSecureSubmissionUrl(existingFileUrl, 3600);
      setIsResolvingSignedUrl(false);
      window.open(secureUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setIsResolvingSignedUrl(false);
      window.open(resolvedExistingUrl || existingFileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Form submission handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'file') {
      let finalSubmissionUrl = existingFileUrl || '';

      if (selectedFile) {
        try {
          setIsUploading(true);
          setUploadProgress(0);

          const controller = new AbortController();
          uploadAbortControllerRef.current = controller;

          const uploaded = await uploadSubmissionFile(userId, selectedFile, {
            onProgress: (percent) => setUploadProgress(percent),
            signal: controller.signal,
          });

          setUploadProgress(100);
          finalSubmissionUrl = uploaded;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            setIsUploading(false);
            setUploadProgress(0);
            setFileError('Upload was cancelled.');
            return;
          }
          setIsUploading(false);
          setUploadProgress(0);
          const errorMsg =
            err instanceof Error
              ? err.message
              : 'Upload failed. Please try again or use the Cloud Link tab.';
          setFileError(errorMsg);
          toast.error(errorMsg);
          return;
        } finally {
          uploadAbortControllerRef.current = null;
          setIsUploading(false);
        }
      }

      if (!finalSubmissionUrl) {
        setFileError('Please attach an export file or switch to Cloud Link tab.');
        toast.error('Please attach an export file or switch to Cloud Link tab.');
        return;
      }

      await onSubmit({
        submissionUrl: finalSubmissionUrl,
        notes: notes.trim(),
        fileType: fileValidation?.label,
        fileName: selectedFile?.name,
      });

      // Clear draft notes upon successful submission
      if (draftStorageKey) {
        try {
          localStorage.removeItem(draftStorageKey);
          setDraftSaved(false);
        } catch {
          // Ignore localStorage removal errors in sandboxed environments
        }
      }
    } else {
      // Cloud Link Mode
      const trimmedUrl = cloudUrl.trim();
      if (!trimmedUrl) {
        setFileError('Please provide a valid deliverable URL.');
        toast.error('Please provide a valid deliverable URL.');
        return;
      }

      // Check valid URL scheme
      let normalizedUrl = trimmedUrl;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      await onSubmit({
        submissionUrl: normalizedUrl,
        notes: notes.trim(),
        fileType: detectedPlatform.badgeText,
      });

      // Clear draft notes upon successful submission
      if (draftStorageKey) {
        try {
          localStorage.removeItem(draftStorageKey);
          setDraftSaved(false);
        } catch {
          // Ignore localStorage removal errors in sandboxed environments
        }
      }
    }
  };

  const renderFileCategoryIcon = (category: string) => {
    switch (category) {
      case 'video':
        return <Film size={22} className="text-purple-500" />;
      case 'image':
        return <ImageIcon size={22} className="text-blue-500" />;
      case 'archive':
        return <Archive size={22} className="text-amber-500" />;
      case 'code':
        return <Code2 size={22} className="text-emerald-500" />;
      case 'document':
        return <FileText size={22} className="text-emerald-500" />;
      default:
        return <FileCheck size={22} className="text-orange-500" />;
    }
  };

  const renderPlatformIcon = (iconName: string) => {
    switch (iconName) {
      case 'video':
        return <Video size={16} className="text-indigo-500" />;
      case 'cloud':
        return <Cloud size={16} className="text-blue-500" />;
      case 'film':
        return <Film size={16} className="text-purple-500" />;
      case 'play':
        return <Play size={16} className="text-red-500" fill="currentColor" />;
      case 'code':
        return <Code2 size={16} className="text-slate-600 dark:text-slate-300" />;
      case 'layout':
        return <Layout size={16} className="text-pink-500" />;
      default:
        return <Link2 size={16} className="text-slate-500" />;
    }
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200 animate-in fade-in">
          <WifiOff size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">You are currently offline</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              File uploads and submissions require an active network connection. Submissions will be re-enabled once reconnected.
            </p>
          </div>
        </div>
      )}

      {/* Slow Mobile Connection Advisory */}
      {isSlowConnection && mode === 'file' && !isOffline && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 p-3 flex items-start justify-between gap-3 text-xs text-sky-800 dark:text-sky-300 animate-in fade-in">
          <div className="flex items-start gap-2">
            <Info size={15} className="text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Slow mobile connection detected (2G/3G)</p>
              <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5 leading-relaxed">
                Direct uploads over mobile data may be slower. For faster submission, you can share via{' '}
                <strong>Frame.io, Loom, YouTube</strong>, or <strong>Google Drive</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('link')}
            className="shrink-0 rounded-lg bg-sky-100 dark:bg-sky-900/60 px-2.5 py-1 text-[11px] font-black text-sky-700 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800 transition"
          >
            Switch to Link
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABBED MODE SELECTOR */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Submission Method
          </label>
          <span className="text-[11px] font-semibold text-slate-500">
            {mode === 'file'
              ? `${trackFilterConfig.label} (Max ${formatFileSize(effectiveMaxFileSizeBytes)})`
              : 'Cloud link with auto-detect'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setMode('file');
              setFileError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-black transition-all ${
              mode === 'file'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud size={16} />
            <span>Direct File Upload</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('link');
              setFileError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-black transition-all ${
              mode === 'link'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Link2 size={16} />
            <span>Cloud / External Link</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: DIRECT FILE UPLOAD ZONE */}
      {/* ========================================================================= */}
      {mode === 'file' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={trackFilterConfig.acceptAttribute}
            onChange={handleFileInputChange}
          />

          {/* Active File Preview Card */}
          {selectedFile ? (
            <div className="relative rounded-2xl border-2 border-orange-500/50 bg-orange-50/20 dark:bg-orange-950/20 p-4 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Deliverable thumbnail"
                      className="size-12 rounded-xl object-cover border border-orange-500/30"
                    />
                  ) : (
                    <div className="size-12 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center border border-orange-500/20">
                      {renderFileCategoryIcon(fileValidation?.category || 'other')}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500">
                        {formatFileSize(selectedFile.size)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="rounded-md bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 text-[10px] font-extrabold text-orange-700 dark:text-orange-300">
                        {fileValidation?.label || 'Export'}
                      </span>
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Validated
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                  aria-label="Remove attached file"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 transition disabled:opacity-50"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Live progress circle & bar during upload with Cancel button */}
              {isUploading ? (
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-900/50 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/40 p-3 border border-orange-200/80 dark:border-orange-900/50">
                    {/* Animated SVG Progress Circle */}
                    <div className="relative size-11 shrink-0">
                      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-orange-200 dark:text-orange-950"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-orange-500 transition-all duration-200 stroke-current"
                          strokeWidth="3.5"
                          strokeDasharray={`${uploadProgress}, 100`}
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 font-mono">
                          {uploadProgress}%
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        Streaming to Private Supabase Storage
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Loader2 size={10} className="animate-spin text-orange-500" />
                        <span>Generating expiring signed URL for mentor review</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      aria-label="Cancel upload"
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition shrink-0"
                    >
                      <X size={11} />
                      <span>Cancel Upload</span>
                    </button>
                  </div>

                  {/* Animated gradient progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950">
                    <div
                      role="progressbar"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 transition-all duration-200"
                      style={{ width: `${Math.max(uploadProgress, 4)}%` }}
                    />
                  </div>
                </div>
              ) : (
                /* Pre-submission File Actions: Replace & Remove buttons */
                <div className="mt-3 pt-2.5 border-t border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Ready for submission
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace File
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Remove File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : existingFileUrl ? (
            /* Previously Submitted File Card */
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                    <FileCheck size={20} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        Previously Attached Deliverable
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        <Lock size={9} />
                        Private Storage • Expiring Token (1h)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md mt-0.5">
                      {existingFileUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={resolvedExistingUrl || existingFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleInspectExistingDeliverable}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-orange-500 transition"
                  >
                    <span>{isResolvingSignedUrl ? 'Securing Link...' : 'Inspect'}</span>
                    <ExternalLink size={12} />
                  </a>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setExistingFileUrl(null);
                      setResolvedExistingUrl(null);
                      fileInputRef.current?.click();
                    }}
                  >
                    Replace File
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Drag & Drop Upload Zone with Course-Aware Hints */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
                  : 'border-slate-300 dark:border-slate-700 hover:border-orange-500/80 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-orange-50/10'
              }`}
            >
              <div className="size-12 rounded-2xl bg-orange-100 dark:bg-orange-950/80 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform mb-3 shadow-inner">
                <UploadCloud size={24} />
              </div>

              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isDragging ? 'Release to attach deliverable' : 'Drag & drop your export file here'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                or <span className="font-extrabold text-orange-600 dark:text-orange-400 underline underline-offset-2">browse files</span> from your computer
              </p>

              {/* Course-Aware Formats & Size Guidance Chip */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-slate-500">
                {trackFilterConfig.track === 'coding' ? (
                  <>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      ZIP · TAR.GZ · PY
                    </span>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      JAVA · TS · JSON
                    </span>
                    <span className="text-slate-400">· Max 50MB</span>
                  </>
                ) : trackFilterConfig.track === 'video' ? (
                  <>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      MP4 · MOV · WAV
                    </span>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      ZIP · PRPROJ · DRP
                    </span>
                    <span className="text-slate-400">· Max 500MB</span>
                  </>
                ) : (
                  <>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      MP4 · MOV · WEBM
                    </span>
                    <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                      ZIP · PRPROJ · DRP · PDF
                    </span>
                    <span className="text-slate-400">· Max 100MB</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Validation or Upload Error Banner */}
          {fileError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{fileError}</p>
                {(fileError.includes('exceeds') || fileError.includes('Cloud Link')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('link');
                      setFileError(null);
                    }}
                    className="inline-flex items-center gap-1 font-extrabold text-red-800 dark:text-red-200 underline"
                  >
                    <span>Switch to Cloud Link tab</span>
                    <Link2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: CLOUD / EXTERNAL LINK WITH AUTO-DETECTION */}
      {/* ========================================================================= */}
      {mode === 'link' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Deliverable URL *
              </label>
              {cloudUrl && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black border ${detectedPlatform.badgeStyle.bg} ${detectedPlatform.badgeStyle.text} ${detectedPlatform.badgeStyle.border}`}
                >
                  {renderPlatformIcon(detectedPlatform.icon)}
                  <span>{detectedPlatform.badgeText}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="url"
                required={mode === 'link'}
                placeholder={
                  trackFilterConfig.track === 'coding'
                    ? 'https://github.com/... or https://drive.google.com/...'
                    : 'https://loom.com/... or https://drive.google.com/... or https://frame.io/...'
                }
                value={cloudUrl}
                onChange={(e) => {
                  setCloudUrl(e.target.value);
                  setFileError(null);
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-3 pr-10 text-xs text-slate-900 dark:text-white shadow-2xs outline-none focus:border-orange-500 font-mono"
              />
              <div className="absolute right-3 top-2.5 text-slate-400">
                {renderPlatformIcon(detectedPlatform.icon)}
              </div>
            </div>
          </div>

          {/* Auto-detected Platform Helper Card */}
          {cloudUrl && (
            <div
              className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs transition-all ${detectedPlatform.badgeStyle.bg} ${detectedPlatform.badgeStyle.border}`}
            >
              <Info size={14} className="shrink-0 mt-0.5 text-slate-500" />
              <p className={`text-[11px] leading-relaxed ${detectedPlatform.badgeStyle.text}`}>
                <span className="font-bold">{detectedPlatform.name}: </span>
                {detectedPlatform.tip}
              </p>
            </div>
          )}

          {/* Quick Supported Platform Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500">
            <span className="font-bold text-slate-400">Supported:</span>
            {trackFilterConfig.track === 'coding'
              ? ['GitHub PR', 'GitHub Repo', 'Google Drive', 'Loom Walkthrough'].map((p) => (
                  <span
                    key={p}
                    className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                  >
                    {p}
                  </span>
                ))
              : ['Loom', 'Google Drive', 'Frame.io', 'YouTube', 'GitHub', 'Figma', 'Vimeo'].map((p) => (
                  <span
                    key={p}
                    className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                  >
                    {p}
                  </span>
                ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBMISSION NOTES & REFLECTION WITH AUTO-SAVE FEEDBACK */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Submission Notes &amp; Implementation Reflection (Optional)
          </label>
          {draftSaved && notes.trim().length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
              <Sparkles size={11} className="text-emerald-500" />
              <span>Draft auto-saved</span>
            </span>
          )}
        </div>
        <textarea
          rows={3}
          placeholder={
            trackFilterConfig.track === 'coding'
              ? 'Describe your architecture decisions, edge cases handled, data structures used, or test coverage...'
              : 'Describe how you approached the challenge, key techniques applied, color grade choices, or any roadblocks encountered...'
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white shadow-2xs outline-none focus:border-orange-500"
        />
      </div>

      {/* ========================================================================= */}
      {/* WHATSAPP MENTOR QUICK HELP */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-emerald-500" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Stuck on this task?
          </span>
        </div>
        <a
          href={generateWhatsAppClickToChatUrl(
            mentorPhone,
            `Hi Mentor! I am ${studentName} from ${cohortName}. I am currently working on Day ${dayNumber}: ${dayTitle} and have a question regarding the challenge requirements.`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <span>Ask Mentor on WhatsApp</span>
          <ExternalLink size={11} />
        </a>
      </div>

      {/* ========================================================================= */}
      {/* ACTION BUTTONS */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting || isUploading}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            submitting ||
            isUploading ||
            isOffline ||
            (mode === 'file' && !selectedFile && !existingFileUrl)
          }
        >
          {submitting || isUploading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>{isUploading ? `Uploading (${uploadProgress}%)...` : 'Submitting...'}</span>
            </span>
          ) : (
            <>
              <Send size={14} />
              {isExistingSubmission ? 'Update Submission' : 'Submit Challenge'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
