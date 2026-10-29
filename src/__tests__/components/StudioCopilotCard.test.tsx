import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioCopilotCard } from '../../components/student/player/StudioCopilotCard';
import type { StudioRecommendation } from '../../lib/recommendationService';
import type { Lesson } from '../../lib/courseService';

const mockRecommendations: StudioRecommendation[] = [
  {
    type: 'next_lesson',
    title: 'Color Grading Masterclass Part 2',
    subtitle: 'Resume where you left off in Module 3.',
    actionText: 'Resume Lesson',
    actionType: 'navigate_lesson',
    targetId: 'lesson-101',
  },
  {
    type: 'weak_skill',
    title: 'Audio Compression & EQ',
    subtitle: 'Critique scores highlighted muddy low-end frequencies.',
    actionText: 'Review Rubric',
    actionType: 'navigate_assignment',
    targetId: 'assign-201',
  },
];

const mockLessons: Lesson[] = [
  {
    id: 'lesson-101',
    module_id: 'mod-1',
    title: 'Color Grading Masterclass Part 2',
    description: 'Learn Lumetri Curves',
    video_url: 'https://example.com/video.mp4',
    duration_seconds: 600,
    position: 2,
    status: 'published',
  },
];

describe('StudioCopilotCard Dark Mode & Professional Styling Suite', () => {
  it('returns null when recommendations are empty', () => {
    const { container } = render(
      <StudioCopilotCard
        studioRecommendations={[]}
        allLessons={mockLessons}
        selectLesson={vi.fn()}
        onTabChange={vi.fn()}
        onOpenAchievements={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with professional dark mode classes, obsidian depth, and correct contrasts', () => {
    const selectLesson = vi.fn();
    const onTabChange = vi.fn();
    const onOpenAchievements = vi.fn();

    render(
      <StudioCopilotCard
        studioRecommendations={mockRecommendations}
        allLessons={mockLessons}
        selectLesson={selectLesson}
        onTabChange={onTabChange}
        onOpenAchievements={onOpenAchievements}
      />
    );

    // Main header assertions
    expect(screen.getByText('Studio Copilot · Smart Learning Advisor')).toBeInTheDocument();
    expect(screen.getByText('AI Guided')).toBeInTheDocument();

    // Verify outer card container has dark mode background classes
    const outerCard = screen.getByText('Studio Copilot · Smart Learning Advisor').closest('.rounded-2xl');
    expect(outerCard).toHaveClass('dark:border-white/10');
    expect(outerCard).toHaveClass('dark:from-[#0e1424]');
    expect(outerCard).toHaveClass('dark:via-[#090d1a]');
    expect(outerCard).toHaveClass('dark:to-surface-base');

    // Verify recommendation tiles have dark mode background & contrast
    const lessonTitle = screen.getByText('Color Grading Masterclass Part 2');
    const recTile = lessonTitle.closest('.rounded-xl');
    expect(recTile).toHaveClass('dark:border-white/10');
    expect(recTile).toHaveClass('dark:bg-surface-elevated/40');
    expect(lessonTitle).toHaveClass('dark:text-white');

    // Click action button and verify dispatch
    const resumeBtn = screen.getByRole('button', { name: /Resume Lesson/i });
    expect(resumeBtn).toHaveClass('dark:text-orange-400');
    fireEvent.click(resumeBtn);
    expect(selectLesson).toHaveBeenCalledWith(mockLessons[0]);
    expect(onTabChange).toHaveBeenCalledWith('curriculum');
  });
});

