import { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Flame,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { useToast } from '../../context/useToast';
import {
  listCohortInternsMonitoring,
  type InternMonitoringRecord,
} from '../../lib/internshipService';
import {
  formatWhatsAppInactivityNudge,
  generateWhatsAppClickToChatUrl,
  sendWhatsAppNotification,
} from '../../lib/whatsappService';

interface InternshipMonitoringHubProps {
  cohortId: string;
  cohortName: string;
  mentorId: string;
}

export function InternshipMonitoringHub({
  cohortId,
  cohortName: _cohortName,
  mentorId: _mentorId,
}: InternshipMonitoringHubProps) {
  const toast = useToast();
  const [interns, setInterns] = useState<InternMonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'on_track' | 'at_risk' | 'critical'>('all');
  const [sendingNudgeId, setSendingNudgeId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await listCohortInternsMonitoring(cohortId);
      setInterns(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load monitoring telemetry';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cohortId) {
      loadData();
    }
  }, [cohortId]);

  // Telemetry metrics
  const stats = useMemo(() => {
    const total = interns.length;
    const onTrack = interns.filter((i) => i.riskStatus === 'on_track').length;
    const atRisk = interns.filter((i) => i.riskStatus === 'at_risk').length;
    const critical = interns.filter((i) => i.riskStatus === 'critical').length;
    const totalCompletedDays = interns.reduce((acc, i) => acc + i.completedDaysCount, 0);
    const avgCompletion = total > 0 ? Math.round((totalCompletedDays / (total * 15)) * 100) : 0;

    return { total, onTrack, atRisk, critical, avgCompletion };
  }, [interns]);

  const filteredInterns = useMemo(() => {
    return interns.filter((i) => {
      const matchesSearch =
        i.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = riskFilter === 'all' || i.riskStatus === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [interns, searchQuery, riskFilter]);

  const handleSendWhatsAppNudge = async (intern: InternMonitoringRecord) => {
    const phone = intern.phone || '919876543210';
    const resumeUrl = window.location.origin + '/student/dashboard?tab=internship_sprint';
    const nextDay = Math.min(15, intern.completedDaysCount + 1);
    const message = formatWhatsAppInactivityNudge(intern.fullName, nextDay, resumeUrl);

    try {
      setSendingNudgeId(intern.userId);
      await sendWhatsAppNotification(intern.userId, phone, 'inactivity_nudge', message);
      const url = generateWhatsAppClickToChatUrl(phone, message);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success(`WhatsApp nudge dispatched to ${intern.fullName}!`);
    } catch {
      toast.error('Failed to dispatch WhatsApp reminder');
    } finally {
      setSendingNudgeId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Interns</p>
              <p className="text-xl font-black text-slate-950 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">On Track</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.onTrack}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">At Risk (&gt;48h)</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.atRisk}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Critical / Drop-off</p>
              <p className="text-xl font-black text-red-600 dark:text-red-400">{stats.critical}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRiskFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              riskFilter === 'all'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            All Interns ({interns.length})
          </button>
          <button
            onClick={() => setRiskFilter('at_risk')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              riskFilter === 'at_risk'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            At Risk ({stats.atRisk})
          </button>
          <button
            onClick={() => setRiskFilter('critical')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              riskFilter === 'critical'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Critical Action Needed ({stats.critical})
          </button>
          <button
            onClick={() => setRiskFilter('on_track')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              riskFilter === 'on_track'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            On Track ({stats.onTrack})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Filter by intern name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={loadData}
            title="Refresh intern telemetry"
            className="flex size-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Interns Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Intern</th>
                <th className="px-4 py-3.5">WhatsApp</th>
                <th className="px-4 py-3.5">15-Day Heatmap Progress</th>
                <th className="px-4 py-3.5">Streak</th>
                <th className="px-4 py-3.5">Risk Status</th>
                <th className="px-4 py-3.5 text-right">Quick Nudge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-orange-500" />
                    Loading cohort intern telemetry...
                  </td>
                </tr>
              ) : filteredInterns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No interns found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredInterns.map((intern) => (
                  <tr key={intern.userId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-black text-slate-900 dark:text-white">
                        {intern.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">{intern.email}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {intern.phone ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                          <MessageCircle size={10} />
                          {intern.phone}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Not bound</span>
                      )}
                    </td>

                    {/* 15-Day Visual Mini Heatmap */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((day) => {
                          const status = intern.dayStatuses[day] || 'locked';
                          let bg = 'bg-slate-200 dark:bg-slate-800';
                          let title = `Day ${day}: Locked`;
                          if (status === 'accepted') {
                            bg = 'bg-emerald-500 shadow-2xs';
                            title = `Day ${day}: Completed & Accepted`;
                          } else if (status === 'pending') {
                            bg = 'bg-amber-400 animate-pulse';
                            title = `Day ${day}: Submitted (Review Pending)`;
                          } else if (status === 'missed') {
                            bg = 'bg-red-400';
                            title = `Day ${day}: Missed (Overdue)`;
                          }

                          return (
                            <div
                              key={day}
                              title={title}
                              className={`size-3 rounded-xs transition-transform hover:scale-125 cursor-pointer ${bg}`}
                            />
                          );
                        })}
                        <span className="ml-2 font-black text-slate-700 dark:text-slate-300 text-[11px]">
                          {intern.completedDaysCount}/15
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400">
                        <Flame size={13} />
                        {intern.streakDays}d
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {intern.riskStatus === 'on_track' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 size={11} /> On Track
                        </span>
                      ) : intern.riskStatus === 'at_risk' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                          <AlertCircle size={11} /> At Risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-extrabold text-red-800 dark:text-red-300 animate-pulse">
                          <ShieldAlert size={11} /> Critical
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppNudge(intern)}
                        disabled={sendingNudgeId === intern.userId}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition disabled:opacity-50"
                      >
                        <MessageCircle size={13} />
                        <span>Nudge</span>
                        <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
