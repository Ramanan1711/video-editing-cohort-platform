import { X } from 'lucide-react';
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
  } = useAdminCourses();

  if (!editor || editor.type !== 'cohort') return null;

  const cohortEditor = editor as CohortEditorState;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition"
      >
        {/* Modal Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">
              {cohortEditor.id ? 'Edit' : 'Create'} Cohort
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {cohortEditor.id ? 'Edit Cohort' : 'New Cohort'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setUploadFile(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 text-left">
          <FormField
            label="Cohort Name"
            value={cohortEditor.name}
            onChange={(val) => setEditor({ ...cohortEditor, name: val })}
            placeholder="e.g., Premiere Pro Masterclass - Spring 2026"
            required
          />
          <TextareaField
            label="Cohort Description"
            value={cohortEditor.description}
            onChange={(val) => setEditor({ ...cohortEditor, description: val })}
            placeholder="Overview of the learning objectives, deliverables, and expectations..."
            rows={3}
          />
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">
              Master Course Container
            </span>
            <select
              value={cohortEditor.courseId || ''}
              onChange={(e) => setEditor({ ...cohortEditor, courseId: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">(Auto-create or Inherit Master Course)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Publish Status
              </span>
              <select
                value={cohortEditor.status}
                onChange={(e) =>
                  setEditor({
                    ...cohortEditor,
                    status: e.target.value as 'draft' | 'review' | 'published' | 'archived',
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="published">Published</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
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

          <div className="grid gap-4 sm:grid-cols-3">
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
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
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
          <Button type="submit" loading={saving}>
            {uploadingStatus || (saving ? 'Saving...' : 'Save Changes')}
          </Button>
        </div>
      </form>
    </div>
  );
}
