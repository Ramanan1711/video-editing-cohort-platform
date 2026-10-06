import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Layers,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import type {
  AdminEnrollment,
  BulkEnrollmentResponse,
  EnrollmentStatus,
  MentorCohortAssignment,
  UserProfile,
} from '../../../lib/adminService';
import type { Cohort } from '../../../lib/courseService';

export interface RemovalWarningData {
  userId: string;
  cohortId: string;
  studentName: string;
  cohortName: string;
}

export interface EnrollmentsTabProps {
  cohorts: Cohort[];
  enrollments: AdminEnrollment[];
  mentorAssignments: MentorCohortAssignment[];
  users: UserProfile[];
  canManageEnrollments: boolean;
  selectedCohortId: string;
  onSelectCohortId: (id: string) => void;
  showEnrollModal: boolean;
  setShowEnrollModal: (show: boolean) => void;
  onEnrollStudent: (userId: string, cohortId: string) => Promise<void>;
  onUpdateEnrollmentStatus: (
    userId: string,
    cohortId: string,
    status: EnrollmentStatus
  ) => Promise<void>;
  onConfirmRemoval: (data: RemovalWarningData) => Promise<void>;
  onBulkEnroll: (
    cohortId: string,
    students: Array<{ email: string; name?: string }>
  ) => Promise<BulkEnrollmentResponse>;
  onAssignMentor: (mentorId: string, cohortId: string) => Promise<void>;
  onRemoveMentor: (
    mentorId: string,
    cohortId: string,
    mentorName: string,
    cohortName: string
  ) => Promise<void>;
  onExportCSV: () => Promise<void>;
  onExportSubmissions: () => Promise<void>;
  onDownloadBulkTemplate: () => void;
  exportingCsv: boolean;
  exportingSubmissionsCsv: boolean;
}

