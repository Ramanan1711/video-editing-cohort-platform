import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommunityTab } from '../../components/admin/tabs/CommunityTab';
import type { AdminCommunityPost, CommunityReport } from '../../lib/adminService';

describe('CommunityTab (Community Moderation & Safety Responsive Views)', () => {
  const mockPosts: AdminCommunityPost[] = [
    {
      id: 'post-1',
      author_id: 'user-1',
      author_name: 'Alexandre Montgomery-Smith',
      author_email: 'alexandre.montgomery.smith@videoeditingcohort.com',
      body: 'Short check-in post about Premiere Pro keyboard shortcuts.',
      created_at: new Date('2026-10-28T10:00:00Z').toISOString(),
    },
    {
      id: 'post-2',
      author_id: 'user-2',
      author_name: 'Sarah Connor',
      author_email: 'sarah.connor@cyberdyne.com',
      body:
        'This is a long essay discussing Color Space Transforms in DaVinci Resolve Studio 19. When working with ARRI Alexa LogC3 vs LogC4, ACEScc vs ACEScct provides subtle roll-off differences in the lower specular range. For a complete deep-dive breakdown check out: https://drive.google.com/file/d/1XyZ9876543210abcdef_davinci_color_grading_masterclass_extended_walkthrough_edition/view?usp=sharing. In addition, always remember to calibrate with 10-bit DeckLink output to avoid GPU driver quantization errors.',
      created_at: new Date('2026-10-28T11:30:00Z').toISOString(),
    },
  ];

  const mockReports: CommunityReport[] = [
    {
      id: 'rep-1',
      post_id: 'post-2',
      reporter_id: 'user-3',
      reporter_name: 'John Doe',
      reporter_email: 'john@example.com',
      reason: 'Spam or Promotional Link',
      status: 'pending',
      created_at: new Date('2026-10-28T12:00:00Z').toISOString(),
      post_title: 'DaVinci Resolve Log Transforms Discussion',
      post_body:
        'Reported content: Please review this post for external promotion links: https://drive.google.com/file/d/1XyZ9876543210abcdef_davinci_color_grading_masterclass_extended_walkthrough_edition/view?usp=sharing. It exceeds community sharing guidelines.',
    },
  ];

  it('renders discussions list with author info and contained post.body', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <CommunityTab
        posts={mockPosts}
        reports={mockReports}
        canModerateCommunity={true}
        onDeletePost={onDelete}
        onResolveReport={onResolve}
      />
    );

    // Title and subtabs
    expect(screen.getByText('Community Moderation & Safety')).toBeInTheDocument();
    expect(screen.getByText(/Discussions \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Reports Queue \(1\)/)).toBeInTheDocument();

    // Short post body is displayed fully
    expect(
      screen.getByText('Short check-in post about Premiere Pro keyboard shortcuts.')
    ).toBeInTheDocument();

    // Long post is truncated with "See more"
    expect(screen.getByText(/See more/)).toBeInTheDocument();
  });

  it('toggles expansion of long post.body when "See more" / "See less" is clicked', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <CommunityTab
        posts={mockPosts}
        reports={mockReports}
        canModerateCommunity={true}
        onDeletePost={onDelete}
        onResolveReport={onResolve}
      />
    );

    const seeMoreBtn = screen.getByText(/See more/);
    expect(seeMoreBtn).toBeInTheDocument();

    // Expand
    fireEvent.click(seeMoreBtn);
    expect(screen.getByText(/See less/)).toBeInTheDocument();
    expect(
      screen.getByText(/DeckLink output to avoid GPU driver quantization errors/)
    ).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText(/See less/));
    expect(screen.getByText(/See more/)).toBeInTheDocument();
  });

  it('supports deleting a post as admin', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <CommunityTab
        posts={mockPosts}
        reports={mockReports}
        canModerateCommunity={true}
        onDeletePost={onDelete}
        onResolveReport={onResolve}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /Remove Post/i });
    expect(removeButtons.length).toBe(2);

    fireEvent.click(removeButtons[0]);
    expect(onDelete).toHaveBeenCalledWith('post-1');
  });

  it('switches to reports queue and renders report post_body and moderation buttons', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <CommunityTab
        posts={mockPosts}
        reports={mockReports}
        canModerateCommunity={true}
        onDeletePost={onDelete}
        onResolveReport={onResolve}
      />
    );

    // Switch to Reports tab
    fireEvent.click(screen.getByText(/Reports Queue/));

    expect(screen.getByText('Reason: Spam or Promotional Link')).toBeInTheDocument();
    expect(screen.getByText('Thread: DaVinci Resolve Log Transforms Discussion')).toBeInTheDocument();
    expect(screen.getByText(/Reported content: Please review this post/)).toBeInTheDocument();

    // Action buttons in reports
    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Resolved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Post/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(onResolve).toHaveBeenCalledWith('rep-1', 'dismissed');

    fireEvent.click(screen.getByRole('button', { name: /Mark Resolved/i }));
    expect(onResolve).toHaveBeenCalledWith('rep-1', 'resolved');
  });
});

