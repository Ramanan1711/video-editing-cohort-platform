import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestonePanel } from '../../components/StudentFlowPanels';
import { LessonPlayer } from '../../components/student/player/LessonPlayer';
import { AchievementsModal } from '../../components/student/AchievementsModal';
import type { Lesson } from '../../lib/courseService';
import type { GamificationProfile } from '../../lib/gamificationService';

describe('MilestonePanel & StudentPlayerView - Dark Mode Consistency', () => {
  it('renders View Evaluation Dossier button with dark mode classes in MilestonePanel', () => {
    const onViewReportCard = vi.fn();
    render(
      <MilestonePanel
        progressPercent={40}
        completedCount={4}
        totalLessons={10}
        onViewReportCard={onViewReportCard}
      />
    );

    const dossierBtn = screen.getByRole('button', { name: /view evaluation dossier/i });
    expect(dossierBtn).toBeInTheDocument();
    expect(dossierBtn.className).toContain('dark:border-white/15');
    expect(dossierBtn.className).toContain('dark:bg-surface-card/90');
    expect(dossierBtn.className).toContain('dark:text-slate-100');
  });

  it('renders Internship Report Card with dark mode classes when cohort is complete', () => {
    const onViewReportCard = vi.fn();
    render(
      <MilestonePanel
        progressPercent={100}
        completedCount={10}
        totalLessons={10}
        onViewReportCard={onViewReportCard}
      />
    );

    const reportCardBtn = screen.getByRole('button', { name: /internship report card/i });
    expect(reportCardBtn).toBeInTheDocument();
    expect(reportCardBtn.className).toContain('dark:border-white/15');
    expect(reportCardBtn.className).toContain('dark:bg-surface-card');
    expect(reportCardBtn.className).toContain('dark:text-slate-100');
  });

  it('renders Completed button in LessonPlayer with professional dark mode classes', () => {
    const mockLesson: Lesson = {
      id: 'lesson-1',
      module_id: 'mod-1',
      title: 'Pacing & Rhythm',
      description: 'Master fast-paced cuts',
      position: 1,
      video_url: 'https://cdn.example.com/video.mp4',
      duration_minutes: 10,
    };

    render(
      <LessonPlayer
        lesson={mockLesson}
        completed={true}
        onToggleComplete={vi.fn()}
        prevLesson={null}
        nextLesson={null}
        onSelectLesson={vi.fn()}
        userId="user-1"
        cohortId="cohort-1"
      />
    );

    const completedBtn = screen.getByRole('button', { name: /completed/i });
    expect(completedBtn).toBeInTheDocument();
    expect(completedBtn.className).toContain('dark:border-emerald-500/30');
    expect(completedBtn.className).toContain('dark:bg-emerald-950/60');
    expect(completedBtn.className).toContain('dark:text-emerald-300');
    expect(completedBtn.className).toContain('dark:hover:bg-emerald-900/60');
  });

  it('renders Unlocked badge pills and cards in AchievementsModal with professional dark mode styling', () => {
    const mockGamification: GamificationProfile = {
      totalXp: 1200,
      level: 3,
      tierTitle: 'Lead Editor',
      nextTierTitle: 'Senior Post Artist',
      currentLevelMinXp: 1000,
      nextLevelXp: 2000,
      progressPercent: 60,
      streakDays: 4,
      hasStreakShield: true,
      weeklyActiveCount: 3,
      weeklyTarget: 5,
      recentHeatmap: [],
      badges: [
        {
          id: 'badge-1',
          name: 'First Cut Pro',
          description: 'Exported first rough cut',
          category: 'craft',
          iconName: 'Award',
          progressText: '1/1 cuts completed',
          unlocked: true,
          unlockedAt: '2026-03-01T00:00:00Z',
        },
        {
          id: 'badge-2',
          name: 'Pacing Virtuoso',
          description: 'Perfect rhythm across 5 sequences',
          category: 'consistency',
          iconName: 'Flame',
          progressText: '2/5 sequences completed',
          unlocked: false,
        },
      ],
    };

    render(
      <AchievementsModal
        isOpen={true}
        onClose={vi.fn()}
        gamification={mockGamification}
      />
    );

    const unlockedBadge = screen.getByText('Unlocked');
    expect(unlockedBadge).toBeInTheDocument();
    expect(unlockedBadge.className).toContain('dark:border-emerald-500/30');
    expect(unlockedBadge.className).toContain('dark:bg-emerald-950/60');
    expect(unlockedBadge.className).toContain('dark:text-emerald-300');

    const badgeTitle = screen.getByText('First Cut Pro');
    expect(badgeTitle).toBeInTheDocument();
    expect(badgeTitle.className).toContain('dark:text-white');
  });
});

