import React from 'react';
import {
  Rss,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';

export type CommunityActiveView = 'feed' | 'messages' | 'levelup';

interface CommunitySidebarProps {
  activeView: CommunityActiveView;
  selectedChannelId?: string;
  onSelectView: (view: CommunityActiveView) => void;
  onSelectChannel?: (channelId: string) => void;
  onCreateClick: () => void;
  unreadMessagesCount?: number;
  qaUnreadCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

export const CommunitySidebar: React.FC<CommunitySidebarProps> = ({
  activeView,
  onSelectView,
  onCreateClick,
  unreadMessagesCount = 2,
  collapsed = false,
  onToggleCollapse,
  onCloseMobile,
  isMobileDrawer = false,
}) => {
  if (collapsed && !isMobileDrawer) {
    return (
      <aside className="hidden md:flex w-16 border-r border-slate-200/80 bg-white p-3 flex-col items-center gap-4 dark:border-slate-800 dark:bg-slate-950">
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          onClick={onCreateClick}
          title="Create post"
          className="flex size-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 transition"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => onSelectView('feed')}
          title="Feed"
          className={`flex size-10 items-center justify-center rounded-xl transition ${
            activeView === 'feed'
              ? 'bg-amber-100/70 text-amber-950 font-bold dark:bg-amber-900/40 dark:text-amber-200'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Rss size={18} />
        </button>
        <button
          onClick={() => onSelectView('messages')}
          title="Messages"
          className={`relative flex size-10 items-center justify-center rounded-xl transition ${
            activeView === 'messages'
              ? 'bg-amber-100/70 text-amber-950 font-bold dark:bg-amber-900/40 dark:text-amber-200'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare size={18} />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-black text-white">
              {unreadMessagesCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`${
        isMobileDrawer
          ? 'w-full h-full'
          : 'hidden md:flex w-64 shrink-0 border-r border-slate-200/80'
      } bg-white flex flex-col justify-between p-4 dark:border-slate-800 dark:bg-slate-950 overflow-y-auto`}
    >
      <div className="space-y-4">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white">
            Community
          </h2>
          {isMobileDrawer && onCloseMobile ? (
            <button
              onClick={onCloseMobile}
              aria-label="Close channels drawer"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          ) : onToggleCollapse ? (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <PanelLeftClose size={17} />
            </button>
          ) : null}
        </div>

        {/* + Create Button */}
        <button
          onClick={onCreateClick}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] transition"
        >
          <Plus size={18} />
          <span>Create</span>
        </button>

        {/* Primary Views */}
        <div className="space-y-1">
          <button
            onClick={() => onSelectView('feed')}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-extrabold transition ${
              activeView === 'feed'
                ? 'bg-amber-50 text-amber-950 shadow-2xs dark:bg-amber-950/40 dark:text-amber-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Rss
                size={16}
                className={activeView === 'feed' ? 'text-amber-600' : 'text-slate-400'}
              />
              <span>Feed</span>
            </div>
          </button>

          <button
            onClick={() => onSelectView('messages')}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-extrabold transition ${
              activeView === 'messages'
                ? 'bg-amber-50 text-amber-950 shadow-2xs dark:bg-amber-950/40 dark:text-amber-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare
                size={16}
                className={activeView === 'messages' ? 'text-amber-600' : 'text-slate-400'}
              />
              <span>Messages</span>
            </div>

            {unreadMessagesCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

