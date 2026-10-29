import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestonePanel } from '../../components/StudentFlowPanels';

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
});

