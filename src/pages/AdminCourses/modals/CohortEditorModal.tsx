import { X, Layers } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DEFAULT_COHORT_FEE_INR } from '../../../lib/paymentService';
import { useAdminCourses } from '../context/useAdminCourses';
import { FormField, TextareaField } from '../components/SharedSubcomponents';
import type { CohortEditorState } from '../types';

export function CohortEditorModal() {
  const {
    editor,
    setEditor,
    setUploadFile,
    courses,
    handleSave,
    saving,
    uploadingStatus,
    isAdmin,
    isMentor,
  } = useAdminCourses();

  if (!editor || editor.type !== 'cohort') return null;

  const cohortEditor = editor as CohortEditorState;

  const handleStartDateChange = (val: string) => {
    const nextState = { ...cohortEditor, startDate: val };
    if (val && cohortEditor.durationDays && Number(cohortEditor.durationDays) > 0) {
      const start = new Date(val);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, Number(cohortEditor.durationDays) - 1));
        nextState.endDate = end.toISOString().slice(0, 10);
      }
    }
    setEditor(nextState);
  };

  const handleEndDateChange = (val: string) => {
    const nextState = { ...cohortEditor, endDate: val };
    if (cohortEditor.startDate && val) {
      const start = new Date(cohortEditor.startDate);
      const end = new Date(val);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        nextState.durationDays = String(Math.max(1, diffDays));
      }
    }
    setEditor(nextState);
  };

  const handleDurationChange = (val: string) => {
    const nextState = { ...cohortEditor, durationDays: val };
    if (cohortEditor.startDate && val && Number(val) > 0) {
      const start = new Date(cohortEditor.startDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, Number(val) - 1));
        nextState.endDate = end.toISOString().slice(0, 10);
      }
    }
    setEditor(nextState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm">
      <form
        onSubmit={handleSave}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
              <Layers size={18} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                {cohortEditor.id ? 'Edit Configuration' : 'Cohort Configuration'}
              </p>
              <h3 className="text-lg font-black text-slate-950 dark:text-white leading-tight">
                {cohortEditor.id ? 'Edit Cohort' : 'New Cohort'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setUploadFile(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-left flex-1 min-h-0">
          {/* General Information */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField
              label="Cohort Name"
              value={cohortEditor.name}
              onChange={(val) => setEditor({ ...cohortEditor, name: val })}
              placeholder="e.g., Premiere Pro Masterclass - Spring 2026"
              required
            />
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Master Course Container
              </span>
              <select
                value={cohortEditor.courseId || ''}
                onChange={(e) => setEditor({ ...cohortEditor, courseId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-xs transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">(Auto-create or Inherit Master Course)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <TextareaField
            label="Cohort Description"
            value={cohortEditor.description}
            onChange={(val) => setEditor({ ...cohortEditor, description: val })}
            placeholder="Overview of the learning objectives, deliverables, and expectations..."
            rows={2}
          />

          {/* Publishing & Access */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Publish Status
              </span>
              <select
                value={cohortEditor.status}
                disabled={isMentor && !cohortEditor.id}
                onChange={(e) =>
                  setEditor({
                    ...cohortEditor,
                    status: e.target.value as CohortEditorState['status'],
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-xs transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isMentor ? (
                  !cohortEditor.id ? (
                    <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      Draft (Upload Curriculum First)
                    </option>
                  ) : cohortEditor.status === 'approved' ? (
                    <>
                      <option value="approved" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Approved
                      </option>
                      <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Published
                      </option>
                    </>
                  ) : cohortEditor.status === 'published' ? (
                    <>
                      <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Published
                      </option>
                      <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Draft
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Draft
                      </option>
                      <option value="reviewing" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Reviewing (In Review)
                      </option>
                    </>
                  )
                ) : (
                  <>
                    <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Draft</option>
                    <option value="reviewing" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Reviewing (In Review)</option>
                    <option value="approved" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Approved</option>
                    <option value="rejected" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Rejected</option>
                    <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Published</option>
                    <option value="upcoming" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Upcoming</option>
                    <option value="active" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Active</option>
                    <option value="completed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Completed</option>
                    <option value="archived" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Archived</option>
                  </>
                )}
              </select>
            </label>

            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Visibility
              </span>
              <select
                value={cohortEditor.visibility}
                onChange={(e) =>
                  setEditor({
                    ...cohortEditor,
                    visibility: e.target.value as 'public' | 'private' | 'unlisted',
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-xs transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="public" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Public</option>
                <option value="private" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Private</option>
                <option value="unlisted" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Unlisted</option>
              </select>
            </label>

            <FormField
              label="Capacity"
              type="number"
              min="1"
              value={cohortEditor.capacity}
              onChange={(val) => setEditor({ ...cohortEditor, capacity: val })}
              placeholder="30"
            />
          </div>

          {/* Enrollment Window & Pricing */}
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              label="Enrollment Fee (INR ₹)"
              type="number"
              min="1"
              value={cohortEditor.priceInr}
              onChange={(val) => setEditor({ ...cohortEditor, priceInr: val })}
              placeholder={String(DEFAULT_COHORT_FEE_INR)}
              required
            />
            <FormField
              label="Enrollment Start"
              type="datetime-local"
              value={cohortEditor.enrollmentStart}
              onChange={(val) => setEditor({ ...cohortEditor, enrollmentStart: val })}
            />
            <FormField
              label="Enrollment End"
              type="datetime-local"
              value={cohortEditor.enrollmentEnd}
              onChange={(val) => setEditor({ ...cohortEditor, enrollmentEnd: val })}
            />
          </div>

          {/* Course Duration & Schedule */}
          <div className="rounded-xl border border-orange-200/80 dark:border-orange-950/70 bg-orange-50/40 dark:bg-orange-950/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Course Duration & Schedule
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Powers daily pacing & calendar unlocking
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                label="Duration (Days)"
                type="number"
                min="1"
                value={cohortEditor.durationDays}
                onChange={handleDurationChange}
                placeholder="15"
                required
              />
              <FormField
                label="Course Start Date"
                type="date"
                value={cohortEditor.startDate}
                onChange={handleStartDateChange}
              />
              <FormField
                label="Course End Date"
                type="date"
                value={cohortEditor.endDate}
                onChange={handleEndDateChange}
              />
            </div>
          </div>

          {/* Review Feedback */}
          {isAdmin ? (
            <TextareaField
              label="Review Feedback (for Mentor Proposals)"
              value={cohortEditor.reviewFeedback || ''}
              onChange={(val) => setEditor({ ...cohortEditor, reviewFeedback: val })}
              placeholder="Feedback, revision notes, or approval comments for the creator mentor..."
              rows={2}
            />
          ) : (
            <div className="space-y-1.5 text-left">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Administrator Review Feedback
              </span>
              {cohortEditor.reviewFeedback ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">{cohortEditor.reviewFeedback}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-3 text-xs text-slate-500 dark:text-slate-400 italic">
                  Feedback and notes from Parent Super Admin or Child Super Admin will appear here once reviewed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Modal Actions Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-orange-500" />
            <span>
              {cohortEditor.id ? 'Editing existing cohort' : 'Creating new cohort'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditor(null);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
              {uploadingStatus || (saving ? 'Saving...' : 'Save Changes')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
