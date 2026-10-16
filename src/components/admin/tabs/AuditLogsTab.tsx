import { useMemo, useState } from 'react';
import { Download, History, Layers, Search, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Pagination } from '../../ui/Pagination';
import type { AuditLog } from '../../../lib/adminService';

export interface AuditLogsTabProps {
  auditLogs: AuditLog[];
  onExportAuditCSV: (actionFilter?: string) => Promise<void>;
  exportingAuditCsv: boolean;
}

function AuditActionBadge({ action }: { action: string }) {
  if (action.includes('role')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-transparent dark:border-purple-800/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
        <UserCheck size={11} /> {action}
      </span>
    );
  }
  if (action.includes('status') || action.includes('suspend')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-transparent dark:border-amber-800/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
        <UserX size={11} /> {action}
      </span>
    );
  }
  if (action.includes('enrollment')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-transparent dark:border-blue-800/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
        <Layers size={11} /> {action}
      </span>
    );
  }
  if (action.includes('delete') || action.includes('remove')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-transparent dark:border-red-800/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
        <Trash2 size={11} /> {action}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
      <History size={11} /> {action}
    </span>
  );
}

export function AuditLogsTab({
  auditLogs,
  onExportAuditCSV,
  exportingAuditCsv,
}: AuditLogsTabProps) {
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [selectedAuditMeta, setSelectedAuditMeta] = useState<AuditLog | null>(null);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (log.actor?.full_name && log.actor.full_name.toLowerCase().includes(auditSearch.toLowerCase())) ||
        (log.actor_name && log.actor_name.toLowerCase().includes(auditSearch.toLowerCase())) ||
        (log.actor?.email && log.actor.email.toLowerCase().includes(auditSearch.toLowerCase()));

      let matchesFilter = true;
      if (auditActionFilter !== 'all') {
        matchesFilter = log.action.toLowerCase().includes(auditActionFilter.toLowerCase());
      }
      return matchesSearch && matchesFilter;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const totalAuditPages = Math.ceil(filteredAuditLogs.length / auditPageSize) || 1;
  const safeAuditPage = Math.min(auditPage, totalAuditPages);

  const pagedAuditLogs = useMemo(() => {
    const start = (safeAuditPage - 1) * auditPageSize;
    return filteredAuditLogs.slice(start, start + auditPageSize);
  }, [filteredAuditLogs, safeAuditPage, auditPageSize]);

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <History className="text-orange-500" size={18} />
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Audit Logs &amp; Governance</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Immutable event log of administrative mutations, security modifications, enrollments, and content transitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs shadow-2xs">
            <Search size={14} className="text-slate-400 dark:text-slate-500" />
            <input
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setAuditPage(1);
              }}
              placeholder="Search action, actor, entity..."
              className="w-40 sm:w-56 bg-transparent outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <select
            value={auditActionFilter}
            onChange={(e) => {
              setAuditActionFilter(e.target.value);
              setAuditPage(1);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Actions ({auditLogs.length})</option>
            <option value="role" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Role Changes</option>
            <option value="status" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Status &amp; Suspensions</option>
            <option value="enrollment" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Enrollments</option>
            <option value="cohort" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Cohort Settings</option>
            <option value="announcement" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Announcements</option>
            <option value="session" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Live Sessions</option>
            <option value="post" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Moderation</option>
            <option value="certificate" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Certificates</option>
            <option value="internship_report" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Internship Reports</option>
            <option value="submission" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Submissions &amp; Grading</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onExportAuditCSV(auditActionFilter === 'all' ? undefined : auditActionFilter)}
            loading={exportingAuditCsv}
            className="text-xs font-bold gap-1.5"
          >
            <Download size={13} /> Export Audit CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Actor</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Target Entity</th>
              <th className="py-2.5 px-3">Metadata Preview</th>
              <th className="py-2.5 px-3 text-right">Inspection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {pagedAuditLogs.length ? (
              pagedAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 text-slate-900 dark:text-white font-bold whitespace-nowrap">
                    <div>{log.actor?.full_name || log.actor_name || (log.actor_id ? log.actor_id.slice(0, 8) : 'System')}</div>
                    {log.actor_role && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono capitalize block">{log.actor_role}</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <AuditActionBadge action={log.action} />
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                  </td>
                  <td className="py-3 px-3 max-w-xs truncate text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {JSON.stringify(log.metadata)}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setSelectedAuditMeta(log)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-orange-600 dark:hover:text-orange-400 transition"
                    >
                      View JSON
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  No audit log events match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredAuditLogs.length > auditPageSize && (
        <div className="pt-3">
          <Pagination
            currentPage={safeAuditPage}
            totalPages={totalAuditPages}
            totalItems={filteredAuditLogs.length}
            pageSize={auditPageSize}
            onPageChange={setAuditPage}
            onPageSizeChange={setAuditPageSize}
          />
        </div>
      )}

      {/* JSON Metadata Inspector Modal */}
      {selectedAuditMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">Audit Event Metadata</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {selectedAuditMeta.action} · {new Date(selectedAuditMeta.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditMeta(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-emerald-400 border border-slate-800">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(
                  {
                    id: selectedAuditMeta.id,
                    action: selectedAuditMeta.action,
                    actor: selectedAuditMeta.actor,
                    actor_id: selectedAuditMeta.actor_id,
                    entity_type: selectedAuditMeta.entity_type,
                    entity_id: selectedAuditMeta.entity_id,
                    metadata: selectedAuditMeta.metadata,
                    created_at: selectedAuditMeta.created_at,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedAuditMeta(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

