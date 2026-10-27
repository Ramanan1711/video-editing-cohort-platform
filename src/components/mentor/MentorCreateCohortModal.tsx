import { useState, type FormEvent } from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { DEFAULT_COHORT_FEE_INR } from '../../lib/paymentService';
import { mentorCreateCohort, type Cohort } from '../../lib/services/curriculumService';
import { useToast } from '../../context/useToast';

interface MentorCreateCohortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCohortCreated: (newCohort: Cohort) => void;
}

export function MentorCreateCohortModal({
  isOpen,
  onClose,
  onCohortCreated,
}: MentorCreateCohortModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trackType, setTrackType] = useState<'general' | 'coding' | 'non_coding'>('general');
  const [durationDays, setDurationDays] = useState(15);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priceInr, setPriceInr] = useState(DEFAULT_COHORT_FEE_INR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && durationDays > 0) {
      const start = new Date(val);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, durationDays - 1));
        setEndDate(end.toISOString().slice(0, 10));
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) {
      const start = new Date(startDate);
      const end = new Date(val);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setDurationDays(Math.max(1, diffDays));
      }
    }
  };

  const handleDurationChange = (val: number) => {
    const days = Math.max(1, val);
    setDurationDays(days);
    if (startDate && days > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, days - 1));
        setEndDate(end.toISOString().slice(0, 10));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Cohort title is required.');
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError('Course end date cannot be earlier than course start date.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const created = await mentorCreateCohort({
        name: name.trim(),
        description: description.trim() || undefined,
        track_type: trackType,
        duration_days: durationDays,
        start_date: startDate ? new Date(`${startDate}T00:00:00Z`).toISOString() : null,
        end_date: endDate ? new Date(`${endDate}T23:59:59Z`).toISOString() : null,
        price_inr: priceInr,
      });

      toast.success('Cohort created as Draft! You can now submit it for administrator review.');
      onCohortCreated(created);
      onClose();
    } catch (err) {
      console.error('Failed to create mentor cohort:', err);
      setError(err instanceof Error ? err.message : 'Failed to create cohort. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Propose New Cohort</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create a curriculum proposal for admin review</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice */}
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
            Mentor Approval Workflow:
          </p>
          <p className="mt-1 leading-relaxed text-[11px] text-blue-800 dark:text-blue-300">
            Your cohort will be created in <strong className="font-semibold">Draft</strong> status. An administrator (Parent Super Admin or Child Super Admin) will review and approve your proposal before you can publish it to students.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Cohort Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cinematic Color Grading & Premiere Pro Mastery"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Description & Learning Objectives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a concise syllabus breakdown, who this cohort is for, and expected project deliverables..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white resize-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Track Type
              </label>
              <select
                value={trackType}
                onChange={(e) => setTrackType(e.target.value as 'general' | 'coding' | 'non_coding')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="general">General</option>
                <option value="non_coding">Video Editing (Non-coding)</option>
                <option value="coding">Coding</option>
              </select>
            </div>

            <div>
              <label htmlFor="mentor-cohort-duration" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Duration (Days)
              </label>
              <input
                id="mentor-cohort-duration"
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10) || 15)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="mentor-cohort-fee" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Fee (INR ₹)
              </label>
              <input
                id="mentor-cohort-fee"
                type="number"
                min="1"
                value={priceInr}
                onChange={(e) => setPriceInr(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_COHORT_FEE_INR))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div>
              <label htmlFor="mentor-cohort-start-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Course Start Date
              </label>
              <input
                id="mentor-cohort-start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="mentor-cohort-end-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Course End Date
              </label>
              <input
                id="mentor-cohort-end-date"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-2xs outline-none focus:border-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-orange-600 hover:bg-orange-700 text-white">
              Create Draft Cohort
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

