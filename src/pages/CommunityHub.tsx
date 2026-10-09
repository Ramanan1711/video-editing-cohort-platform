import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Rss, MessageSquare, Plus, Zap, Layers } from 'lucide-react';
import { CommunityTopNav, type TopNavTab } from '../components/community/CommunityTopNav';
import { CommunitySidebar, type CommunityActiveView } from '../components/community/CommunitySidebar';
import { CommunityFeed } from '../components/community/CommunityFeed';
import { CommunityMessages } from '../components/community/CommunityMessages';
import { CreatePostModal } from '../components/community/CreatePostModal';
import { LevelUpModal } from '../components/community/LevelUpModal';
import { LevelUpView } from '../components/community/LevelUpView';
import { WorkshopsModal } from '../components/community/WorkshopsModal';
import { useAuth } from '../context/useAuth';

export const CommunityHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Derive active view and channel directly from URL search params
  const tabParam = searchParams.get('tab');
  const channelParam = searchParams.get('channel');

  const activeView: CommunityActiveView = tabParam === 'messages' ? 'messages' : tabParam === 'levelup' ? 'levelup' : 'feed';
  const selectedChannelId: string = channelParam || 'batch-15-community';

  // Modals & Navigation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [showWorkshopsModal, setShowWorkshopsModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Sync state changes with URL search params
  const handleSelectView = (view: CommunityActiveView) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', view);
    if (view === 'feed' || view === 'levelup') {
      newParams.delete('channel');
    }
    setSearchParams(newParams);
  };

  const handleSelectChannel = (channelId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'messages');
    newParams.set('channel', channelId);
    setSearchParams(newParams);
  };

  // Top Nav Tab dispatcher
  const handleTopNavTabChange = (tab: TopNavTab) => {
    if (tab === 'community') {
      handleSelectView('feed');
    } else if (tab === 'messages') {
      handleSelectView('messages');
    } else if (tab === 'levelup') {
      handleSelectView('levelup');
    } else if (tab === 'workshops') {
      navigate('/workshops');
    } else if (tab === 'courses') {
      if (profile?.role === 'admin') {
        navigate('/admin/courses');
      } else {
        navigate('/student/dashboard');
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/70 dark:bg-slate-950 font-sans">
      {/* 1. Top Navigation Bar */}
      <CommunityTopNav
        activeTab={activeView === 'feed' ? 'community' : activeView === 'messages' ? 'messages' : 'levelup'}
        onTabChange={handleTopNavTabChange}
        unreadMessagesCount={2}
        unreadNotificationsCount={10}
        onOpenLevelUpModal={() => setShowLevelUpModal(true)}
        onOpenWorkshopsModal={() => setShowWorkshopsModal(true)}
      />

      {/* 2. Workspace Body: Left Sidebar + Center Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Community Sidebar (Desktop) */}
        <CommunitySidebar
          activeView={activeView}
          selectedChannelId={selectedChannelId}
          onSelectView={handleSelectView}
          onSelectChannel={handleSelectChannel}
          onCreateClick={() => setShowCreateModal(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          unreadMessagesCount={2}
          qaUnreadCount={16}
        />

        {/* Center Main View Area: Feed vs Messages vs Level Up Tab */}
        <main className="flex flex-1 overflow-hidden pb-16 md:pb-0">
          {activeView === 'feed' ? (
            <CommunityFeed
              selectedChannelId={selectedChannelId}
              onOpenCreateModal={() => setShowCreateModal(true)}
              refreshKey={feedRefreshKey}
            />
          ) : activeView === 'messages' ? (
            <CommunityMessages initialChannelId={selectedChannelId} />
          ) : (
            <LevelUpView onClose={() => handleSelectView('feed')} />
          )}
        </main>
      </div>

      {/* 3. Mobile Channels Off-Canvas Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close channels drawer"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform animate-in slide-in-from-left duration-200 dark:border-slate-800 dark:bg-slate-950">
            <CommunitySidebar
              activeView={activeView}
              selectedChannelId={selectedChannelId}
              onSelectView={(v) => {
                handleSelectView(v);
                setMobileSidebarOpen(false);
              }}
              onSelectChannel={(ch) => {
                handleSelectChannel(ch);
                setMobileSidebarOpen(false);
              }}
              onCreateClick={() => {
                setShowCreateModal(true);
                setMobileSidebarOpen(false);
              }}
              unreadMessagesCount={2}
              qaUnreadCount={16}
              isMobileDrawer={true}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* 4. Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95"
      >
        <button
          onClick={() => handleSelectView('feed')}
          aria-label="Community Feed"
          className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-bold transition ${
            activeView === 'feed'
              ? 'text-orange-600 dark:text-orange-400 font-black'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Rss size={18} />
          <span>Feed</span>
        </button>

        <button
          onClick={() => handleSelectView('messages')}
          aria-label="Community Chat"
          className={`relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-bold transition ${
            activeView === 'messages'
              ? 'text-orange-600 dark:text-orange-400 font-black'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <MessageSquare size={18} />
          <span>Chat</span>
          <span className="absolute top-0.5 right-2 flex size-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-black text-white">
            2
          </span>
        </button>

        <button
          onClick={() => setShowCreateModal(true)}
          aria-label="Create Post"
          className="flex size-10 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 active:scale-95 transition"
        >
          <Plus size={20} />
        </button>

        <button
          onClick={() => handleSelectView('levelup')}
          aria-label="Level Up Mastery"
          className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-bold transition ${
            activeView === 'levelup'
              ? 'text-amber-600 dark:text-amber-400 font-black'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Zap size={18} />
          <span>Mastery</span>
        </button>

        <button
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Community Rooms"
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
        >
          <Layers size={18} />
          <span>Rooms</span>
        </button>
      </nav>

      {/* 5. Modals */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => {
          setFeedRefreshKey((k) => k + 1);
        }}
      />

      <LevelUpModal
        isOpen={showLevelUpModal}
        onClose={() => setShowLevelUpModal(false)}
      />

      <WorkshopsModal
        isOpen={showWorkshopsModal}
        onClose={() => setShowWorkshopsModal(false)}
      />
    </div>
  );
};
