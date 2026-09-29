import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  CheckCircle2,
  Flame,
  LoaderCircle,
  Printer,
  RefreshCw,
  Send,
  Star,
  Video,
  X,
  BookOpen,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import {
  generateInternshipReport,
  getStudentInternshipReport,
  publishInternshipReport,
  updateInternshipReport,
  type InternshipReport,
} from '../../lib/internshipReportService';

interface InternshipReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  cohortName: string;
  studentId: string;
  studentName: string;
  canEdit?: boolean;
  onReportUpdated?: (report: InternshipReport) => void;
}

export function InternshipReportModal({
  isOpen,
  onClose,
  cohortId,
  cohortName,
  studentId,
  studentName,
  canEdit = true,
  onReportUpdated,
}: InternshipReportModalProps) {
  const toast = useToast();
  const [report, setReport] = useState<InternshipReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form states
  const [technicalRating, setTechnicalRating] = useState(3);
  const [consistencyRating, setConsistencyRating] = useState(3);
  const [creativeRating, setCreativeRating] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [growthAreas, setGrowthAreas] = useState('');
  const [recommendation, setRecommendation] = useState<InternshipReport['recommendation']>('recommend');

  const loadReport = async () => {
    try {
      setLoading(true);
      const existing = await getStudentInternshipReport(cohortId, studentId);
      if (existing) {
        setReport(existing);
        setTechnicalRating(existing.technical_rating);
        setConsistencyRating(existing.consistency_rating);
        setCreativeRating(existing.creative_rating);
        setStrengths(existing.strengths || '');
        setGrowthAreas(existing.growth_areas || '');
        setRecommendation(existing.recommendation);
      } else {
        setReport(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch internship report';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cohortId && studentId) {
      loadReport();
      setIsEditing(false);
    }
  }, [isOpen, cohortId, studentId]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const newReport = await generateInternshipReport(cohortId, studentId);
      setReport(newReport);
      setTechnicalRating(newReport.technical_rating);
      setConsistencyRating(newReport.consistency_rating);
      setCreativeRating(newReport.creative_rating);
      setStrengths(newReport.strengths || '');
      setGrowthAreas(newReport.growth_areas || '');
      setRecommendation(newReport.recommendation);
      toast.success('Internship evaluation report generated from live telemetry!');
      onReportUpdated?.(newReport);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!report) return;
    try {
      setSaving(true);
      const updated = await updateInternshipReport(report.id, {
        technical_rating: technicalRating,
        consistency_rating: consistencyRating,
        creative_rating: creativeRating,
        strengths,
        growth_areas: growthAreas,
        recommendation,
      });
      setReport(updated);
      setIsEditing(false);
      toast.success('Report evaluation ratings updated.');
      onReportUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update report';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!report) return;
    try {
      setPublishing(true);
      const published = await publishInternshipReport(report.id);
      setReport(published);
      toast.success('Internship report published to student portal!');
      onReportUpdated?.(published);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish report';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 sm:p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-5 sm:px-8 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Formal Internship Report Dossier</h2>
              <p className="text-xs text-slate-400">
                {studentName} · {cohortName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                className="bg-white/10 text-white hover:bg-white/20 border-white/10 text-xs"
              >
                <Printer size={14} />
                <span>Print / PDF</span>
              </Button>
            )}

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <LoaderCircle size={28} className="mx-auto mb-3 animate-spin text-orange-500" />
              <p className="text-sm">Loading internship performance dossier...</p>
            </div>
          ) : !report ? (
            /* Empty State: No Report Yet Generated */
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-10 text-center max-w-md mx-auto my-6">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
                <Flame size={28} />
              </div>
              <h3 className="text-lg font-bold text-white">No Evaluation Report On File</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Generate an authoritative 15-day evaluation report synthesizing daily sprint drills, capstone milestones,
                curriculum watch verification, and live workshop attendance.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-5 py-2.5"
                >
                  {generating ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      <span>Synthesizing Telemetry...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Generate Formal Report</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Active Report Card */
            <div className="space-y-6" id="internship-report-print">
              {/* Report Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        report.status === 'published'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {report.status === 'published' ? <CheckCircle2 size={11} /> : null}
                      {report.status.toUpperCase()}
                    </span>
                    {report.lor_eligible && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                        <Award size={11} />
                        LOR Certified
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-black text-white">{report.title}</h3>
                  <p className="text-xs text-slate-400">
                    Evaluated: {new Date(report.generated_at).toLocaleDateString()}
                    {report.published_at && ` · Published: ${new Date(report.published_at).toLocaleDateString()}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Grade</span>
                    <span className="text-2xl font-black text-orange-400">{report.grade}</span>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
                    <span className="text-2xl font-black text-emerald-400">{report.composite_score}%</span>
                  </div>
                </div>
              </div>

              {/* 4-Pillar Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Flame size={14} className="text-orange-400" />
                    <span>Sprint Drills</span>
                  </div>
                  <p className="mt-1 text-base font-black text-white">
                    {report.completed_drills_count} / {report.total_drills_count}
                  </p>
                  <p className="text-[10px] text-slate-500">Days Accepted</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <BookOpen size={14} className="text-blue-400" />
                    <span>Curriculum</span>
                  </div>
                  <p className="mt-1 text-base font-black text-white">
                    {report.telemetry_snapshot?.completed_lessons ?? 0} /{' '}
                    {report.telemetry_snapshot?.total_lessons ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Lessons Completed</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <FileCheck2 size={14} className="text-emerald-400" />
                    <span>Capstones</span>
                  </div>
                  <p className="mt-1 text-base font-black text-white">
                    {report.telemetry_snapshot?.approved_assignments ?? 0} /{' '}
                    {report.telemetry_snapshot?.total_assignments ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Projects Approved</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Video size={14} className="text-purple-400" />
                    <span>Attendance</span>
                  </div>
                  <p className="mt-1 text-base font-black text-white">{report.attendance_rate_pct}%</p>
                  <p className="text-[10px] text-slate-500">
                    {report.telemetry_snapshot?.attended_sessions ?? 0} of{' '}
                    {report.telemetry_snapshot?.total_sessions ?? 0} Sessions
                  </p>
                </div>
              </div>

              {/* Competency Ratings Section */}
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Competency Performance Dimensions
                  </h4>
                  {canEdit && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-orange-400 hover:text-orange-300 transition font-bold"
                    >
                      Edit Ratings
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Technical */}
                  <div className="rounded-lg bg-slate-900 p-3 border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Technical Assembly</span>
                      <span className="font-mono text-orange-400 font-bold">{technicalRating}/5</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          onClick={() => isEditing && setTechnicalRating(star)}
                          className={`${
                            star <= technicalRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-600'
                          } ${isEditing ? 'cursor-pointer hover:scale-110 transition' : ''}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400">Pacing, cutting precision, transitions</p>
                  </div>

                  {/* Consistency */}
                  <div className="rounded-lg bg-slate-900 p-3 border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Turnaround Velocity</span>
                      <span className="font-mono text-orange-400 font-bold">{consistencyRating}/5</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          onClick={() => isEditing && setConsistencyRating(star)}
                          className={`${
                            star <= consistencyRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-600'
                          } ${isEditing ? 'cursor-pointer hover:scale-110 transition' : ''}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400">Deadline discipline, daily sprint cadence</p>
                  </div>

                  {/* Creative */}
                  <div className="rounded-lg bg-slate-900 p-3 border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Creative Execution</span>
                      <span className="font-mono text-orange-400 font-bold">{creativeRating}/5</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          onClick={() => isEditing && setCreativeRating(star)}
                          className={`${
                            star <= creativeRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-600'
                          } ${isEditing ? 'cursor-pointer hover:scale-110 transition' : ''}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400">Audio design, typography, narrative hook</p>
                  </div>
                </div>
              </div>

              {/* Qualitative Mentor Evaluation */}
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Mentor Qualitative Assessment
                </h4>

                {isEditing ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Key Strengths &amp; Highlights</label>
                      <textarea
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 p-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Recommended Growth Areas</label>
                      <textarea
                        value={growthAreas}
                        onChange={(e) => setGrowthAreas(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 p-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Formal Recommendation</label>
                      <select
                        value={recommendation}
                        onChange={(e) =>
                          setRecommendation(e.target.value as InternshipReport['recommendation'])
                        }
                        className="w-full rounded-xl border border-white/15 bg-slate-900 p-2 text-white focus:border-orange-500 focus:outline-none"
                      >
                        <option value="strongly_recommend">Strongly Recommend (High Honors &amp; LOR)</option>
                        <option value="recommend">Recommend (Meets Standard)</option>
                        <option value="conditional">Conditional (Needs Portfolio Polish)</option>
                        <option value="do_not_recommend">Do Not Recommend</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveEdits}
                        disabled={saving}
                        className="bg-orange-500 text-white"
                      >
                        {saving ? 'Saving...' : 'Save Evaluation'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Key Strengths</p>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        {report.strengths || 'Consistent engagement throughout cohort drills.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Growth Recommendations
                      </p>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        {report.growth_areas || 'Continue building advanced portfolio pieces.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommendation</p>
                      <p className="mt-1 font-bold capitalize text-orange-400">
                        {report.recommendation.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 15-Day Sprint Drill Breakdown */}
              {report.telemetry_snapshot?.drills_list?.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Daily Challenge Execution History
                  </h4>
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5 text-xs">
                    {report.telemetry_snapshot.drills_list.map((drill) => (
                      <div key={drill.day_number} className="py-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 font-bold text-[11px]">
                            D{drill.day_number.toString().padStart(2, '0')}
                          </span>
                          <span className="font-semibold text-slate-300 truncate max-w-xs">{drill.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {drill.score !== null && (
                            <span className="font-mono font-bold text-orange-400">{drill.score}/100</span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              drill.status === 'accepted'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : drill.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {drill.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {report && (
          <div className="flex flex-wrap items-center justify-between border-t border-white/10 p-4 sm:px-8 bg-slate-950/40 print:hidden gap-3">
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-white/10 text-white hover:bg-white/20 border-white/10 text-xs"
                >
                  <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                  <span>Sync Telemetry</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canEdit && report.status === 'draft' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  {publishing ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Publish Report Card</span>
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
export default InternshipReportModal;
