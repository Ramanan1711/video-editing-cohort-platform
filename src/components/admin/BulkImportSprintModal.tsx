import React, { useState } from 'react';
import {
  X,
  FileCode,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Layers,
  Download,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { bulkImportDailyChallenges } from '../../lib/internshipService';

interface BulkImportSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  cohortTitle: string;
  onSuccess: (importedCount: number) => void;
}

type ImportSourceTab = 'upload' | 'json';

interface ParsedChallengeRow {
  day_number: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  starter_files_url?: string | null;
  track_type?: 'general' | 'coding' | 'non_coding';
  submission_type?: 'drive_link' | 'loom_video' | 'github_pr' | 'text' | 'file';
  deadline_hours?: number;
  is_published?: boolean;
}

const SAMPLE_TEMPLATE: ParsedChallengeRow[] = [
  {
    day_number: 1,
    title: 'Day 01: Orientation & Workspace Setup',
    description: 'Set up software preferences, ingest source assets, and complete orientation.',
    instructions: 'Submit a link or file verifying your setup.',
    starter_files_url: 'https://example.com/starter-assets',
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
    is_published: true,
  },
  {
    day_number: 2,
    title: 'Day 02: Core Fundamentals Practice',
    description: 'Apply basic techniques covered in the introductory modules.',
    instructions: 'Submit your completed draft cut or code pull request.',
    starter_files_url: null,
    track_type: 'general',
    submission_type: 'drive_link',
    deadline_hours: 24,
    is_published: false,
  },
];

