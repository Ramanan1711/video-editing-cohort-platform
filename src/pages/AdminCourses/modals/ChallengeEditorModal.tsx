import { Upload, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAdminCourses } from '../context/useAdminCourses';
import { FormField, TextareaField } from '../components/SharedSubcomponents';
import type { ChallengeEditorState } from '../types';

export function ChallengeEditorModal() {
  const {
    editor,
    setEditor,
    uploadFile,
    setUploadFile,
    handleSave,
    saving,
    uploadingStatus,
  } = useAdminCourses();

  if (!editor || editor.type !== 'challenge') return null;

  const challengeEditor = editor as ChallengeEditorState;

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
              {challengeEditor.id ? 'Edit' : 'Create'} Daily Challenge
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {challengeEditor.id ? 'Edit Daily Challenge' : 'New Daily Challenge'}
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
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Day Number (1 - 100)"
              type="number"
              min="1"
              value={String(challengeEditor.dayNumber)}
              onChange={(val) => setEditor({ ...challengeEditor, dayNumber: Number(val) || 1 })}
              required
            />
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Track Type</span>
              <select
                value={challengeEditor.trackType}
                onChange={(e) =>
                  setEditor({
                    ...challengeEditor,
                    trackType: e.target.value as 'general' | 'coding' | 'non_coding',
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="general" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">General (All Tracks)</option>
                <option value="coding" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Coding / Technical</option>
                <option value="non_coding" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Non-Coding / Creative</option>
              </select>
            </label>
          </div>

          <FormField
            label="Challenge Title"
            value={challengeEditor.title}
            onChange={(val) => setEditor({ ...challengeEditor, title: val })}
            placeholder="e.g., Day 03: Kinetic Typography & Transitions"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Submission Type</span>
              <select
                value={challengeEditor.submissionType}
                onChange={(e) =>
                  setEditor({
                    ...challengeEditor,
                    submissionType: e.target.value as
                      | 'drive_link'
                      | 'loom_video'
                      | 'github_pr'
                      | 'text'
                      | 'file',
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="drive_link" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Google Drive Link</option>
                <option value="loom_video" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Loom / Screen Recording</option>
                <option value="github_pr" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">GitHub PR / Repo</option>
                <option value="text" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Written Reflection / Text</option>
                <option value="file" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Direct File Upload</option>
              </select>
            </label>

            <FormField
              label="Deadline (Hours)"
              type="number"
              min="1"
              value={String(challengeEditor.deadlineHours)}
              onChange={(val) => setEditor({ ...challengeEditor, deadlineHours: Number(val) || 24 })}
              required
            />
          </div>

          <TextareaField
            label="Description & Brief"
            value={challengeEditor.description}
            onChange={(val) => setEditor({ ...challengeEditor, description: val })}
            placeholder="Provide an engaging summary of the core objective and learning goals for today..."
            rows={3}
          />

          <TextareaField
            label="Submission Instructions"
            value={challengeEditor.instructions}
            onChange={(val) => setEditor({ ...challengeEditor, instructions: val })}
            placeholder="Step-by-step deliverable specifications, required codecs/resolutions, or PR formatting..."
            rows={3}
          />

          {/* Starter Assets / Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Starter Assets or Repo</span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setUploadFile(null);
                    setEditor({ ...challengeEditor, starterSourceMode: 'url' });
                  }}
                  className={`rounded-md px-2.5 py-1 transition ${
                    challengeEditor.starterSourceMode === 'url' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cloud Link / URL
                </button>
                <button
                  type="button"
                  onClick={() => setEditor({ ...challengeEditor, starterSourceMode: 'upload' })}
                  className={`rounded-md px-2.5 py-1 transition ${
                    challengeEditor.starterSourceMode === 'upload' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {challengeEditor.starterSourceMode === 'upload' ? (
              <div>
                <input
                  type="file"
                  id="challenge-starter-file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUploadFile(file);
                  }}
                />
                <label
                  htmlFor="challenge-starter-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 p-4 text-center transition hover:border-orange-500 hover:bg-orange-50/20 dark:hover:border-orange-500 dark:hover:bg-orange-950/20"
                >
                  <Upload className="mb-1 text-slate-400" size={20} />
                  {uploadFile ? (
                    <p className="text-xs font-bold text-orange-600 truncate max-w-full px-2">
                      {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  ) : challengeEditor.starterFilesUrl ? (
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-full px-2">
                      Current: <span className="font-semibold text-slate-900 dark:text-white">{challengeEditor.starterFilesUrl}</span>
                      <br /><span className="text-[11px] text-slate-400 dark:text-slate-500">Click to choose a replacement file</span>
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Choose starter archive or project file</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">.zip, .prproj, .drp, .pdf, or media assets (up to 50MB)</p>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <FormField
                label=""
                value={challengeEditor.starterFilesUrl}
                onChange={(val) => setEditor({ ...challengeEditor, starterFilesUrl: val })}
                placeholder="https://drive.google.com/... or GitHub template repo"
              />
            )}
          </div>

          {/* Publication Status Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Publish Immediately</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When enabled, enrolled cohort participants can see and unlock this sprint drill.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={challengeEditor.isPublished}
                onChange={(e) => setEditor({ ...challengeEditor, isPublished: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-emerald-600 peer-focus:outline-hidden after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditor(null);
              setUploadFile(null);
            }}
            disabled={saving}
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
