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
} from 'lucide-react';
import { Button } from '../ui/Button';
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
  initialUrl = '',
  initialNotes = '',
  isExistingSubmission = false,
  submitting = false,
  maxFileSizeBytes = MAX_CHALLENGE_FILE_SIZE_BYTES,
  onSubmit,
  onCancel,
  mentorPhone = '919876543210',
  studentName = 'Student',
  cohortName = 'Production Cohort',
  dayTitle = 'Sprint Challenge',
  dayNumber = 1,
}) => {
  const safeInitialUrl = initialUrl || '';
  const safeInitialNotes = initialNotes || '';

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

  // File upload state
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
    return validateDeliverableFile(selectedFile, maxFileSizeBytes);
  }, [selectedFile, maxFileSizeBytes]);

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
    const validation = validateDeliverableFile(file, maxFileSizeBytes);
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file.');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          setUploadProgress(15);

          // Simulated smooth progress while uploading
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
          }, 250);

          const uploaded = await uploadSubmissionFile(userId, selectedFile);
          clearInterval(progressInterval);
          setUploadProgress(100);
          finalSubmissionUrl = uploaded;
        } catch (err: unknown) {
          setIsUploading(false);
          setUploadProgress(0);
          const errorMsg =
            err instanceof Error ? err.message : 'Upload failed. Please try again or use the Cloud Link tab.';
          setFileError(errorMsg);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      if (!finalSubmissionUrl) {
        setFileError('Please attach an export file or switch to Cloud Link tab.');
        return;
      }

      await onSubmit({
        submissionUrl: finalSubmissionUrl,
        notes: notes.trim(),
        fileType: fileValidation?.label,
        fileName: selectedFile?.name,
      });
    } else {
      // Cloud Link Mode
      const trimmedUrl = cloudUrl.trim();
      if (!trimmedUrl) {
        setFileError('Please provide a valid deliverable URL.');
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
      {/* ========================================================================= */}
      {/* TABBED MODE SELECTOR */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Submission Method
          </label>
          <span className="text-[11px] font-semibold text-slate-500">
            {mode === 'file' ? 'Direct render export (Max 100MB)' : 'Cloud link with auto-detect'}
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
            accept=".mp4,.mov,.webm,.m4v,.mkv,.png,.jpg,.jpeg,.webp,.svg,.gif,.zip,.rar,.7z,.prproj,.drp,.fcpxml,.aep,.psd,.pdf"
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
                    <div className="flex items-center gap-2 mt-0.5">
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
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 transition"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Progress bar during upload */}
              {isUploading && (
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-900/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-orange-600 dark:text-orange-400">
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      Uploading deliverable to secure student storage...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-orange-200 dark:bg-orange-950">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
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
            /* Drag & Drop Upload Zone */
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

              {/* Formats Chip */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                  MP4 · MOV · WEBM
                </span>
                <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                  PNG · JPG · WEBP
                </span>
                <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 font-mono font-bold">
                  ZIP · PRPROJ · DRP · PDF
                </span>
                <span className="text-slate-400">· Max 100MB</span>
              </div>
            </div>
          )}

          {/* Validation or Upload Error Banner */}
          {fileError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{fileError}</p>
                {fileError.includes('exceeds') && (
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
                placeholder="https://loom.com/... or https://drive.google.com/... or https://frame.io/..."
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
            {['Loom', 'Google Drive', 'Frame.io', 'YouTube', 'GitHub', 'Figma', 'Vimeo'].map((p) => (
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
      {/* SUBMISSION NOTES & REFLECTION */}
      {/* ========================================================================= */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Submission Notes &amp; Implementation Reflection (Optional)
        </label>
        <textarea
          rows={3}
          placeholder="Describe how you approached the challenge, key techniques applied, color grade choices, or any roadblocks encountered..."
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
          disabled={submitting || isUploading || (mode === 'file' && !selectedFile && !existingFileUrl)}
        >
          {submitting || isUploading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>{isUploading ? 'Uploading Export...' : 'Submitting...'}</span>
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
