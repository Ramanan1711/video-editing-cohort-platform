import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommunityHub } from '../../pages/CommunityHub';
import { ThemeProvider } from '../../context/ThemeContext';

// Mock useAuth
vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'creator@cutcraft.com' },
    profile: {
      id: 'test-user-1',
      full_name: 'Test Creator',
      role: 'admin',
      admin_role: 'super_admin',
    },
    signOut: vi.fn(),
  }),
}));

// Mock communityService
vi.mock('../../lib/communityService', () => ({
  listCohortPosts: vi.fn().mockResolvedValue([
    {
      id: 'post-1',
      author_id: 'user-2',
      author_name: 'Alex Rivera',
      title: 'Pacing test for vertical commercial',
      body: 'Feedback requested on the jump-cut transitions at 0:15.',
      is_pinned: false,
      moderation_status: 'published',
      created_at: new Date().toISOString(),
    },
  ]),
  createCommunityPost: vi.fn().mockResolvedValue({
    id: 'post-new',
    title: 'New discussion',
    body: 'Some text',
  }),
  uploadCommunityMedia: vi.fn().mockResolvedValue({
    url: 'https://example.com/demo.mp4',
    type: 'video',
    name: 'demo.mp4',
  }),
  detectMediaType: vi.fn((url: string) => (url.includes('video') || url.includes('.mp4') ? 'video' : 'image')),
  addCommunityComment: vi.fn().mockResolvedValue({
    id: 'comm-new',
    body: 'Nice pacing!',
  }),
  listCommunityComments: vi.fn().mockResolvedValue([]),
  togglePostReaction: vi.fn().mockResolvedValue({ added: true }),
}));

describe('CommunityHub & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders top navigation bar with brand CUT / CRAFT, workspace menu button, center tabs, and utility controls', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    // CUT / CRAFT Brand Identity
    expect(screen.getAllByText('CUT / CRAFT').length).toBeGreaterThan(0);
    expect(screen.getByText('Community Hub')).toBeInTheDocument();

    // Workspace Navigation Menu Button (Hamburger icon: three minus symbols one below one: ☰)
    const menuBtn = screen.getByRole('button', { name: /open workspace navigation/i });
    expect(menuBtn).toBeInTheDocument();

    // Opening workspace navigation drawer
    fireEvent.click(menuBtn);
    expect(screen.getByText('Admin overview')).toBeInTheDocument();
    expect(screen.getByText('Course studio')).toBeInTheDocument();
    expect(screen.getByText('Student view')).toBeInTheDocument();

    // Closing workspace navigation drawer
    const closeBtn = screen.getByRole('button', { name: /close navigation/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Course studio')).not.toBeInTheDocument();

    // Center Tabs & Controls
    expect(screen.getAllByText('Community').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Messages').length).toBeGreaterThan(0);
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Workshops')).toBeInTheDocument();
  });

  it('renders left sidebar with Create button, Feed, Messages, and channel groups', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('TOP 1% B9')).toBeInTheDocument();
    expect(screen.getByText('BATCH 15')).toBeInTheDocument();
    expect(screen.getByText('Chat Room')).toBeInTheDocument();
    expect(screen.getByText('Batch 15 Community')).toBeInTheDocument();
    expect(screen.getByText('B15 Blue Squad')).toBeInTheDocument();
  });

  it('renders pinned post with CREATOR badge and TOP 3 LEADERBOARD with CUT / CRAFT branding', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getAllByText('CUT / CRAFT').length).toBeGreaterThan(0);
    expect(screen.getByText('CREATOR')).toBeInTheDocument();
    expect(screen.getByText(/TOP 3 LEADERBOARD/i)).toBeInTheDocument();
    expect(screen.getByText('Shibin')).toBeInTheDocument();
    expect(screen.getByText('Thilak')).toBeInTheDocument();
    expect(screen.getByText('Meshak')).toBeInTheDocument();
    expect(screen.getByText('1.2K CRAFT')).toBeInTheDocument();
  });

  it('toggles like counter on the pinned post', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    // Initial likes: 18
    expect(screen.getByText('18')).toBeInTheDocument();

    const likeButton = screen.getByText('18').closest('button');
    expect(likeButton).not.toBeNull();
    fireEvent.click(likeButton!);

    // Should increment to 19
    expect(screen.getByText('19')).toBeInTheDocument();

    // Clicking again should decrement back to 18
    fireEvent.click(likeButton!);
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('switches between Feed and Messages views smoothly', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    // Click Messages in sidebar
    const messagesButtons = screen.getAllByText('Messages');
    fireEvent.click(messagesButtons[0]);

    // Should show chat input composer
    expect(screen.getByPlaceholderText(/Message/i)).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
  });

  it('opens and closes the Create Post modal when clicking Create', async () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    const createBtn = screen.getByText('Create');
    fireEvent.click(createBtn);

    expect(screen.getByText('Create Community Post')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Share insights, ask questions/i)).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Create Community Post')).not.toBeInTheDocument();
    });
  });

  it('opens Level Up and Workshops modals from the top navigation', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    const levelUpBtn = screen.getByText('Level Up');
    fireEvent.click(levelUpBtn);
    expect(screen.getByText('Level Up & Mastery')).toBeInTheDocument();

    // Close
    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Level Up & Mastery')).not.toBeInTheDocument();

    // Workshops
    const workshopsBtn = screen.getByText('Workshops');
    fireEvent.click(workshopsBtn);
    expect(screen.getByText('Cohort Workshops')).toBeInTheDocument();
  });

  it('supports selecting Video, Photo, and Project attachment options in CreatePostModal', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <CommunityHub />
      </MemoryRouter>
    );

    const createBtn = screen.getByText('Create');
    fireEvent.click(createBtn);

    expect(screen.getByText('Attach Media (Video, Photo, Etc.)')).toBeInTheDocument();

    // Click Video tab
    const videoTab = screen.getByRole('button', { name: /video/i });
    fireEvent.click(videoTab);
    expect(screen.getByText(/Upload Video/i)).toBeInTheDocument();

    // Click Photo tab
    const photoTab = screen.getByRole('button', { name: /photo/i });
    fireEvent.click(photoTab);
    expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();

    // Click Project tab
    const projectTab = screen.getByRole('button', { name: /project/i });
    fireEvent.click(projectTab);
    expect(screen.getByText(/Upload Project/i)).toBeInTheDocument();

    // Click URL tab
    const urlTab = screen.getByRole('button', { name: /url/i });
    fireEvent.click(urlTab);
    expect(screen.getByPlaceholderText(/https:\/\/youtube\.com/i)).toBeInTheDocument();
  });

  it('toggles dark and light mode seamlessly via ThemeContext', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/community']}>
          <CommunityHub />
        </MemoryRouter>
      </ThemeProvider>
    );

    const themeToggleBtn = screen.getByRole('button', { name: /toggle dark mode/i });
    expect(themeToggleBtn).toBeInTheDocument();

    // Toggle to dark mode
    fireEvent.click(themeToggleBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('cutcraft_theme')).toBe('dark');

    // Toggle back to light mode
    fireEvent.click(themeToggleBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('cutcraft_theme')).toBe('light');
  });
});
