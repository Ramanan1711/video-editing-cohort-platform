import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, MessageSquare, Flag } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import type { AdminCommunityPost, CommunityReport } from '../../../lib/adminService';

export interface CommunityTabProps {
  posts: AdminCommunityPost[];
  reports: CommunityReport[];
  canModerateCommunity: boolean;
  onDeletePost: (id: string) => Promise<void>;
  onResolveReport: (reportId: string, status: 'resolved' | 'dismissed') => Promise<void>;
}

const BODY_TRUNCATE_LENGTH = 280;

export function CommunityTab({
  posts,
  reports,
  canModerateCommunity,
  onDeletePost,
  onResolveReport,
}: CommunityTabProps) {
  const [communitySubTab, setCommunitySubTab] = useState<'posts' | 'reports'>('posts');
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(new Set());

  const toggleExpandPost = (id: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandReport = (id: string) => {
    setExpandedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-slate-950">Community Moderation &amp; Safety</h2>
          <p className="mt-1 text-xs text-slate-500">
            Inspect cohort discussion posts, review reported content, and resolve moderation flags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCommunitySubTab('posts')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
              communitySubTab === 'posts'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare size={13} />
            Discussions ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setCommunitySubTab('reports')}
            className={`relative rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
              communitySubTab === 'reports'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Flag size={13} />
            Reports Queue ({reports.length})
            {reports.some((r) => r.status === 'pending') && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                {reports.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {communitySubTab === 'posts' && (
        <div className="mt-6 divide-y divide-slate-100">
          {posts.length ? (
            posts.map((post) => {
              const isExpanded = expandedPostIds.has(post.id);
              const rawBody = post.body || '';
              const shouldTruncate = rawBody.length > BODY_TRUNCATE_LENGTH;
              const displayedBody =
                shouldTruncate && !isExpanded
                  ? `${rawBody.slice(0, BODY_TRUNCATE_LENGTH).trimEnd()}...`
                  : rawBody;

              return (
                <div key={post.id} className="py-4 first:pt-2 last:pb-2">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Author Avatar */}
                    <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 font-bold text-xs sm:text-sm shadow-2xs">
                      {post.author_name?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    {/* Content Container with min-w-0 to prevent flexbox overflow blowout */}
                    <div className="flex-1 min-w-0">
                      {/* Header row: Author metadata & Action button */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                          <strong
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-xs"
                            title={post.author_name}
                          >
                            {post.author_name}
                          </strong>
                          {post.author_email && (
                            <span
                              className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-sm"
                              title={post.author_email}
                            >
                              ({post.author_email})
                            </span>
                          )}
                          <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">
                            ·{' '}
                            {new Date(post.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {canModerateCommunity && (
                          <div className="shrink-0 self-start sm:self-auto">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void onDeletePost(post.id)}
                              className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                            >
                              <Trash2 size={13} className="mr-1 inline" /> Remove Post
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Post Title if available */}
                      {(post as { title?: string | null }).title && (
                        <h3 className="mt-1.5 text-xs sm:text-sm font-bold text-slate-900 break-words [overflow-wrap:anywhere]">
                          {(post as { title?: string | null }).title}
                        </h3>
                      )}

                      {/* Consistent, unified post.body container across Mobile, Tablet portrait, and Desktop */}
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 transition-all">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {displayedBody || (
                            <span className="italic text-slate-400">(Empty post body)</span>
                          )}
                        </p>

                        {shouldTruncate && (
                          <button
                            type="button"
                            onClick={() => toggleExpandPost(post.id)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer focus:outline-hidden transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={13} /> See less
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} /> See more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">No community posts found.</p>
          )}
        </div>
      )}

      {communitySubTab === 'reports' && (
        <div className="mt-6 divide-y divide-slate-100">
          {reports.length ? (
            reports.map((report) => {
              const isExpanded = expandedReportIds.has(report.id);
              const rawBody = report.post_body || '';
              const shouldTruncate = rawBody.length > BODY_TRUNCATE_LENGTH;
              const displayedBody =
                shouldTruncate && !isExpanded
                  ? `${rawBody.slice(0, BODY_TRUNCATE_LENGTH).trimEnd()}...`
                  : rawBody;

              return (
                <div key={report.id} className="py-4 first:pt-2 last:pb-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            report.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : report.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {report.status}
                        </span>
                        <strong className="text-xs sm:text-sm font-bold text-slate-900 break-words [overflow-wrap:anywhere]">
                          Reason: {report.reason}
                        </strong>
                        <span className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                          by {report.reporter_name} {report.reporter_email ? `(${report.reporter_email})` : ''}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">
                          ·{' '}
                          {new Date(report.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {report.post_title && (
                        <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1 break-words [overflow-wrap:anywhere]">
                          Thread: {report.post_title}
                        </p>
                      )}

                      {/* Consistent, unified report.post_body container */}
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 transition-all">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {displayedBody || (
                            <span className="italic text-slate-400">(Post body unavailable or removed)</span>
                          )}
                        </p>

                        {shouldTruncate && (
                          <button
                            type="button"
                            onClick={() => toggleExpandReport(report.id)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer focus:outline-hidden transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={13} /> See less
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} /> See more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {canModerateCommunity && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 md:pt-0">
                        {report.status === 'pending' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void onResolveReport(report.id, 'dismissed')}
                              className="text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              Dismiss
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void onResolveReport(report.id, 'resolved')}
                              className="text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                            >
                              Mark Resolved
                            </Button>
                          </>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void onDeletePost(report.post_id)}
                          className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={13} className="mr-1 inline" /> Remove Post
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">No community reports filed.</p>
          )}
        </div>
      )}
    </Card>
  );
}

