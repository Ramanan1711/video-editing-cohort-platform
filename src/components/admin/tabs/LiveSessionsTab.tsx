import { useState } from 'react';
import { Calendar, Edit2, ExternalLink, Radio, Trash2, Users } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { AttendanceRosterModal } from '../../attendance/AttendanceRosterModal';
import type { LiveSession } from '../../../lib/adminService';

export interface LiveSessionsTabProps {
  sessions: LiveSession[];
  onSaveSession: (
    data: { title: string; description: string; starts_at: string; meeting_url: string },
    editingId?: string
  ) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
}

export function LiveSessionsTab({
  sessions,
  onSaveSession,
  onDeleteSession,
}: LiveSessionsTabProps) {
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [sessionInput, setSessionInput] = useState<{
    title: string;
    description: string;
    starts_at: string;
    meeting_url: string;
  }>({
    title: '',
    description: '',
    starts_at: '',
    meeting_url: '',
  });
  const [savingSession, setSavingSession] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<LiveSession | null>(null);

  const nowTimestamp = Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSession(true);
    try {
      await onSaveSession(sessionInput, editingSession?.id);
      setEditingSession(null);
      setSessionInput({ title: '', description: '', starts_at: '', meeting_url: '' });
    } finally {
      setSavingSession(false);
    }
  };

  const handleEditClick = (item: LiveSession) => {
    setEditingSession(item);
    setSessionInput({
      title: item.title,
      description: item.description || '',
      starts_at: item.starts_at.slice(0, 16),
      meeting_url: item.meeting_url,
    });
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setSessionInput({ title: '', description: '', starts_at: '', meeting_url: '' });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950">
          {editingSession ? 'Edit Live Session' : 'Schedule Live Review Room'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Host group critiques, timelines teardowns, and interactive Q&amp;A sessions with students.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Session Title
            <input
              type="text"
              required
              value={sessionInput.title}
              onChange={(e) => setSessionInput({ ...sessionInput, title: e.target.value })}
              placeholder="e.g., Live Timeline Critique & Sound Design Workshop"
              className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Agenda &amp; Description
            <textarea
              rows={3}
              value={sessionInput.description}
              onChange={(e) => setSessionInput({ ...sessionInput, description: e.target.value })}
              placeholder="Topics covered, student timeline reviews, guest editors..."
              className="mt-1.5 block w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">
              Session Start Date &amp; Time
              <input
                type="datetime-local"
                required
                value={sessionInput.starts_at}
                onChange={(e) => setSessionInput({ ...sessionInput, starts_at: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Meeting URL (Zoom / Google Meet)
              <input
                type="url"
                required
                value={sessionInput.meeting_url}
                onChange={(e) => setSessionInput({ ...sessionInput, meeting_url: e.target.value })}
                placeholder="https://zoom.us/j/..."
                className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingSession && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelEdit}
              >
                Cancel Edit
              </Button>
            )}
            <Button type="submit" size="sm" loading={savingSession} className="ml-auto">
              <Radio size={14} />
              <span>{editingSession ? 'Save Changes' : 'Schedule Session'}</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950">Scheduled Live Sessions ({sessions.length})</h2>
        <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {sessions.length ? (
            sessions.map((item) => {
              const sessionDate = new Date(item.starts_at);
              const isUpcoming = sessionDate.getTime() > nowTimestamp;

              return (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isUpcoming ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isUpcoming ? 'Upcoming' : 'Past'}
                        </span>
                        <strong className="text-sm font-bold text-slate-900">{item.title}</strong>
                      </div>

                      {item.description && (
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Calendar size={13} className="text-orange-500" />
                          {sessionDate.toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        <a
                          href={item.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-orange-600 font-bold hover:underline"
                        >
                          Test Room Link <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAttendanceSession(item)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-orange-300 hover:text-orange-600 transition"
                        title="View & manage attendance roster"
                      >
                        <Users size={13} className="text-orange-500" />
                        <span>Roster</span>
                      </button>
                      <button
                        onClick={() => handleEditClick(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                        title="Edit session"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => void onDeleteSession(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-xs text-slate-400">No live sessions scheduled.</p>
          )}
        </div>
      </Card>

      {/* Live Session Attendance Roster Modal */}
      {attendanceSession && (
        <AttendanceRosterModal
          sessionId={attendanceSession.id}
          sessionTitle={attendanceSession.title}
          sessionStartsAt={attendanceSession.starts_at}
          onClose={() => setAttendanceSession(null)}
        />
      )}
    </div>
  );
}
