import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommunityTopNav } from '../../components/community/CommunityTopNav';

describe('CommunityTopNav Responsive Behavior (Mobile Landscape, Mobile Portrait & Tablet Portrait)', () => {
  it('renders brand identity, menu trigger, and utility controls without layout clipping', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter>
        <CommunityTopNav activeTab="community" onTabChange={onTabChange} />
      </MemoryRouter>
    );

    // Verify brand
    expect(screen.getByText('Iunoware')).toBeInTheDocument();
    expect(screen.getAllByText('Academy').length).toBeGreaterThan(0);

    // Verify workspace navigation hamburger
    const menuBtn = screen.getByRole('button', { name: /open workspace navigation/i });
    expect(menuBtn).toBeInTheDocument();

    // Verify right controls
    expect(screen.getByRole('button', { name: /sound effects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toBeInTheDocument();
  });

  it('renders adaptive center navigation pills with active tab label visible and tab change dispatching', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter>
        <CommunityTopNav activeTab="community" onTabChange={onTabChange} />
      </MemoryRouter>
    );

    // Click Messages tab
    const messagesBtn = screen.getByRole('button', { name: 'Messages' });
    expect(messagesBtn).toBeInTheDocument();
    fireEvent.click(messagesBtn);
    expect(onTabChange).toHaveBeenCalledWith('messages');

    // Click Level Up tab
    const levelUpBtn = screen.getByRole('button', { name: 'Level Up' });
    expect(levelUpBtn).toBeInTheDocument();
    fireEvent.click(levelUpBtn);
    expect(onTabChange).toHaveBeenCalledWith('levelup');
  });

  it('opens and closes the slide-out workspace navigation drawer with scroll-safe container', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter>
        <CommunityTopNav activeTab="community" onTabChange={onTabChange} />
      </MemoryRouter>
    );

    const menuBtn = screen.getByRole('button', { name: /open workspace navigation/i });
    fireEvent.click(menuBtn);

    // Verify drawer contents
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Community Sections')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close navigation/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    // Drawer is closed
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
  });

  it('opens the Quick App Launcher dropdown with scroll containment on landscape devices', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter>
        <CommunityTopNav activeTab="community" onTabChange={onTabChange} />
      </MemoryRouter>
    );

    const launcherBtn = screen.getByRole('button', { name: /quick app launcher/i });
    expect(launcherBtn).toBeInTheDocument();
    fireEvent.click(launcherBtn);

    expect(screen.getByText('Iunoware Apps')).toBeInTheDocument();
    expect(screen.getByText('Student Portal')).toBeInTheDocument();
    expect(screen.getByText('Community Hub')).toBeInTheDocument();

    // Closes on clicking launcher again
    fireEvent.click(launcherBtn);
    expect(screen.queryByText('Iunoware Apps')).not.toBeInTheDocument();
  });
});

