import type { ReactNode } from 'react';
import { Lock, ExternalLink, Video, FileText, ImageIcon, FileArchive } from 'lucide-react';
import { formatFileSize, type LessonResource } from '../../../lib/courseService';

function getStudentResourceIcon(type?: string): ReactNode {
  switch (type) {
    case 'video':
      return <Video size={16} className="text-emerald-500" />;
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'document':
      return <FileText size={16} className="text-blue-500" />;
    case 'image':
      return <ImageIcon size={16} className="text-purple-500" />;
    case 'project_file':
      return <FileArchive size={16} className="text-orange-500" />;
    default:
      return <FileText size={16} className="text-slate-500" />;
  }
}

export interface ResourceListProps {
  resources: LessonResource[];
  completed: boolean;
  onToggleComplete: () => void;
  downloadingResourceId: string | null;
  onDownloadResource: (resource: LessonResource) => Promise<void> | void;
}

export function ResourceList({
  resources,
  completed,
  onToggleComplete,
  downloadingResourceId,
  onDownloadResource,
}: ResourceListProps) {
  if (!resources.length) {
    return <p className="text-slate-400">No downloadable resources attached to this lesson.</p>;
  }

  return (
    <div className="space-y-3">
      {resources.map((resource) => {
        const isLocked = resource.visibility === 'after_completion' && !completed;

        if (isLocked) {
          return (
            <div
              key={resource.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 transition"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Lock size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xs sm:text-sm font-bold text-slate-900">{resource.name}</strong>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Locked Resource
                    </span>
                    {resource.file_size && (
                      <span className="text-[10px] text-slate-400">
                        ({formatFileSize(resource.file_size)})
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    Mark this lesson as complete to unlock this download (e.g. project files, source media, or LUTs).
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleComplete}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 shadow-2xs hover:bg-amber-100"
              >
                Mark complete to unlock
              </button>
            </div>
          );
        }

        return (
          <div
            key={resource.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-orange-300"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                {getStudentResourceIcon(resource.resource_type)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-xs sm:text-sm font-bold text-slate-900">{resource.name}</strong>
                  {resource.visibility === 'after_completion' && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ Unlocked
                    </span>
                  )}
                  {resource.visibility === 'public' && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Public Preview
                    </span>
                  )}
                  {resource.file_size && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {formatFileSize(resource.file_size)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] capitalize text-slate-400">
                  {resource.resource_type ? resource.resource_type.replace('_', ' ') : 'Downloadable Asset'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={downloadingResourceId === resource.id}
              onClick={() => void onDownloadResource(resource)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-orange-600 disabled:opacity-60 cursor-pointer"
            >
              {downloadingResourceId === resource.id ? (
                <>
                  <span className="inline-block animate-spin text-[10px]">⏳</span>
                  <span>Resolving link...</span>
                </>
              ) : (
                <>
                  <span>Download / Open</span>
                  <ExternalLink size={13} />
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
