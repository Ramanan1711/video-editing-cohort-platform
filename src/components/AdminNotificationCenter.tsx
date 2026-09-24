import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getAdminExecutiveMetrics,
  type AdminEscalationAlert,
} from '../lib/adminService';

interface AdminNotificationCenterProps {
  onNavigateTab?: (tab: string) => void;
}

export function AdminNotificationCenter({ onNavigateTab }: AdminNotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AdminEscalationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sla_breach' | 'dropout_risk' | 'capacity_warning' | 'content_review'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const metrics = await getAdminExecutiveMetrics();
      setAlerts(metrics.escalationAlerts || []);
    } catch (err) {
      console.warn('Failed to fetch admin alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getAdminExecutiveMetrics()
      .then((metrics) => {
        if (mounted) {
          setAlerts(metrics.escalationAlerts || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch admin alerts:', err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const interval = setInterval(() => {
      void fetchAlerts();
    }, 60000); // 1-minute auto refresh

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.type === filter);
  }, [alerts, filter]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const totalCount = alerts.length;

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Alert Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
        title="Operations & Escalation Alerts"
        aria-label="Admin Alerts"
      >
        <Bell size={16} className={criticalCount > 0 ? 'text-red-600' : 'text-slate-600'} />
      </button>

      {totalCount > 0 && (
        <span
          className={`pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-xs ${
            criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
          }`}
        >
          {totalCount > 9 ? '9+' : totalCount}
        </span>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-88 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-slate-950 text-white shadow-2xs">
                  <Bell size={13} />
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-950">
                  Operations &amp; Governance Alerts
                </h3>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {totalCount} active alert{totalCount === 1 ? '' : 's'} across cohorts, reviews, and content
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => void fetchAlerts()}
                disabled={loading}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-50"
                title="Refresh alerts"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 pt-2 text-[11px] font-bold gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'all' as const, label: 'All', count: alerts.length },
              {
                id: 'sla_breach' as const,
                label: 'SLA',
                count: alerts.filter((a) => a.type === 'sla_breach').length,
              },
              {
                id: 'dropout_risk' as const,
                label: 'Attrition',
                count: alerts.filter((a) => a.type === 'dropout_risk').length,
              },
              {
                id: 'content_review' as const,
                label: 'Review',
                count: alerts.filter((a) => a.type === 'content_review').length,
              },
              {
                id: 'capacity_warning' as const,
                label: 'Capacity',
                count: alerts.filter((a) => a.type === 'capacity_warning').length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`pb-2 px-2.5 border-b-2 whitespace-nowrap transition ${
                  filter === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </button>
            ))}
          </div>

          {/* Alerts List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-800">All Metrics Healthy</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  No active escalations matching this filter.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isWarning = alert.severity === 'warning';

                return (
                  <div
                    key={alert.id}
                    className={`p-4 transition ${
                      isCritical
                        ? 'bg-red-50/40 hover:bg-red-50/70'
                        : isWarning
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs ${
                          isCritical
                            ? 'bg-red-100 text-red-700 font-bold'
                            : isWarning
                            ? 'bg-amber-100 text-amber-800 font-bold'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {alert.type === 'sla_breach' ? (
                          <Clock size={15} />
                        ) : alert.type === 'dropout_risk' ? (
                          <AlertTriangle size={15} />
                        ) : alert.type === 'capacity_warning' ? (
                          <Layers size={15} />
                        ) : (
                          <Sparkles size={15} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider ${
                              isCritical
                                ? 'bg-red-100 text-red-800'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {alert.type.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-950 leading-tight">{alert.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{alert.description}</p>

                        {/* Action Link */}
                        <div className="mt-2.5 flex items-center gap-2">
                          {alert.targetTab === 'submissions' ? (
                            <Link
                              to="/review/submissions"
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                            >
                              <span>{alert.actionLabel || 'Inspect'}</span>
                              <ExternalLink size={11} />
                            </Link>
                          ) : alert.targetTab === 'courses' ? (
                            <Link
                              to="/admin/courses"
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                            >
                              <span>{alert.actionLabel || 'Inspect'}</span>
                              <ExternalLink size={11} />
                            </Link>
                          ) : alert.targetTab && onNavigateTab ? (
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateTab(alert.targetTab!);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                            >
                              <span>{alert.actionLabel || 'View Details'}</span>
                              <ExternalLink size={11} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
