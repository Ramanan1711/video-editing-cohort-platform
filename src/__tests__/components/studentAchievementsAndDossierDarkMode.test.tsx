import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestonePanel } from '../../components/StudentFlowPanels';
import { LessonPlayer } from '../../components/student/player/LessonPlayer';
import type { Lesson } from '../../lib/courseService';

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
});

