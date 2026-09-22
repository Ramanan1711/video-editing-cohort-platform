import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CommunityTopNav, type TopNavTab } from '../components/community/CommunityTopNav';
import { CommunitySidebar, type CommunityActiveView } from '../components/community/CommunitySidebar';
import { CommunityFeed } from '../components/community/CommunityFeed';
import { CommunityMessages } from '../components/community/CommunityMessages';
import { CreatePostModal } from '../components/community/CreatePostModal';
import { LevelUpModal } from '../components/community/LevelUpModal';
import { WorkshopsModal } from '../components/community/WorkshopsModal';
import { useAuth } from '../context/useAuth';

export const CommunityHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Derive active view and channel directly from URL search params
  const tabParam = searchParams.get('tab');
  const channelParam = searchParams.get('channel');

  const activeView: CommunityActiveView = tabParam === 'messages' ? 'messages' : 'feed';
  const selectedChannelId: string = channelParam || 'batch-15-community';

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [showWorkshopsModal, setShowWorkshopsModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Sync state changes with URL search params
  const handleSelectView = (view: CommunityActiveView) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', view);
    if (view === 'feed') {
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
      {/* 1. Top Navigation Bar matching reference image */}
      <CommunityTopNav
        activeTab={activeView === 'feed' ? 'community' : 'messages'}
        onTabChange={handleTopNavTabChange}
        unreadMessagesCount={2}
        unreadNotificationsCount={10}
        onOpenLevelUpModal={() => setShowLevelUpModal(true)}
        onOpenWorkshopsModal={() => setShowWorkshopsModal(true)}
      />

      {/* 2. Workspace Body: Left Sidebar + Center Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Community Sidebar */}
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

        {/* Center Main View Area: Feed vs Messages */}
        <main className="flex flex-1 overflow-hidden">
          {activeView === 'feed' ? (
            <CommunityFeed
              selectedChannelId={selectedChannelId}
              onOpenCreateModal={() => setShowCreateModal(true)}
              refreshKey={feedRefreshKey}
            />
          ) : (
            <CommunityMessages initialChannelId={selectedChannelId} />
          )}
        </main>
      </div>

      {/* 3. Modals */}
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
