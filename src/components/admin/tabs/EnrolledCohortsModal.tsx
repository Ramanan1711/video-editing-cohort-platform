import { useState } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  CheckCircle2,
  Phone,
  Search,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import type { AdminEnrollment, UserProfile } from '../../../lib/adminService';
import type { Cohort } from '../../../lib/courseService';

export interface EnrolledCohortsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UserProfile | null;
  enrollments: AdminEnrollment[];
  cohorts?: Cohort[];
}

export function EnrolledCohortsModal({
  isOpen,
  onClose,
  student,
  enrollments,
  cohorts: _cohorts,
}: EnrolledCohortsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !student) return null;

  const filteredEnrollments = enrollments.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.cohort_name && e.cohort_name.toLowerCase().includes(q)) ||
      (e.cohort_id && e.cohort_id.toLowerCase().includes(q)) ||
      (e.status && e.status.toLowerCase().includes(q))
    );
  });

  const activeCount = enrollments.filter((e) => e.status === 'active').length;
  const completedCount = enrollments.filter((e) => e.status === 'completed').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enrolled-cohorts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-500 text-white font-black text-base shadow-md shadow-orange-500/20">
              {student.full_name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="enrolled-cohorts-title"
                  className="text-base font-black text-slate-900 dark:text-white"
                >
                  {student.full_name || 'Student'}
                </h3>
                <span className="rounded-full bg-orange-100 dark:bg-orange-950/80 border border-orange-200 dark:border-orange-800/80 px-2 py-0.5 text-[10px] font-black text-orange-800 dark:text-orange-300">
                  {enrollments.length} {enrollments.length === 1 ? 'Cohort' : 'Cohorts'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {student.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Student Contact Bar (WhatsApp / Phone) */}
        {(student.whatsapp_number || student.phone) && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
              <Phone size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Contact: {student.whatsapp_number || student.phone}</span>
            </div>
            <a
              href={`https://wa.me/${(student.whatsapp_number || student.phone)?.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>Chat on WhatsApp</span>
              <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Stats & Search Bar */}
        <div className="p-5 pb-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Enrolled Tracks & Cohorts
              </span>
              <span className="text-[11px] text-slate-400">
                ({activeCount} Active{completedCount > 0 ? `, ${completedCount} Completed` : ''})
              </span>
            </div>
          </div>

          {enrollments.length > 3 && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Filter enrolled cohorts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
          )}
        </div>

        {/* Scrollable Course Cards List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2.5">
          {filteredEnrollments.length > 0 ? (
            filteredEnrollments.map((enr, idx) => {
              const isActive = enr.status === 'active';
              const isCompleted = enr.status === 'completed';

              return (
                <div
                  key={`${enr.cohort_id}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 hover:border-orange-300 dark:hover:border-orange-800/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 mt-0.5">
                      <BookOpen size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {enr.cohort_name || 'Assigned Cohort'}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {enr.cohort_id && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                            {enr.cohort_id}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          <span>
                            {enr.created_at || enr.enrolled_at
                              ? new Date(enr.created_at || enr.enrolled_at!).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Enrolled'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                        : isCompleted
                        ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isActive && <CheckCircle2 size={10} />}
                    <span>{enr.status || 'Active'}</span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              <Layers size={20} className="mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
              <p>No cohorts match your filter.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-[11px] text-slate-400">
            Total {enrollments.length} track{enrollments.length === 1 ? '' : 's'} assigned
          </span>
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs font-bold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
