import React, { useState } from 'react';
import {
  X,
  FileCode,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Code2,
  Film,
  Box,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { bulkImportDailyChallenges } from '../../lib/internshipService';
import {
  VIDEO_EDITING_15_DAY_CURRICULUM,
  CODING_FULLSTACK_15_DAY_CURRICULUM,
  MOTION_GRAPHICS_15_DAY_CURRICULUM,
  type CurriculumDay,
} from '../../lib/curriculum';

interface BulkImportSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  cohortTitle: string;
  onSuccess: (importedCount: number) => void;
}

type ImportSourceTab = 'presets' | 'upload' | 'json';

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

export const BulkImportSprintModal: React.FC<BulkImportSprintModalProps> = ({
  isOpen,
  onClose,
  cohortId,
  cohortTitle,
  onSuccess,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ImportSourceTab>('presets');
  const [selectedPreset, setSelectedPreset] = useState<'video' | 'coding' | 'motion' | null>('video');
  const [jsonText, setJsonText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedChallengeRow[]>(() =>
    VIDEO_EDITING_15_DAY_CURRICULUM.map((c) => ({
      day_number: c.day_number,
      title: c.title,
      description: c.description,
      instructions: c.instructions,
      starter_files_url: c.starter_files_url,
      track_type: (c.track_type as 'general' | 'coding' | 'non_coding') || 'general',
      submission_type: (c.submission_type as 'drive_link' | 'loom_video' | 'github_pr' | 'text' | 'file') || 'drive_link',
      deadline_hours: c.deadline_hours,
      is_published: c.is_published ?? (c.day_number === 1),
    }))
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: 'video' | 'coding' | 'motion') => {
    setSelectedPreset(preset);
    setParseError(null);
    let blueprint: CurriculumDay[] = VIDEO_EDITING_15_DAY_CURRICULUM;
    if (preset === 'coding') blueprint = CODING_FULLSTACK_15_DAY_CURRICULUM;
    if (preset === 'motion') blueprint = MOTION_GRAPHICS_15_DAY_CURRICULUM;

    const mapped: ParsedChallengeRow[] = blueprint.map((c) => ({
      day_number: c.day_number,
      title: c.title,
      description: c.description,
      instructions: c.instructions,
      starter_files_url: c.starter_files_url,
      track_type: (c.track_type as 'general' | 'coding' | 'non_coding') || 'general',
      submission_type: (c.submission_type as 'drive_link' | 'loom_video' | 'github_pr' | 'text' | 'file') || 'drive_link',
      deadline_hours: c.deadline_hours,
      is_published: c.is_published ?? (c.day_number === 1),
    }));
    setPreviewRows(mapped);
    setJsonText(JSON.stringify(mapped, null, 2));
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
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/50">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Sprint Curriculum</h3>
              <p className="text-xs text-slate-500">
                Populate 15-day syllabus for <span className="font-semibold text-slate-700">{cohortTitle}</span>
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

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 bg-white px-6 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
                activeTab === 'presets'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={14} />
              Starter Templates (Verified Blueprints)
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
                activeTab === 'upload'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload size={14} />
              Upload JSON / CSV
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
                activeTab === 'json'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode size={14} />
              Paste JSON
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-600">
                Choose a verified 15-day industry curriculum blueprint to immediately populate this cohort:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('video')}
                  className={`flex flex-col text-left p-4 rounded-xl border transition ${
                    selectedPreset === 'video'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 mb-2.5">
                    <Film size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Video Editing &amp; Post</h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Kinetic cuts, sound stems, typography, color grading &amp; 4K client master.
                  </p>
                  <span className="mt-3 text-[10px] font-black uppercase tracking-wider text-orange-600">
                    15 Days • Non-Coding
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('coding')}
                  className={`flex flex-col text-left p-4 rounded-xl border transition ${
                    selectedPreset === 'coding'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 mb-2.5">
                    <Code2 size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Full-Stack Coding</h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Git workflows, RLS modeling, REST APIs, WebSockets, RBAC &amp; payment webhooks.
                  </p>
                  <span className="mt-3 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                    15 Days • Technical
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('motion')}
                  className={`flex flex-col text-left p-4 rounded-xl border transition ${
                    selectedPreset === 'motion'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 mb-2.5">
                    <Box size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Motion Graphics &amp; 3D</h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Keyframing, speed curves, 3D camera mapping, title lower-thirds &amp; VFX comp.
                  </p>
                  <span className="mt-3 text-[10px] font-black uppercase tracking-wider text-purple-600">
                    15 Days • Creative
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center hover:bg-slate-50 transition cursor-pointer">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-3 shadow-xs">
                  <FileSpreadsheet size={24} />
                </div>
                <p className="text-sm font-bold text-slate-900">Drag &amp; drop sprint file or click to browse</p>
                <p className="mt-1 text-xs text-slate-500">Supports .json or .csv files with day numbers, titles, and instructions</p>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {parseError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Paste JSON Array</span>
                <button
                  type="button"
                  onClick={handleJsonBlur}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Format &amp; Validate
                </button>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                onBlur={handleJsonBlur}
                rows={9}
                placeholder="[{ day_number: 1, title: 'Day 01: Setup...', ... }]"
                className="w-full rounded-xl border border-slate-200 bg-slate-900 p-3.5 font-mono text-xs text-emerald-400 shadow-inner focus:border-amber-500 focus:outline-none"
              />
              {parseError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* Validation & Preview Section */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Preview Queue ({previewRows.length} Days)
                </h4>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  Ready to batch insert
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Day 1 unlocked immediately; Days 2–15 unlocked daily on schedule
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Day</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Submission Type</th>
                    <th className="py-2.5 px-3">Deadline</th>
                    <th className="py-2.5 px-3">Track</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 bg-white">
                  {previewRows.map((row) => (
                    <tr key={row.day_number} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-mono font-bold text-amber-700">D{row.day_number}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 max-w-xs truncate">{row.title}</td>
                      <td className="py-2 px-3">
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                          {row.submission_type?.replace('_', ' ') || 'drive_link'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{row.deadline_hours || 24}h</td>
                      <td className="py-2 px-3 capitalize text-slate-500">{row.track_type || 'general'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Overwrites or merges by (cohort_id, day_number) idempotently.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={importing}
              onClick={() => void handleExecuteImport()}
              className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
            >
              <ArrowRight size={14} className="mr-1.5" />
              {importing ? 'Importing Days...' : `Import ${previewRows.length} Days to Database`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

