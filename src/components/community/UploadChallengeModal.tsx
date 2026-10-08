import React, { useState } from 'react';
import {
  X,
  Upload,
  Sparkles,
  BookOpen,
  AlertCircle,
  Loader2,
  Film,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import type { CourseOption } from '../../lib/gamificationService';
import {
  createCourseChallenge,
  type CourseChallengeItem,
  type CreateChallengeInput,
} from '../../lib/courseChallengeService';
import { detectCloudPlatform } from '../../lib/services/challengeUploadService';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

interface UploadChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CourseOption[];
  defaultCohortId?: string;
  onChallengeCreated: (challenge: CourseChallengeItem) => void;
}

export const UploadChallengeModal: React.FC<UploadChallengeModalProps> = ({
  isOpen,
  onClose,
  courses,
  defaultCohortId,
  onChallengeCreated,
}) => {
  useModalScrollLock(isOpen);
  const { user } = useAuth();

  const [cohortId, setCohortId] = useState<string>(
    defaultCohortId && defaultCohortId !== 'all' ? defaultCohortId : courses[0]?.id || ''
  );
  const [type, setType] = useState<'PROJECT' | 'TASK'>('PROJECT');
  const [week, setWeek] = useState('WEEK 3');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} ${d.getFullYear()}`;
  });
  const [durationLabel, setDurationLabel] = useState('7 days');
  const [status, setStatus] = useState<'active' | 'upcoming' | 'completed'>('active');
  const [proReward, setProReward] = useState<number>(50);

  // Asset deliverable states
  const [assetMode, setAssetMode] = useState<'file' | 'link'>('file');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetUrl, setAssetUrl] = useState('');
  const [assetName, setAssetName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const detectedPlatform = assetUrl.trim() ? detectCloudPlatform(assetUrl) : null;
  const selectedCourse = courses.find((c) => c.id === cohortId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a challenge title.');
      return;
    }
    if (!cohortId) {
      setErrorMsg('Please select a course for this challenge.');
      return;
    }

    try {
      setIsSubmitting(true);

      const input: CreateChallengeInput = {
        cohortId,
        cohortTitle: selectedCourse?.title,
        type,
        week: week.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        durationLabel: durationLabel.trim() || '7 days',
        status,
        proReward,
        assetFile: assetMode === 'file' && assetFile ? assetFile : undefined,
        assetUrl: assetMode === 'link' && assetUrl.trim() ? assetUrl.trim() : undefined,
        assetName: assetMode === 'link' ? assetName.trim() || undefined : undefined,
      };

      const created = await createCourseChallenge(input, user ? { id: user.id } : undefined);
      onChallengeCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create challenge:', err);
      setErrorMsg(err.message || 'Failed to upload challenge. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Upload New Challenge
              </h3>
              <p className="text-xs text-slate-500">
                Publish a dynamic course-specific challenge with deliverables and PRO rewards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Target Course Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen size={14} className="text-amber-500" />
              <span>Target Course Track *</span>
            </label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Challenge Type & Week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Challenge Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('PROJECT')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition ${
                    type === 'PROJECT'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Film size={14} />
                  <span>PROJECT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('TASK')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition ${
                    type === 'TASK'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers size={14} />
                  <span>TASK</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Week Label
              </label>
              <select
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="WEEK 1">WEEK 1</option>
                <option value="WEEK 2">WEEK 2</option>
                <option value="WEEK 3">WEEK 3</option>
                <option value="WEEK 4">WEEK 4</option>
                <option value="WEEK 5">WEEK 5</option>
                <option value="WEEK 6">WEEK 6</option>
              </select>
            </div>
          </div>

          {/* 3. Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Challenge Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. B15 W3 Project - 3 Remix the emotion"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* 4. Dates & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Start Date
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="7 Sep"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                End Date
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="13 Sep 2026"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Duration Label
              </label>
              <input
                type="text"
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder="7 days"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* 5. Rewards & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>PRO Points Reward</span>
                <span className="text-amber-500 font-extrabold">🪙 {proReward} PRO</span>
              </label>
              <div className="flex items-center gap-2">
                {[50, 100, 150, 200].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setProReward(pts)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                      proReward === pts
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Publication Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="active">Active (Happening Now)</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed / Archive</option>
              </select>
            </div>
          </div>

          {/* 6. Description / Brief */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description &amp; Creative Instructions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline the goals, pacing guidelines, footage requirements, and deliverables..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* 7. Deliverable Assets (File or Cloud Link) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Challenge Starter Asset / Footage Pack (Optional)
              </span>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setAssetMode('file')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    assetMode === 'file'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setAssetMode('link')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    assetMode === 'link'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cloud Link
                </button>
              </div>
            </div>

            {assetMode === 'file' ? (
              <div>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-amber-400 p-4 cursor-pointer transition bg-white dark:bg-slate-900">
                  <Upload size={20} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {assetFile ? assetFile.name : 'Click to upload project zip, footage pack, or PDF brief'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {assetFile ? `${(assetFile.size / (1024 * 1024)).toFixed(1)} MB selected` : 'Supports .zip, .prproj, .drp, .pdf, .mp4'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAssetFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={assetUrl}
                  onChange={(e) => setAssetUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://frame.io/..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Asset label (e.g. 4K Raw Footage Pack - 2.4 GB)"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                />
                {detectedPlatform && (
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-bold border ${detectedPlatform.badgeStyle.bg} ${detectedPlatform.badgeStyle.text} ${detectedPlatform.badgeStyle.border}`}>
                    <span>{detectedPlatform.badgeText}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-md shadow-amber-900/20 hover:brightness-105 active:scale-95 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Publishing Challenge...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Publish Challenge</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
