import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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

export function CommunityTab({
  posts,
  reports,
  canModerateCommunity,
  onDeletePost,
  onResolveReport,
}: CommunityTabProps) {
  const [communitySubTab, setCommunitySubTab] = useState<'posts' | 'reports'>('posts');

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-slate-950">Community Moderation &amp; Safety</h2>
          <p className="mt-1 text-xs text-slate-500">
            Inspect cohort discussion posts, review reported content, and resolve moderation flags.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommunitySubTab('posts')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              communitySubTab === 'posts'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Discussions ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setCommunitySubTab('reports')}
            className={`relative rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              communitySubTab === 'reports'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Reports Queue ({reports.length})
            {reports.some((r) => r.status === 'pending') && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                {reports.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {communitySubTab === 'posts' && (
        <div className="mt-6 divide-y divide-slate-100">
          {posts.length ? (
            posts.map((post) => (
              <div key={post.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 font-bold text-xs">
                    {post.author_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-slate-900">{post.author_name}</strong>
                      <span className="text-[11px] text-slate-400">({post.author_email})</span>
                      <span className="text-[10px] text-slate-400">
                        · {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{post.body}</p>
                  </div>
                </div>

                {canModerateCommunity && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void onDeletePost(post.id)}
                    className="text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                  >
                    <Trash2 size={13} /> Remove Post
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">No community posts found.</p>
          )}
        </div>
      )}

      {communitySubTab === 'reports' && (
        <div className="mt-6 divide-y divide-slate-100">
          {reports.length ? (
            reports.map((report) => (
              <div key={report.id} className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-start">
                <div className="space-y-1.5 flex-1 min-w-0 pr-4">
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
                    <strong className="text-xs font-bold text-slate-900">
                      Reason: {report.reason}
                    </strong>
                    <span className="text-[11px] text-slate-400">
                      by {report.reporter_name} {report.reporter_email ? `(${report.reporter_email})` : ''}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      · {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {report.post_title && (
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      Thread: {report.post_title}
                    </p>
                  )}
                  <div className="mt-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {report.post_body || '(Post body unavailable or removed)'}
                  </div>
                </div>

                {canModerateCommunity && (
                  <div className="flex shrink-0 items-center gap-2">
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
                      <Trash2 size={13} /> Remove Post
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">No community reports filed.</p>
          )}
        </div>
      )}
    </Card>
  );
}

