import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CommunityBoard } from '../../components/CommunityBoard';
import * as communityService from '../../lib/communityService';

describe('CommunityBoard Realtime Subscription Stability (Bug 5)', () => {
  const unsubscribeMock = vi.fn();
  let realtimeCallback: (() => void) | undefined = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeCallback = undefined;

    vi.spyOn(communityService, 'listCohortPosts').mockResolvedValue([
      {
        id: 'post-1',
        cohort_id: 'cohort-100',
        lesson_id: null,
        title: 'Post 1',
        author_id: 'user-1',
        author_name: 'Alex Chen',
        author_role: 'student',
        body: 'First community update',
        moderation_status: 'published',
        comment_count: 2,
        reactions: {},
        user_reactions: [],
        is_pinned: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'post-2',
        cohort_id: 'cohort-100',
        lesson_id: null,
        title: 'Post 2',
        author_id: 'user-2',
        author_name: 'Sarah Smith',
        author_role: 'mentor',
        body: 'Second community update',
        moderation_status: 'published',
        comment_count: 1,
        reactions: {},
        user_reactions: [],
        is_pinned: false,
        created_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(communityService, 'listCommunityComments').mockResolvedValue([
      {
        id: 'comment-1',
        post_id: 'post-1',
        author_id: 'user-3',
        author_name: 'Priya Patel',
        author_role: 'student',
        body: 'Great insights!',
        created_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(communityService, 'subscribeToCohortCommunity').mockImplementation(
      (_cohortId, cb) => {
        realtimeCallback = cb;
        return unsubscribeMock;
      }
    );
  });

  it('subscribes once on mount and does NOT tear down subscription when comments are expanded or collapsed', async () => {
    render(<CommunityBoard cohortId="cohort-100" userId="user-current" />);

    // Wait for posts to load
    await waitFor(() => {
      expect(screen.getByText('First community update')).toBeInTheDocument();
    });

    // Subscribed once on mount
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).not.toHaveBeenCalled();

    // Toggle comments on post 1
    const commentButtons = screen.getAllByRole('button', { name: /Comments/i });
    fireEvent.click(commentButtons[0]);

    // Comments should load
    await waitFor(() => {
      expect(screen.getByText('Great insights!')).toBeInTheDocument();
    });

    // Verification: expanding comments did NOT tear down or re-subscribe the WebSocket connection
    expect(unsubscribeMock).not.toHaveBeenCalled();
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(1);

    // Toggle comments on post 2
    fireEvent.click(commentButtons[1]);

    await waitFor(() => {
      expect(communityService.listCommunityComments).toHaveBeenCalledWith('post-2');
    });

    // Still no unsubscribe
    expect(unsubscribeMock).not.toHaveBeenCalled();
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(1);

    // Collapse comments on post 2
    fireEvent.click(commentButtons[1]);

    // Still no unsubscribe
    expect(unsubscribeMock).not.toHaveBeenCalled();
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(1);
  });

  it('refreshes active post comments via realtime callback without reconnecting', async () => {
    render(<CommunityBoard cohortId="cohort-100" userId="user-current" />);

    await waitFor(() => {
      expect(screen.getByText('First community update')).toBeInTheDocument();
    });

    // Expand comments on post 1
    const commentButtons = screen.getAllByRole('button', { name: /Comments/i });
    act(() => {
      fireEvent.click(commentButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Great insights!')).toBeInTheDocument();
    });

    // Mock new comment arriving
    vi.mocked(communityService.listCommunityComments).mockResolvedValueOnce([
      {
        id: 'comment-1',
        post_id: 'post-1',
        author_id: 'user-3',
        author_name: 'Priya Patel',
        author_role: 'student',
        body: 'Great insights!',
        created_at: new Date().toISOString(),
      },
      {
        id: 'comment-2',
        post_id: 'post-1',
        author_id: 'user-4',
        author_name: 'Jordan Lee',
        author_role: 'mentor',
        body: 'Live comment via WebSocket!',
        created_at: new Date().toISOString(),
      },
    ]);

    // Trigger realtime event callback
    expect(realtimeCallback).toBeDefined();
    act(() => {
      realtimeCallback!();
    });

    await waitFor(() => {
      expect(screen.getByText('Live comment via WebSocket!')).toBeInTheDocument();
    });

    // Channel stayed alive without reconnection
    expect(unsubscribeMock).not.toHaveBeenCalled();
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly when cohortId changes or component unmounts', async () => {
    const { rerender, unmount } = render(
      <CommunityBoard cohortId="cohort-100" userId="user-current" />
    );

    await waitFor(() => {
      expect(screen.getByText('First community update')).toBeInTheDocument();
    });

    // Change cohortId prop
    rerender(<CommunityBoard cohortId="cohort-200" userId="user-current" />);

    // Old subscription should be torn down, new one initiated
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(communityService.subscribeToCohortCommunity).toHaveBeenCalledTimes(2);

    // Unmount component
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(2);
  });
});
