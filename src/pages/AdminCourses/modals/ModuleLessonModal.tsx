import { ExternalLink, Lock, Upload, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { detectResourceType, formatFileSize, type ResourceType } from '../../../lib/courseService';
import { useAdminCourses } from '../context/useAdminCourses';
import { FormField, TextareaField } from '../components/SharedSubcomponents';
import type {
  AssignmentEditorState,
  LessonEditorState,
  ModuleEditorState,
  ResourceEditorState,
} from '../types';

export function ModuleLessonModal() {
  const {
    editor,
    setEditor,
    uploadFile,
    setUploadFile,
    handleSave,
    saving,
    uploadingStatus,
    isMentor,
  } = useAdminCourses();

  if (
    !editor ||
    (editor.type !== 'module' &&
      editor.type !== 'lesson' &&
      editor.type !== 'assignment' &&
      editor.type !== 'resource')
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition"
      >
        {/* Modal Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">
              {editor.id ? 'Edit' : 'Create'} {editor.type}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {editor.type === 'module' && (editor.id ? 'Edit Module' : 'New Module')}
              {editor.type === 'lesson' && (editor.id ? 'Edit Lesson' : 'New Lesson')}
              {editor.type === 'assignment' && (editor.id ? 'Edit Assignment' : 'New Assignment')}
              {editor.type === 'resource' && (editor.id ? 'Edit Resource' : 'Add Lesson Resource')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setUploadFile(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 text-left">
          {/* MODULE FIELDS */}
          {editor.type === 'module' && (() => {
            const modEditor = editor as ModuleEditorState;
            return (
              <>
                <FormField
                  label="Module Title"
                  value={modEditor.title}
                  onChange={(val) => setEditor({ ...modEditor, title: val })}
                  placeholder="e.g., Module 1: Editorial Pacing & Narrative Rhythms"
                  required
                />
                <TextareaField
                  label="Module Description (Optional)"
                  value={modEditor.description}
                  onChange={(val) => setEditor({ ...modEditor, description: val })}
                  placeholder="Brief description of what this module covers..."
                  rows={2}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Position / Order"
                    type="number"
                    min="1"
                    value={String(modEditor.position)}
                    onChange={(val) => setEditor({ ...modEditor, position: Number(val) || 1 })}
                    required
                  />
                  <label className="block text-left">
                    <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Module Status
                    </span>
                    <select
                      value={isMentor ? 'draft' : modEditor.status}
                      disabled={isMentor}
                      onChange={(e) =>
                        setEditor({
                          ...modEditor,
                          status: e.target.value as 'draft' | 'review' | 'published' | 'archived',
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isMentor ? (
                        <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          Draft (Requires Admin Confirmation to Publish)
                        </option>
                      ) : (
                        <>
                          <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Draft</option>
                          <option value="review" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">In Review</option>
                          <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Published</option>
                          <option value="archived" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Archived</option>
                        </>
                      )}
                    </select>
                    {isMentor && (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        Mentors save content in Draft status. Confirmation to publish is granted by Parent Super Admin or Child Super Admin.
                      </p>
                    )}
                  </label>
                </div>
              </>
            );
          })()}

          {/* LESSON FIELDS */}
          {editor.type === 'lesson' && (() => {
            const lessonEditor = editor as LessonEditorState;
            return (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <FormField
                      label="Lesson Title"
                      value={lessonEditor.title}
                      onChange={(val) => setEditor({ ...lessonEditor, title: val })}
                      placeholder="e.g., Cutting on Action and Invisible Continuity"
                      required
                    />
                  </div>
                  <label className="block text-left">
                    <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                    <select
                      value={isMentor ? 'draft' : lessonEditor.status}
                      disabled={isMentor}
                      onChange={(e) =>
                        setEditor({
                          ...lessonEditor,
                          status: e.target.value as 'draft' | 'review' | 'published' | 'archived',
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isMentor ? (
                        <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          Draft (Requires Admin Confirmation to Publish)
                        </option>
                      ) : (
                        <>
                          <option value="draft" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Draft</option>
                          <option value="review" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">In Review</option>
                          <option value="published" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Published</option>
                          <option value="archived" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Archived</option>
                        </>
                      )}
                    </select>
                    {isMentor && (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        Mentors save content in Draft status. Confirmation to publish is granted by Parent Super Admin or Child Super Admin.
                      </p>
                    )}
                  </label>
                </div>
                <TextareaField
                  label="Lesson Description"
                  value={lessonEditor.description}
                  onChange={(val) => setEditor({ ...lessonEditor, description: val })}
                  placeholder="Key concepts, video timeline walkthrough, and takeaways..."
                  rows={3}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Position"
                    type="number"
                    min="1"
                    value={String(lessonEditor.position)}
                    onChange={(val) => setEditor({ ...lessonEditor, position: Number(val) || 1 })}
                    required
                  />
                  <FormField
                    label="Duration (Minutes)"
                    type="number"
                    min="1"
                    value={lessonEditor.durationMinutes}
                    onChange={(val) => setEditor({ ...lessonEditor, durationMinutes: val })}
                    placeholder="e.g. 15"
                  />
                </div>

                {/* Video URL or Video File Upload */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lesson Video Content
                  </span>
                  <FormField
                    label="External Video URL (Optional)"
                    value={lessonEditor.videoUrl}
                    onChange={(val) => setEditor({ ...lessonEditor, videoUrl: val })}
                    placeholder="https://..."
                  />
                  <div className="mt-3">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Or Upload Video File (.mp4, .mov, .webm)
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 px-3 py-2 text-xs"
                    />
                    {uploadFile && (
                      <p className="mt-1 text-xs text-emerald-600 font-semibold">
                        Selected for upload: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                      </p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ASSIGNMENT FIELDS */}
          {editor.type === 'assignment' && (() => {
            const assignEditor = editor as AssignmentEditorState;
            return (
              <>
                <FormField
                  label="Assignment Title"
                  value={assignEditor.title}
                  onChange={(val) => setEditor({ ...assignEditor, title: val })}
                  placeholder="e.g., Action Cut Sequence: Challenge #1"
                  required
                />
                <TextareaField
                  label="Assignment Instructions"
                  value={assignEditor.instructions}
                  onChange={(val) => setEditor({ ...assignEditor, instructions: val })}
                  placeholder="Detailed guidelines, editing brief, technical requirements, and submission instructions..."
                  rows={4}
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Deadline / Due Date (Optional)
                  </span>
                  <input
                    type="datetime-local"
                    value={assignEditor.deadline}
                    onChange={(e) => setEditor({ ...assignEditor, deadline: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-950 dark:text-white outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                  />
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                    Students will see a countdown and deadline badge on their dashboard.
                  </span>
                </label>
              </>
            );
          })()}

          {/* RESOURCE FIELDS */}
          {editor.type === 'resource' && (() => {
            const resEditor = editor as ResourceEditorState;
            return (
              <>
                <FormField
                  label="Resource Name / Label"
                  value={resEditor.name}
                  onChange={(val) => setEditor({ ...resEditor, name: val })}
                  placeholder="e.g., Raw Footage & DaVinci Resolve Project (.drp)"
                />

                {/* Resource Source Mode */}
                <div>
                  <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Resource Source</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditor({ ...resEditor, sourceMode: 'upload' })}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        resEditor.sourceMode === 'upload'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Upload size={14} className="mr-1 inline" /> Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditor({ ...resEditor, sourceMode: 'url' })}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        resEditor.sourceMode === 'url'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <ExternalLink size={14} className="mr-1 inline" /> External URL
                    </button>
                  </div>
                </div>

                {resEditor.sourceMode === 'upload' ? (
                  <div>
                    <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Select File (Videos, PDFs, Docs, Images, Project Files)
                    </span>
                    <input
                      type="file"
                      accept="video/*,image/*,application/pdf,.doc,.docx,.txt,.rtf,.zip,.rar,.7z,.prproj,.drp,.fcpxml,.aep,.psd"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setUploadFile(file);
                        if (file && !resEditor.name) {
                          setEditor({
                            ...resEditor,
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            resourceType: detectResourceType(file.name),
                          });
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 px-3 py-2 text-xs"
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Supports Premiere (.prproj), Resolve (.drp), Final Cut (.fcpxml), ZIP, PDF, Docs, Images &amp; Videos.
                    </p>
                    {uploadFile && (
                      <p className="mt-1 text-xs font-semibold text-emerald-600">
                        Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                      </p>
                    )}
                  </div>
                ) : (
                  <FormField
                    label="Direct Download or Web URL"
                    value={resEditor.url}
                    onChange={(val) => {
                      setEditor({
                        ...resEditor,
                        url: val,
                        resourceType: detectResourceType(val),
                      });
                    }}
                    placeholder="https://..."
                    required
                  />
                )}

                {/* Resource Type */}
                <div>
                  <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Resource Category</span>
                  <select
                    value={resEditor.resourceType}
                    onChange={(e) => setEditor({ ...resEditor, resourceType: e.target.value as ResourceType })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-orange-400"
                  >
                    <option value="project_file" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Project File (.prproj, .drp, .fcpxml, .aep, .zip)</option>
                    <option value="pdf" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">PDF Document</option>
                    <option value="document" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Text / Word Document</option>
                    <option value="video" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Video Asset</option>
                    <option value="image" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Image / Graphic</option>
                    <option value="link" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">External Resource Link</option>
                    <option value="other" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Other Asset</option>
                  </select>
                </div>

                {/* Resource Visibility Rules */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
                  <span className="mb-1 block text-sm font-bold text-slate-900 dark:text-white">
                    Resource Visibility Rule
                  </span>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Determine who can access and download this file.
                  </p>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-orange-300 dark:hover:border-orange-500/50">
                      <input
                        type="radio"
                        name="visibility"
                        value="enrolled"
                        checked={resEditor.visibility === 'enrolled'}
                        onChange={() => setEditor({ ...resEditor, visibility: 'enrolled' })}
                        className="mt-1 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                          Enrolled Students (Default)
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Visible to all students actively enrolled in this cohort.
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-orange-300 dark:hover:border-orange-500/50">
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        checked={resEditor.visibility === 'public'}
                        onChange={() => setEditor({ ...resEditor, visibility: 'public' })}
                        className="mt-1 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                          Public Preview
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Accessible to everyone, including prospective students exploring the course.
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-orange-300 dark:hover:border-orange-500/50">
                      <input
                        type="radio"
                        name="visibility"
                        value="after_completion"
                        checked={resEditor.visibility === 'after_completion'}
                        onChange={() => setEditor({ ...resEditor, visibility: 'after_completion' })}
                        className="mt-1 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <strong className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                          <Lock size={12} className="text-amber-600 dark:text-amber-400" /> Locked until Lesson Completed
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Only unlocked after the student marks this lesson complete (great for solutions &amp; source project files).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
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
