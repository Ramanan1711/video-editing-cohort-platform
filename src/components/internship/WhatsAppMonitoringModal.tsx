import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  WhatsAppLog,
  WhatsAppCohortStats,
  WhatsAppDeliveryStatus,
  WhatsAppEventType,
} from '../../lib/whatsappService';
import {
  listCohortWhatsAppLogs,
  getCohortWhatsAppStats,
  processPendingWhatsAppRetries,
  retrySingleWhatsAppMessage,
  dispatchWhatsAppMessage,
  getWhatsAppProvider,
} from '../../lib/whatsappService';
import { useToast } from '../../context/useToast';

interface WhatsAppMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  cohortName: string;
}

export function WhatsAppMonitoringModal({
  isOpen,
  onClose,
  cohortId,
  cohortName,
}: WhatsAppMonitoringModalProps) {
  const toast = useToast();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [stats, setStats] = useState<WhatsAppCohortStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingRetries, setProcessingRetries] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | WhatsAppDeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Test Dispatch Form
  const [showTestForm, setShowTestForm] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEventType, setTestEventType] = useState<WhatsAppEventType>('daily_challenge');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const activeProvider = useMemo(() => getWhatsAppProvider().name, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedLogs, fetchedStats] = await Promise.all([
        listCohortWhatsAppLogs(cohortId, { limit: 100 }),
        getCohortWhatsAppStats(cohortId),
      ]);
      setLogs(fetchedLogs);
      setStats(fetchedStats);
    } catch (err) {
      console.error('Failed to load WhatsApp monitoring data:', err);
      toast.error('Failed to load WhatsApp delivery telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, cohortId]);

  const handleProcessRetries = async () => {
    try {
      setProcessingRetries(true);
      const summary = await processPendingWhatsAppRetries(20);
      if (summary.attempted === 0) {
        toast.info('No pending retries found in queue');
      } else {
        toast.success(
          `Processed ${summary.attempted} retries: ${summary.succeeded} sent, ${summary.failed} failed.`
        );
        await loadData();
      }
    } catch {
      toast.error('Failed to process WhatsApp retry queue');
    } finally {
      setProcessingRetries(false);
    }
  };

  const handleRetrySingle = async (logId: string) => {
    try {
      setRetryingLogId(logId);
      const result = await retrySingleWhatsAppMessage(logId);
      if (result.success) {
        toast.success('Message successfully re-dispatched via provider!');
      } else {
        toast.error(result.error || 'Retry attempt failed');
      }
      await loadData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Retry failed';
      toast.error(errMsg);
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) return;

    try {
      setSendingTest(true);
      const result = await dispatchWhatsAppMessage({
        cohortId,
        phone: testPhone,
        eventType: testEventType,
        message: testMessage,
      });

      if (result.success) {
        toast.success(`Automated WhatsApp dispatch sent via ${result.log.provider}!`);
        setShowTestForm(false);
        setTestMessage('');
        await loadData();
      } else {
        toast.error(result.error || 'Automated dispatch rejected');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Dispatch failed';
      toast.error(errMsg);
    } finally {
      setSendingTest(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (log.student_name && log.student_name.toLowerCase().includes(q)) ||
        log.recipient_phone.includes(q) ||
        log.message_body.toLowerCase().includes(q) ||
        (log.provider_message_id && log.provider_message_id.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [logs, statusFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  WhatsApp Delivery &amp; Gateway Hub
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck size={12} />
                  Provider: {activeProvider.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cohortName} • Automated Delivery Tracking &amp; Exponential Backoff Retries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTestForm(!showTestForm)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Send size={13} />
              {showTestForm ? 'Hide Test Form' : 'Test Dispatch'}
            </button>

            <button
              onClick={handleProcessRetries}
              disabled={processingRetries}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
              title="Execute retry dispatch for queued/failed messages"
            >
              <RefreshCw size={13} className={processingRetries ? 'animate-spin' : ''} />
              {processingRetries ? 'Processing...' : 'Run Retries'}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Dispatched</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {stats?.total_messages || logs.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Delivery Rate</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats ? `${stats.delivery_rate_pct}%` : '100%'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Delivered</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.delivered_count ?? logs.filter((l) => ['delivered', 'read'].includes(l.status)).length}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Read / Seen</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Eye size={16} className="text-sky-500" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.read_count ?? logs.filter((l) => l.status === 'read').length}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Queued / Retrying</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock size={16} className="text-amber-500" />
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.queued_count ?? logs.filter((l) => ['queued', 'sending'].includes(l.status)).length}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Failed / Dead-Letter</p>
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-xl font-bold text-red-600 dark:text-red-400">
                {stats?.failed_count ?? logs.filter((l) => l.status === 'failed').length}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Test Dispatch Form */}
        {showTestForm && (
          <form
            onSubmit={handleSendTestMessage}
            className="p-4 mx-6 my-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                Automated Gateway Dispatch Simulator
              </h4>
              <span className="text-[11px] text-slate-500">
                Tests automated provider webhook, retry worker &amp; idempotency
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Phone
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Event Type
                </label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value as WhatsAppEventType)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="daily_challenge">Daily Challenge Drop</option>
                  <option value="workshop_alert">Workshop Live Alert</option>
                  <option value="inactivity_nudge">Inactivity Nudge</option>
                  <option value="feedback">Mentor Review Feedback</option>
                  <option value="custom">Custom Message</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Message Body
              </label>
              <textarea
                rows={2}
                placeholder="Type production challenge or alert message..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTestForm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingTest}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingTest ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                {sendingTest ? 'Dispatching...' : 'Dispatch Message'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'delivered', 'read', 'sent', 'queued', 'failed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition capitalize ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by student, phone, or id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw size={24} className="animate-spin mb-2 text-emerald-500" />
              <p className="text-xs">Loading delivery receipts and retry queues...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <MessageCircle size={36} className="text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No WhatsApp notifications found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Messages dispatched for challenge drops, live workshops, or inactivity alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Recipient</th>
                    <th className="px-3.5 py-2.5">Event</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Provider ID</th>
                    <th className="px-3.5 py-2.5">Retries</th>
                    <th className="px-3.5 py-2.5">Timestamps</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredLogs.map((log) => {
                    const isRetrying = retryingLogId === log.id;
                    const canRetry = log.status === 'failed' || log.status === 'queued';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3.5 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {log.student_name || 'Intern'}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {log.recipient_phone}
                          </div>
                        </td>

                        <td className="px-3.5 py-3 capitalize">
                          <span className="inline-block rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {log.event_type.replace('_', ' ')}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 max-w-[200px]" title={log.message_body}>
                            {log.message_body}
                          </p>
                        </td>

                        <td className="px-3.5 py-3">
                          {log.status === 'read' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                              <Eye size={11} /> Read
                            </span>
                          ) : log.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 size={11} /> Delivered
                            </span>
                          ) : log.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                              <CheckCircle2 size={11} /> Sent
                            </span>
                          ) : log.status === 'queued' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <Clock size={11} /> Queued
                            </span>
                          ) : log.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              Cancelled (Opt-out)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                              <AlertCircle size={11} /> Failed
                            </span>
                          )}
                          {log.error_details && (
                            <p className="text-[10px] text-red-500 mt-1 max-w-[180px] truncate" title={log.error_details}>
                              {log.error_details}
                            </p>
                          )}
                        </td>

                        <td className="px-3.5 py-3">
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {log.provider_message_id || '—'}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400">
                            {log.provider}
                          </span>
                        </td>

                        <td className="px-3.5 py-3">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {log.retry_count} / {log.max_retries}
                          </span>
                          {log.next_retry_at && log.status === 'queued' && (
                            <span className="block text-[9px] text-amber-500 mt-0.5">
                              Next: {new Date(log.next_retry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-[10px] text-slate-500 dark:text-slate-400">
                          <div>Created: {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          {log.delivered_at && (
                            <div className="text-emerald-600 dark:text-emerald-400">
                              Delivered: {new Date(log.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right">
                          {canRetry && (
                            <button
                              onClick={() => handleRetrySingle(log.id)}
                              disabled={isRetrying}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition"
                            >
                              <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                              {isRetrying ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
