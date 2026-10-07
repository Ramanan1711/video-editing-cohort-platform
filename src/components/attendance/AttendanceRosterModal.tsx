import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Search,
  Download,
  CheckCheck,
  Save,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  getSessionAttendanceRoster,
  bulkMarkAttendance,
  type SessionAttendanceRecord,
  type AttendanceStatus,
} from '../../lib/attendanceService';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';

interface AttendanceRosterModalProps {
  sessionId: string;
  sessionTitle: string;
  sessionStartsAt?: string;
  cohortId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function AttendanceRosterModal({
  sessionId,
  sessionTitle,
  sessionStartsAt,
  cohortId,
  onClose,
  onSaved,
}: AttendanceRosterModalProps) {
  useModalScrollLock(true);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<SessionAttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadRoster() {
      try {
        setLoading(true);
        const data = await getSessionAttendanceRoster(sessionId, cohortId);
        if (isMounted) {
          setRoster(data);
          setHasChanges(false);
        }
      } catch (err) {
        console.error('Error fetching attendance roster:', err);
        toast.error('Failed to load session roster');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadRoster();
    return () => {
      isMounted = false;
    };
  }, [sessionId, cohortId, toast]);

  // Update status for a specific student in state
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((item) =>
        item.student_id === studentId
          ? {
              ...item,
              status: newStatus,
              join_time:
                newStatus === 'present' || newStatus === 'late'
                  ? item.join_time || new Date().toISOString()
                  : null,
            }
          : item
      )
    );
    setHasChanges(true);
  };

  // Update notes for a specific student in state
  const handleNotesChange = (studentId: string, notes: string) => {
    setRoster((prev) =>
      prev.map((item) =>
        item.student_id === studentId ? { ...item, notes } : item
      )
    );
    setHasChanges(true);
  };

  // Mark all currently visible or all roster students as Present
  const handleMarkAllPresent = () => {
    setRoster((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'present',
        join_time: item.join_time || new Date().toISOString(),
      }))
    );
    setHasChanges(true);
    toast.info('Marked all students as Present.');
  };

  // Save changes to database
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      const payload = roster.map((r) => ({
        studentId: r.student_id,
        status: r.status,
        notes: r.notes || undefined,
        durationMinutes: r.duration_minutes || (r.status === 'present' ? 60 : 0),
      }));

      await bulkMarkAttendance(sessionId, payload);
      toast.success('Attendance records saved successfully.');
      setHasChanges(false);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Error saving attendance:', err);
      toast.error('Failed to save attendance records.');
    } finally {
      setSaving(false);
    }
  };

  // Export roster to CSV
  const handleExportCSV = () => {
    const headers = ['Student Name', 'Email', 'Status', 'Join Time', 'Duration (min)', 'Notes'];
    const rows = roster.map((r) => [
      `"${r.student_name || 'Student'}"`,
      `"${r.student_email || ''}"`,
      r.status,
      r.join_time ? new Date(r.join_time).toLocaleString() : 'N/A',
      r.duration_minutes || 0,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance-${sessionId.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs
  const totalCount = roster.length;
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const excusedCount = roster.filter((r) => r.status === 'excused').length;
  const attendanceRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (item.student_name || '').toLowerCase().includes(query);
        const emailMatch = (item.student_email || '').toLowerCase().includes(query);
        return nameMatch || emailMatch;
      }
      return true;
    });
  }, [roster, statusFilter, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
                Live Attendance Roster
              </span>
              {hasChanges && (
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Unsaved changes
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">{sessionTitle}</h2>
            {sessionStartsAt && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <Calendar size={13} className="text-orange-400" />
                {new Date(sessionStartsAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Attendance KPI Summary Bar */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[11px] font-medium text-slate-400">Total</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">{totalCount}</span>
              <Users size={14} className="text-slate-500" />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-3">
            <span className="text-[11px] font-medium text-emerald-400">Present</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-300">{presentCount}</span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
          </div>
          <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-3">
            <span className="text-[11px] font-medium text-amber-400">Late</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-amber-300">{lateCount}</span>
              <Clock size={14} className="text-amber-500" />
            </div>
          </div>
          <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-3">
            <span className="text-[11px] font-medium text-rose-400">Absent</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-rose-300">{absentCount}</span>
              <XCircle size={14} className="text-rose-500" />
            </div>
          </div>
          <div className="rounded-xl border border-sky-900/30 bg-sky-950/20 p-3">
            <span className="text-[11px] font-medium text-sky-400">Excused</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-sky-300">{excusedCount}</span>
              <AlertCircle size={14} className="text-sky-500" />
            </div>
          </div>
          <div className="rounded-xl border border-orange-900/30 bg-orange-950/20 p-3">
            <span className="text-[11px] font-medium text-orange-400">Turnout</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-orange-300">{attendanceRate}%</span>
            </div>
          </div>
        </div>

        {/* Search, Filter & Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
              {(['all', 'present', 'late', 'absent', 'excused'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 capitalize font-medium transition ${
                    statusFilter === st
                      ? 'bg-orange-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleMarkAllPresent}
              className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              <CheckCheck size={14} className="text-emerald-400" />
              <span>Mark All Present</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Student Roster List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 size={24} className="animate-spin text-orange-500" />
              <span className="text-xs">Loading attendance roster...</span>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
              <Users size={28} className="text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">No students match your filter</p>
              <p className="text-xs text-slate-500">Try changing your search or status filter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRoster.map((student) => {
                return (
                  <div
                    key={student.student_id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 transition hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-xs text-orange-400">
                        {(student.student_name || 'S')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{student.student_name}</h4>
                        <p className="text-[11px] text-slate-400">{student.student_email}</p>
                      </div>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.student_id, 'present')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                          student.status === 'present'
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-emerald-400'
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        Present
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.student_id, 'late')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                          student.status === 'late'
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-amber-400'
                        }`}
                      >
                        <Clock size={12} />
                        Late
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.student_id, 'absent')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                          student.status === 'absent'
                            ? 'bg-rose-500 text-white shadow-md'
                            : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        <XCircle size={12} />
                        Absent
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.student_id, 'excused')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 ${
                          student.status === 'excused'
                            ? 'bg-sky-500 text-white shadow-md'
                            : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-sky-400'
                        }`}
                      >
                        <AlertCircle size={12} />
                        Excused
                      </button>
                    </div>

                    {/* Notes Input */}
                    <div className="sm:w-56">
                      <input
                        type="text"
                        placeholder="Add note (optional)..."
                        value={student.notes || ''}
                        onChange={(e) => handleNotesChange(student.student_id, e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4">
          <p className="text-xs text-slate-500">
            {hasChanges ? 'Changes will be saved to cohort attendance records' : 'All changes saved'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="border-slate-700 text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSaveAttendance}
              className="text-xs"
            >
              <Save size={14} />
              <span>Save Attendance</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
