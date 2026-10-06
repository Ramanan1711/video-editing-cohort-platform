import { useMemo, useState } from 'react';
import { Edit2, Megaphone, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import type { AdminAnnouncement } from '../../../lib/adminService';
import type { Cohort } from '../../../lib/courseService';

export interface AnnouncementsTabProps {
  cohorts: Cohort[];
  announcements: AdminAnnouncement[];
  canBroadcastAnnouncements: boolean;
  onSaveAnnouncement: (
    data: { title: string; body: string; cohort_id: string | null },
    editingId?: string
  ) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
}

export function AnnouncementsTab({
  cohorts,
  announcements,
  canBroadcastAnnouncements,
  onSaveAnnouncement,
  onDeleteAnnouncement,
}: AnnouncementsTabProps) {
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [announcementInput, setAnnouncementInput] = useState<{
    title: string;
    body: string;
    cohort_id: string;
  }>({
    title: '',
    body: '',
    cohort_id: '',
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [announcementPageSize, setAnnouncementPageSize] = useState(10);

  const totalAnnouncementPages = Math.ceil(announcements.length / announcementPageSize) || 1;
  const safeAnnouncementPage = Math.min(announcementPage, totalAnnouncementPages);

  const pagedAnnouncements = useMemo(() => {
    const start = (safeAnnouncementPage - 1) * announcementPageSize;
    return announcements.slice(start, start + announcementPageSize);
  }, [announcements, safeAnnouncementPage, announcementPageSize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBroadcastAnnouncements) return;
    setSavingAnnouncement(true);
    try {
      const cohortId = announcementInput.cohort_id.trim() ? announcementInput.cohort_id.trim() : null;
      await onSaveAnnouncement(
        {
          title: announcementInput.title,
          body: announcementInput.body,
          cohort_id: cohortId,
        },
        editingAnnouncement?.id
      );
      setEditingAnnouncement(null);
      setAnnouncementInput({ title: '', body: '', cohort_id: '' });
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleEditClick = (item: AdminAnnouncement) => {
    setEditingAnnouncement(item);
    setAnnouncementInput({
      title: item.title,
      body: item.body,
      cohort_id: item.cohort_id || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingAnnouncement(null);
    setAnnouncementInput({ title: '', body: '', cohort_id: '' });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950">
          {editingAnnouncement ? 'Edit Announcement' : 'Publish Broadcast Announcement'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Broadcast project deadlines, milestone releases, or live stream reminders to all students.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Target Audience / Cohort
            <select
              value={announcementInput.cohort_id}
              onChange={(e) => setAnnouncementInput({ ...announcementInput, cohort_id: e.target.value })}
              className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-orange-400"
            >
              <option value="">All Cohorts (Platform Broadcast)</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.title || 'Untitled Cohort'}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Announcement Title
            <input
              type="text"
              required
              value={announcementInput.title}
              onChange={(e) => setAnnouncementInput({ ...announcementInput, title: e.target.value })}
              placeholder="e.g., Week 2 Narrative Rushes & LUTs Released!"
              className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Message Body
            <textarea
              required
              rows={4}
              value={announcementInput.body}
              onChange={(e) => setAnnouncementInput({ ...announcementInput, body: e.target.value })}
              placeholder="Provide details, assignment instructions, and links..."
              className="mt-1.5 block w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-orange-400"
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            {editingAnnouncement && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelEdit}
              >
                Cancel Edit
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              loading={savingAnnouncement}
              disabled={!canBroadcastAnnouncements}
              className="ml-auto"
            >
              <Megaphone size={14} />
              <span>{editingAnnouncement ? 'Save Changes' : 'Broadcast Announcement'}</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950">Published Dispatches ({announcements.length})</h2>
        <div className="mt-4 space-y-3 pr-1">
          {pagedAnnouncements.length ? (
            pagedAnnouncements.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-bold text-slate-900">{item.title}</strong>
                      {item.cohort_id ? (
                        <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          {cohorts.find((c) => c.id === item.cohort_id)?.name ||
                            cohorts.find((c) => c.id === item.cohort_id)?.title ||
                            'Targeted Cohort'}
                        </span>
                      ) : (
                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Platform Broadcast
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.body}</p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      Published {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                      title="Edit announcement"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => void onDeleteAnnouncement(item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete announcement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-xs text-slate-400">No announcements published yet.</p>
          )}
        </div>

        {announcements.length > announcementPageSize && (
          <div className="pt-3">
            <Pagination
              currentPage={safeAnnouncementPage}
              totalPages={totalAnnouncementPages}
              totalItems={announcements.length}
              pageSize={announcementPageSize}
              onPageChange={setAnnouncementPage}
              onPageSizeChange={setAnnouncementPageSize}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

