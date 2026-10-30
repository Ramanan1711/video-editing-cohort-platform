import { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  detectResourceType,
  formatFileSize,
  getVideoThumbnailUrl,
  type ResourceType,
} from '../../../lib/courseService';
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
    uploadThumbnailFile,
    setUploadThumbnailFile,
    handleSave,
    saving,
    uploadingStatus,
    isMentor,
  } = useAdminCourses();

  const [localThumbnailPreview, setLocalThumbnailPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadThumbnailFile) {
      setLocalThumbnailPreview(null);
      return;
    }
    let objectUrl: string | null = null;
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        objectUrl = URL.createObjectURL(uploadThumbnailFile);
        setLocalThumbnailPreview(objectUrl);
      }
    } catch {
      setLocalThumbnailPreview(null);
    }
    return () => {
      if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [uploadThumbnailFile]);

  if (
    !editor ||
    (editor.type !== 'module' &&
      editor.type !== 'lesson' &&
      editor.type !== 'assignment' &&
      editor.type !== 'resource')
  ) {
    return null;
  }

  const getEditorIcon = () => {
    switch (editor.type) {
      case 'module':
        return <BookOpen size={18} />;
      case 'lesson':
        return <Video size={18} />;
      case 'assignment':
        return <FileText size={18} />;
      case 'resource':
        return <Paperclip size={18} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm">
      <form
        onSubmit={handleSave}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 shrink-0">
              {getEditorIcon()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                {editor.id ? 'Edit' : 'Create'} {editor.type}
              </p>
              <h3 className="text-lg font-black text-slate-950 dark:text-white leading-tight truncate">
                {editor.type === 'module' && (editor.id ? 'Edit Module' : 'New Module')}
                {editor.type === 'lesson' && (editor.id ? 'Edit Lesson' : 'New Lesson')}
                {editor.type === 'assignment' && (editor.id ? 'Edit Assignment' : 'New Assignment')}
                {editor.type === 'resource' && (editor.id ? 'Edit Resource' : 'Add Lesson Resource')}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setUploadFile(null);
              setUploadThumbnailFile(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition shrink-0 ml-2"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto space-y-4 text-left flex-1 min-h-0 min-w-0 max-w-full">
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
                <div className="grid gap-3.5 sm:grid-cols-2">
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
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-xs transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                <div className="grid gap-3.5 sm:grid-cols-3">
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
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-xs transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                  rows={2}
                />

                <div className="grid gap-3.5 sm:grid-cols-2">
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
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3.5 space-y-3">
                  <span className="block text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Lesson Video Content
                  </span>
                  <FormField
                    label="External Video URL (Optional)"
                    value={lessonEditor.videoUrl}
                    onChange={(val) => setEditor({ ...lessonEditor, videoUrl: val })}
                    placeholder="https://..."
                  />
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Or Upload Video File (.mp4, .mov, .webm)
                    </span>
                    <input
                      type="file"
                      aria-label="Upload Video File"
                      accept="video/mp4,video/quicktime,video/webm,video/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="block w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 px-3 py-2 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-orange-500/10 file:text-orange-600 dark:file:text-orange-400 hover:file:bg-orange-500/20 cursor-pointer"
                    />
                    {uploadFile && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium min-w-0 max-w-full overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate block font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {uploadFile.name}
                          </span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">
                            ({formatFileSize(uploadFile.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadFile(null)}
                          className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 text-xs font-bold shrink-0 px-1 py-0.5 rounded transition cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Thumbnail Provision */}
                {(() => {
                  const customUrl = lessonEditor.thumbnailUrl?.trim() || null;
                  const autoUrl = getVideoThumbnailUrl(lessonEditor.videoUrl);
                  const activeThumbnail = localThumbnailPreview || customUrl || autoUrl || null;
                  const isCustomThumbnail = Boolean(uploadThumbnailFile || localThumbnailPreview || customUrl);
                  const isAutoThumbnail = !isCustomThumbnail && Boolean(autoUrl);

                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 sm:p-3.5 space-y-3 min-w-0 max-w-full overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5 min-w-0">
                          <ImageIcon size={14} className="shrink-0" /> <span className="truncate">Video Thumbnail Cover</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isCustomThumbnail
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : isAutoThumbnail
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isCustomThumbnail ? (
                            <>
                              <CheckCircle2 size={10} className="shrink-0" /> Custom Thumbnail
                            </>
                          ) : isAutoThumbnail ? (
                            <>
                              <Sparkles size={10} className="shrink-0" /> Auto-detected (YouTube)
                            </>
                          ) : (
                            <>
                              <Video size={10} className="shrink-0" /> Existing Video Type
                            </>
                          )}
                        </span>
                      </div>

                      <div className="grid gap-3.5 sm:grid-cols-5 items-start min-w-0 max-w-full">
                        {/* Inputs (3 cols) */}
                        <div className="sm:col-span-3 space-y-3 min-w-0 max-w-full overflow-hidden">
                          <div className="relative min-w-0">
                            <FormField
                              label="Custom Thumbnail URL (Optional)"
                              value={lessonEditor.thumbnailUrl ?? ''}
                              onChange={(val) => setEditor({ ...lessonEditor, thumbnailUrl: val })}
                              placeholder="https://.../thumbnail.jpg"
                            />
                            {lessonEditor.thumbnailUrl && (
                              <button
                                type="button"
                                onClick={() => setEditor({ ...lessonEditor, thumbnailUrl: '' })}
                                className="absolute right-2.5 top-8 text-xs font-semibold text-slate-400 hover:text-red-500 cursor-pointer"
                                title="Clear custom thumbnail URL"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Or Upload Thumbnail Image (.png, .jpg, .jpeg, .webp)
                            </span>
                            <input
                              type="file"
                              aria-label="Upload Thumbnail Image"
                              accept="image/png,image/jpeg,image/webp,image/jpg"
                              onChange={(e) => setUploadThumbnailFile(e.target.files?.[0] ?? null)}
                              className="block w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 px-3 py-2 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-orange-500/10 file:text-orange-600 dark:file:text-orange-400 hover:file:bg-orange-500/20 cursor-pointer"
                            />
                            {uploadThumbnailFile && (
                              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium min-w-0 max-w-full overflow-hidden">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate block font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                    {uploadThumbnailFile.name}
                                  </span>
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">
                                    ({formatFileSize(uploadThumbnailFile.size)})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setUploadThumbnailFile(null)}
                                  className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 text-xs font-bold shrink-0 px-1 py-0.5 rounded transition cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                            If provided, this thumbnail will be taken as the video poster. Otherwise, it automatically falls back to the existing video provider thumbnail (e.g. YouTube cover) or default player poster.
                          </p>
                        </div>

                        {/* Live Preview Box (2 cols) */}
                        <div className="sm:col-span-2 min-w-0 max-w-full overflow-hidden">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Thumbnail Preview
                          </span>
                          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center shadow-inner min-w-0 max-w-full">
                            {activeThumbnail ? (
                              <>
                                <img
                                  src={activeThumbnail}
                                  alt="Thumbnail preview"
                                  className="size-full max-w-full max-h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 pointer-events-none min-w-0 max-w-full">
                                  <span className="text-[10px] font-bold text-white/90 truncate block w-full text-left">
                                    {isCustomThumbnail
                                      ? 'Taking custom thumbnail'
                                      : 'Existing type (YouTube cover)'}
                                  </span>
                                </div>
                              </>
                            ) : uploadThumbnailFile ? (
                              <div className="p-3 flex flex-col items-center justify-center text-emerald-400 min-w-0 max-w-full overflow-hidden">
                                <ImageIcon size={24} className="mb-1 text-emerald-400 shrink-0" />
                                <span className="text-[10px] font-bold text-white truncate block max-w-full px-2">
                                  {uploadThumbnailFile.name}
                                </span>
                                <span className="text-[9px] text-emerald-300/80 mt-0.5 shrink-0">
                                  Custom File Ready for Upload
                                </span>
                              </div>
                            ) : (
                              <div className="p-3 flex flex-col items-center justify-center text-slate-400 min-w-0 max-w-full">
                                <Video size={24} className="text-slate-500 mb-1 shrink-0" />
                                <span className="text-[10px] font-semibold text-slate-300">
                                  Existing Type
                                </span>
                                <span className="text-[9px] text-slate-500 mt-0.5">
                                  Default video player poster
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                  rows={3}
                />
                <label className="block text-left">
                  <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Deadline / Due Date (Optional)
                  </span>
                  <input
                    type="datetime-local"
                    value={assignEditor.deadline}
                    onChange={(e) => setEditor({ ...assignEditor, deadline: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-950 dark:text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
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

                <div className="grid gap-3.5 sm:grid-cols-2">
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

                  {/* Resource Type */}
                  <div>
                    <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Resource Category</span>
                    <select
                      value={resEditor.resourceType}
                      onChange={(e) => setEditor({ ...resEditor, resourceType: e.target.value as ResourceType })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
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
                </div>

                {resEditor.sourceMode === 'upload' ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3 space-y-1.5">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
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
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Supports Premiere (.prproj), Resolve (.drp), Final Cut (.fcpxml), ZIP, PDF, Docs, Images &amp; Videos.
                    </p>
                    {uploadFile && (
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
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

                {/* Resource Visibility Rules */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3.5 space-y-2.5">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Resource Visibility Rule
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Determine who can access and download this file.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className={`flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 transition ${
                      resEditor.visibility === 'enrolled'
                        ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visibility"
                          value="enrolled"
                          checked={resEditor.visibility === 'enrolled'}
                          onChange={() => setEditor({ ...resEditor, visibility: 'enrolled' })}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <strong className="text-xs font-bold text-slate-900 dark:text-white">
                          Enrolled
                        </strong>
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Active cohort students only.
                      </span>
                    </label>

                    <label className={`flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 transition ${
                      resEditor.visibility === 'public'
                        ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={resEditor.visibility === 'public'}
                          onChange={() => setEditor({ ...resEditor, visibility: 'public' })}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <strong className="text-xs font-bold text-slate-900 dark:text-white">
                          Public Preview
                        </strong>
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Anyone exploring the course.
                      </span>
                    </label>

                    <label className={`flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 transition ${
                      resEditor.visibility === 'after_completion'
                        ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visibility"
                          value="after_completion"
                          checked={resEditor.visibility === 'after_completion'}
                          onChange={() => setEditor({ ...resEditor, visibility: 'after_completion' })}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <strong className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                          <Lock size={11} className="text-amber-600 dark:text-amber-400" /> Lesson Complete
                        </strong>
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Unlocked after completion.
                      </span>
                    </label>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Fixed Modal Actions Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-orange-500" />
            <span>
              {editor.id ? `Editing ${editor.type}` : `Creating new ${editor.type}`}
            </span>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditor(null);
                setUploadFile(null);
                setUploadThumbnailFile(null);
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