export const BulkImportSprintModal: React.FC<BulkImportSprintModalProps> = ({
  isOpen,
  onClose,
  cohortId,
  cohortTitle,
  onSuccess,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ImportSourceTab>('upload');
  const [jsonText, setJsonText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedChallengeRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(SAMPLE_TEMPLATE, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'sprint_challenges_template.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            throw new Error('JSON file must contain an array of daily challenges.');
          }
          const rows: ParsedChallengeRow[] = parsed.map((item, index) => ({
            day_number: Number(item.day_number || item.day || index + 1),
            title: String(item.title || `Day ${index + 1}`),
            description: item.description || null,
            instructions: item.instructions || null,
            starter_files_url: item.starter_files_url || item.starter_files || null,
            track_type: item.track_type || 'general',
            submission_type: item.submission_type || 'drive_link',
            deadline_hours: Number(item.deadline_hours) || 24,
            is_published: item.is_published ?? (index === 0),
          }));
          setPreviewRows(rows);
          setJsonText(JSON.stringify(rows, null, 2));
          toast.success(`Parsed ${rows.length} challenges from ${file.name}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON file';
          setParseError(msg);
          toast.error(msg, 'Parse Error');
        }
      } else if (file.name.endsWith('.csv')) {
        try {
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) throw new Error('CSV must contain header row and at least 1 record.');

          const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
          const dayIdx = header.findIndex((h) => h.includes('day'));
          const titleIdx = header.findIndex((h) => h.includes('title'));
          const descIdx = header.findIndex((h) => h.includes('desc'));
          const instIdx = header.findIndex((h) => h.includes('instruct'));
          const subTypeIdx = header.findIndex((h) => h.includes('submission') || h.includes('type'));
          const deadlineIdx = header.findIndex((h) => h.includes('deadline') || h.includes('hour'));
          const starterIdx = header.findIndex((h) => h.includes('starter') || h.includes('url') || h.includes('file'));

          const rows: ParsedChallengeRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
            const dayNum = dayIdx >= 0 ? Number(cols[dayIdx]) || i : i;
            const title = titleIdx >= 0 && cols[titleIdx] ? cols[titleIdx] : `Day ${dayNum} Challenge`;
            rows.push({
              day_number: dayNum,
              title,
              description: descIdx >= 0 ? cols[descIdx] : null,
              instructions: instIdx >= 0 ? cols[instIdx] : null,
              submission_type: (subTypeIdx >= 0 ? (cols[subTypeIdx] as ParsedChallengeRow['submission_type']) : 'drive_link') || 'drive_link',
              deadline_hours: deadlineIdx >= 0 ? Number(cols[deadlineIdx]) || 24 : 24,
              starter_files_url: starterIdx >= 0 ? cols[starterIdx] : null,
              is_published: dayNum === 1,
            });
          }
          setPreviewRows(rows);
          setJsonText(JSON.stringify(rows, null, 2));
          toast.success(`Parsed ${rows.length} challenges from CSV.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Invalid CSV file';
          setParseError(msg);
          toast.error(msg, 'Parse Error');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleJsonBlur = () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array.');
      const rows: ParsedChallengeRow[] = parsed.map((item, index) => ({
        day_number: Number(item.day_number || item.day || index + 1),
        title: String(item.title || `Day ${index + 1}`),
        description: item.description || null,
        instructions: item.instructions || null,
        starter_files_url: item.starter_files_url || item.starter_files || null,
        track_type: item.track_type || 'general',
        submission_type: item.submission_type || 'drive_link',
        deadline_hours: Number(item.deadline_hours) || 24,
        is_published: item.is_published ?? (index === 0),
      }));
      setPreviewRows(rows);
      setParseError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON formatting.';
      setParseError(msg);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewRows.length) {
      toast.error('No challenge rows available to import.');
      return;
    }
    setImporting(true);
    try {
      const imported = await bulkImportDailyChallenges(cohortId, previewRows);
      toast.success(`Successfully imported ${imported.length} daily challenges directly into database.`);
      onSuccess(imported.length);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import curriculum challenges.';
      toast.error(msg, 'Import Error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-200/50">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Sprint Tasks</h3>
              <p className="text-xs text-slate-500">
                Author &amp; upload curriculum tasks for <span className="font-semibold text-slate-700">{cohortTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Controls & Template Download */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
                activeTab === 'upload'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload size={14} />
              Upload JSON / CSV File
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
                activeTab === 'json'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode size={14} />
              Paste JSON
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition pb-2"
          >
            <Download size={13} />
            Download Sample JSON
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition">
                <input
                  type="file"
                  id="sprint-file-upload"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label htmlFor="sprint-file-upload" className="cursor-pointer block">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 shadow-2xs">
                    <Upload size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Click to select or drag and drop your task curriculum file
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Accepts structured <span className="font-semibold text-slate-700">.json</span> or{' '}
                    <span className="font-semibold text-slate-700">.csv</span> with headers: Day, Title, Description, Instructions, Starter Files URL
                  </p>
                </label>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileCode size={14} className="text-indigo-500" /> JSON Array of objects
                </span>
                <span className="flex items-center gap-1">
                  <FileSpreadsheet size={14} className="text-emerald-500" /> CSV Spreadsheet format
                </span>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Paste JSON Array of Daily Challenges:
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setParseError(null);
                }}
                onBlur={handleJsonBlur}
                placeholder={`[\n  {\n    "day_number": 1,\n    "title": "Orientation & Setup",\n    "description": "Workspace setup",\n    "submission_type": "drive_link"\n  }\n]`}
                rows={10}
                className="w-full rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-emerald-400 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Validation & Preview Queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className={previewRows.length > 0 ? 'text-emerald-600' : 'text-slate-400'} />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Ready to Commit ({previewRows.length} Tasks)
                </h4>
              </div>
              {previewRows.length > 0 && (
                <span className="text-xs text-slate-400">
                  Total days: {Math.max(...previewRows.map((r) => r.day_number))}
                </span>
              )}
            </div>

            {previewRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                Upload a file or paste JSON above to preview the challenges before saving.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xs divide-y divide-slate-100">
                {previewRows.map((row) => (
                  <div key={row.day_number} className="flex items-center justify-between p-3 text-xs hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 items-center justify-center rounded-md bg-indigo-50 font-black text-indigo-700 text-[10px]">
                        D{row.day_number}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{row.title}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{row.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {row.submission_type?.replace('_', ' ')}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          row.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <p className="text-xs text-slate-500">
            Commits directly to Supabase <code className="font-mono text-slate-700 font-semibold">public.daily_challenges</code>
          </p>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!previewRows.length || importing}
              loading={importing}
              onClick={handleExecuteImport}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {importing ? 'Importing Tasks...' : `Import ${previewRows.length} Challenges`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