export function EnrollmentsTab({
  cohorts,
  enrollments,
  mentorAssignments,
  users,
  canManageEnrollments,
  selectedCohortId,
  onSelectCohortId,
  showEnrollModal,
  setShowEnrollModal,
  onEnrollStudent,
  onUpdateEnrollmentStatus,
  onConfirmRemoval,
  onBulkEnroll,
  onAssignMentor,
  onRemoveMentor,
  onExportCSV,
  onExportSubmissions,
  onDownloadBulkTemplate,
  exportingCsv,
  exportingSubmissionsCsv,
}: EnrollmentsTabProps) {
  const [enrollmentView, setEnrollmentView] = useState<'students' | 'mentors'>('students');
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentPageSize, setEnrollmentPageSize] = useState(25);

  // Modal states
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollTargetCohortId, setEnrollTargetCohortId] = useState('');
  const [enrollingUser, setEnrollingUser] = useState(false);

  const [removalWarningUser, setRemovalWarningUser] = useState<RemovalWarningData | null>(null);
  const [removingEnrollment, setRemovingEnrollment] = useState(false);

  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState('');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkEnrollmentResponse | null>(null);

  const [showAssignMentorModal, setShowAssignMentorModal] = useState(false);
  const [assignMentorId, setAssignMentorId] = useState('');
  const [assignCohortId, setAssignCohortId] = useState('');
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [removingMentorId, setRemovingMentorId] = useState<string | null>(null);

  // Filtered lists
  const filteredEnrollments = useMemo(() => {
    if (selectedCohortId === 'all') return enrollments;
    return enrollments.filter((e) => e.cohort_id === selectedCohortId);
  }, [enrollments, selectedCohortId]);

  const filteredMentorAssignments = useMemo(() => {
    if (selectedCohortId === 'all') return mentorAssignments;
    return mentorAssignments.filter((m) => m.cohort_id === selectedCohortId);
  }, [mentorAssignments, selectedCohortId]);

  const totalEnrollmentPages = Math.ceil(filteredEnrollments.length / enrollmentPageSize) || 1;
  const safeEnrollmentPage = Math.min(enrollmentPage, totalEnrollmentPages);

  const pagedEnrollments = useMemo(() => {
    const start = (safeEnrollmentPage - 1) * enrollmentPageSize;
    return filteredEnrollments.slice(start, start + enrollmentPageSize);
  }, [filteredEnrollments, safeEnrollmentPage, enrollmentPageSize]);

  // Handle single enrollment submit
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollStudentId || !enrollTargetCohortId) return;
    setEnrollingUser(true);
    try {
      await onEnrollStudent(enrollStudentId, enrollTargetCohortId);
      setShowEnrollModal(false);
      setEnrollStudentId('');
      setEnrollTargetCohortId('');
    } finally {
      setEnrollingUser(false);
    }
  };

  // Handle removal confirmation
  const handleRemovalSubmit = async () => {
    if (!removalWarningUser) return;
    setRemovingEnrollment(true);
    try {
      await onConfirmRemoval(removalWarningUser);
      setRemovalWarningUser(null);
    } finally {
      setRemovingEnrollment(false);
    }
  };

  // Handle bulk enroll submit
  const handleBulkEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCohortId || !bulkCsvText.trim()) return;
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const lines = bulkCsvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const studentsToEnroll: Array<{ email: string; name?: string }> = [];

      for (const line of lines) {
        const [rawEmail, rawName] = line.split(',').map((part) => part.trim());
        if (rawEmail && rawEmail.includes('@')) {
          studentsToEnroll.push({
            email: rawEmail,
            name: rawName || undefined,
          });
        }
      }

      if (!studentsToEnroll.length) {
        throw new Error('No valid email addresses found in the provided CSV text.');
      }

      const res = await onBulkEnroll(bulkCohortId, studentsToEnroll);
      setBulkResult(res);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setBulkCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  // Handle assign mentor submit
  const handleAssignMentorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignMentorId || !assignCohortId) return;
    setAssigningMentor(true);
    try {
      await onAssignMentor(assignMentorId, assignCohortId);
      setShowAssignMentorModal(false);
      setAssignMentorId('');
      setAssignCohortId('');
    } finally {
      setAssigningMentor(false);
    }
  };

  const handleRemoveMentorClick = async (
    mentorId: string,
    cohortId: string,
    mentorName: string,
    cohortName: string
  ) => {
    setRemovingMentorId(`${mentorId}-${cohortId}`);
    try {
      await onRemoveMentor(mentorId, cohortId, mentorName, cohortName);
    } finally {
      setRemovingMentorId(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-slate-950">Cohort Enrollments</h2>
          <p className="mt-1 text-xs text-slate-500">
            Inspect student cohort rosters, assign enrollments manually, or adjust completion status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
            <Layers size={13} className="text-slate-400" />
            <select
              value={selectedCohortId}
              onChange={(e) => {
                onSelectCohortId(e.target.value);
                setEnrollmentPage(1);
              }}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Cohorts ({enrollments.length})</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="secondary"
            loading={exportingCsv}
            onClick={() => void onExportCSV()}
            className="text-xs font-bold"
            title="Export cohort enrollments as CSV"
          >
            <Download size={14} /> Export CSV
          </Button>

          <Button
            size="sm"
            variant="secondary"
            loading={exportingSubmissionsCsv}
            onClick={() => void onExportSubmissions()}
            className="text-xs font-bold"
            title="Export student submissions as CSV"
          >
            <Download size={14} /> Export Submissions
          </Button>

          {canManageEnrollments && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setBulkCohortId(selectedCohortId !== 'all' ? selectedCohortId : (cohorts[0]?.id || ''));
                  setShowBulkEnrollModal(true);
                  setBulkResult(null);
                  setBulkCsvText('');
                }}
                className="text-xs font-bold"
              >
                <UploadCloud size={14} /> Bulk CSV Import
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAssignMentorModal(true)}
                className="text-xs font-bold"
              >
                <Sparkles size={14} /> Assign Mentor
              </Button>

              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowEnrollModal(true)}
                className="text-xs font-bold"
              >
                <UserPlus size={14} /> Enroll Student
              </Button>
            </>
          )}
        </div>
      </div>

      {/* View Selector: Student Rosters vs Mentor Cohort Scoping */}
      <div className="mt-5 flex gap-2 border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={() => setEnrollmentView('students')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            enrollmentView === 'students'
              ? 'bg-orange-500 text-white shadow-2xs font-black'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Student Rosters ({filteredEnrollments.length})
        </button>
        <button
          type="button"
          onClick={() => setEnrollmentView('mentors')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            enrollmentView === 'mentors'
              ? 'bg-orange-500 text-white shadow-2xs font-black'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={13} />
          Mentor Scoping &amp; Staffing ({filteredMentorAssignments.length})
        </button>
      </div>

      {/* View 1: Student Enrollments */}
      {enrollmentView === 'students' && (
        <div className="mt-6 divide-y divide-slate-100">
          {pagedEnrollments.length ? (
            pagedEnrollments.map((item) => (
              <div
                key={`${item.user_id}-${item.cohort_id}`}
                className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-slate-950">{item.student_name}</strong>
                    <span className="text-xs text-slate-400">({item.student_email})</span>
                    <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                      {item.cohort_name && item.cohort_name !== 'Cohort'
                        ? item.cohort_name
                        : (cohorts.find((c) => c.id === item.cohort_id)?.name || item.cohort_name || 'Cohort')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Enrolled {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={item.status}
                    disabled={!canManageEnrollments}
                    onChange={(e) =>
                      void onUpdateEnrollmentStatus(
                        item.user_id,
                        item.cohort_id,
                        e.target.value as EnrollmentStatus
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold outline-none ${
                      !canManageEnrollments ? 'cursor-not-allowed opacity-75 ' : ''
                    }${
                      item.status === 'active' || item.status === 'enrolled'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : item.status === 'completed'
                        ? 'border-purple-200 bg-purple-50 text-purple-800'
                        : item.status === 'waitlisted' || item.status === 'waitlist'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : item.status === 'inactive'
                        ? 'border-slate-300 bg-slate-100 text-slate-500'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="completed">Completed</option>
                    <option value="dropped">Dropped</option>
                    <option value="waitlisted">Waitlisted</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  {canManageEnrollments && (
                    <button
                      onClick={() =>
                        setRemovalWarningUser({
                          userId: item.user_id,
                          cohortId: item.cohort_id,
                          studentName: item.student_name,
                          cohortName: item.cohort_name,
                        })
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Remove from cohort"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">No student enrollments found for this filter.</p>
          )}

          {filteredEnrollments.length > enrollmentPageSize && (
            <div className="pt-2">
              <Pagination
                currentPage={safeEnrollmentPage}
                totalPages={totalEnrollmentPages}
                totalItems={filteredEnrollments.length}
                pageSize={enrollmentPageSize}
                onPageChange={setEnrollmentPage}
                onPageSizeChange={setEnrollmentPageSize}
              />
            </div>
          )}
        </div>
      )}

      {/* View 2: Mentor Cohort Scoping */}
      {enrollmentView === 'mentors' && (
        <div className="mt-6">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-black text-slate-950">Mentor Cohort Scoping &amp; Staffing</h3>
              <p className="text-xs text-slate-500">
                Assigned mentors are strictly isolated to review submissions and student rosters within their designated cohorts.
              </p>
            </div>
            {canManageEnrollments && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowAssignMentorModal(true)}
                className="text-xs font-bold shrink-0"
              >
                <Sparkles size={14} /> Assign Mentor to Cohort
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Mentor</th>
                  <th className="py-2.5 px-3">Assigned Cohort</th>
                  <th className="py-2.5 px-3">Access Scope</th>
                  <th className="py-2.5 px-3">Assigned Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredMentorAssignments.length ? (
                  filteredMentorAssignments.map((assignment) => (
                    <tr key={`${assignment.mentor_id}-${assignment.cohort_id}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-lg bg-orange-100 font-bold text-orange-700 text-xs">
                            {assignment.mentor?.full_name?.[0] || 'M'}
                          </div>
                          <div>
                            <strong className="text-slate-900 block font-bold">
                              {assignment.mentor?.full_name || 'Mentor'}
                            </strong>
                            <span className="text-[11px] text-slate-400">{assignment.mentor?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200/60">
                          {assignment.cohort?.name || 'Cohort'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          <ShieldCheck size={11} className="text-emerald-600" /> RLS &amp; RPC Scoped
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {assignment.assigned_at
                          ? new Date(assignment.assigned_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Active'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {canManageEnrollments && (
                          <button
                            type="button"
                            disabled={removingMentorId === `${assignment.mentor_id}-${assignment.cohort_id}`}
                            onClick={() =>
                              void handleRemoveMentorClick(
                                assignment.mentor_id,
                                assignment.cohort_id,
                                assignment.mentor?.full_name || 'Mentor',
                                assignment.cohort?.name || 'Cohort'
                              )
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Unassign mentor from cohort"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No mentor cohort assignments found for this filter. Click &ldquo;Assign Mentor&rdquo; above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Enrollment Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleEnrollSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950">Enroll Student into Cohort</h3>
              <button type="button" onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Select Student User
                <select
                  value={enrollStudentId}
                  onChange={(e) => setEnrollStudentId(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                >
                  <option value="">Choose registered user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || 'Unnamed'} ({u.email}) — [{u.role.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Target Cohort
                <select
                  value={enrollTargetCohortId}
                  onChange={(e) => setEnrollTargetCohortId(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                >
                  <option value="">Choose cohort...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowEnrollModal(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={enrollingUser}>
                <UserPlus size={14} /> Enroll Student
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Mentor Modal */}
      {showAssignMentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleAssignMentorSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-orange-500" size={18} />
                <h3 className="text-base font-black text-slate-950">Assign Mentor to Cohort</h3>
              </div>
              <button type="button" onClick={() => setShowAssignMentorModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Select Mentor Account
                <select
                  value={assignMentorId}
                  onChange={(e) => setAssignMentorId(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                >
                  <option value="">Choose mentor or admin...</option>
                  {users
                    .filter((u) => u.role === 'mentor' || u.role === 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || 'Unnamed'} ({u.email}) — [{u.role.toUpperCase()}]
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Target Cohort
                <select
                  value={assignCohortId}
                  onChange={(e) => setAssignCohortId(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
                >
                  <option value="">Choose cohort...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowAssignMentorModal(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={assigningMentor}>
                <Sparkles size={14} /> Assign Mentor
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk CSV Enrollment Modal */}
      {showBulkEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleBulkEnrollSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="text-orange-500" size={18} />
                <h3 className="text-base font-black text-slate-950">Bulk CSV Student Enrollment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkEnrollModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Target Cohort
                <select
                  value={bulkCohortId}
                  onChange={(e) => setBulkCohortId(e.target.value)}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400"
                >
                  <option value="">Choose target cohort...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    CSV Data (email, full_name)
                  </label>
                  <button
                    type="button"
                    onClick={onDownloadBulkTemplate}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    <Download size={12} /> Download CSV Template
                  </button>
                </div>

                <div className="mt-1.5 mb-2.5 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-2.5">
                  <UploadCloud size={16} className="text-slate-400 shrink-0" />
                  <div className="flex-1 text-[11px] text-slate-600">
                    <label className="cursor-pointer font-bold text-orange-600 hover:underline">
                      <span>Upload .csv file</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleBulkFileUpload}
                        className="sr-only"
                      />
                    </label>
                    <span className="text-slate-400 ml-1">or paste rows directly below</span>
                  </div>
                </div>

                <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                  Format: One entry per line. Example: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">alex@example.com, Alex Turner</code>
                </p>
                <textarea
                  rows={5}
                  required
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder={`jane@example.com, Jane Doe\njohn@example.com, John Smith\nsam@example.com`}
                  className="mt-1.5 block w-full resize-none font-mono text-xs rounded-xl border border-slate-200 p-2.5 outline-none focus:border-orange-400"
                />
              </div>

              {bulkResult && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
                  <p className="font-bold text-emerald-800">
                    ✓ Bulk Enrollment Completed: {bulkResult.added} enrolled directly, {bulkResult.invitations || 0} pre-enrollment invitations recorded, {bulkResult.skipped} already enrolled/skipped.
                  </p>
                  {bulkResult.errors.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-4 text-[11px] text-red-600">
                      {bulkResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowBulkEnrollModal(false)}
              >
                Close
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={bulkProcessing}>
                <UploadCloud size={14} /> Process Enrollments
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Student Removal Impact Warning Modal */}
      {removalWarningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">Confirm Student Removal</h3>
                <p className="text-xs text-slate-500">Irreversible roster membership modification</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to remove <strong className="text-slate-950 font-bold">{removalWarningUser.studentName}</strong> from <strong className="text-slate-950 font-bold">{removalWarningUser.cohortName}</strong>?
              </p>
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-3.5 text-[11px] text-red-800 space-y-1.5">
                <strong className="block font-bold">Removal Impact Notice:</strong>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Immediately revokes student access to cohort lessons, assets, and assignment briefs.</li>
                  <li>Prevents student from submitting new cuts or requesting revision reviews.</li>
                  <li>Hides cohort announcements and discussion posts.</li>
                  <li>Historical submission scores and mentor reviews are permanently retained for institutional auditing.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={removingEnrollment}
                onClick={() => setRemovalWarningUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={removingEnrollment}
                onClick={() => void handleRemovalSubmit()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 size={14} /> Remove from Cohort
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

