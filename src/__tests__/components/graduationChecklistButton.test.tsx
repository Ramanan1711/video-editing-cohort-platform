import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MilestonePanel } from '../../components/StudentFlowPanels';

describe('Issue 5: MilestonePanel Graduation Checklist & Certificate Access', () => {
  it('renders "View Graduation Checklist" when progressPercent < 100 and onViewCertificate is passed', () => {
    const onViewCertificate = vi.fn();
    const onViewReportCard = vi.fn();

    render(
      <MilestonePanel
        progressPercent={85}
        completedCount={17}
        totalLessons={20}
        onViewCertificate={onViewCertificate}
        onViewReportCard={onViewReportCard}
      />
    );

    const checklistBtn = screen.getByRole('button', { name: /view graduation checklist/i });
    expect(checklistBtn).toBeInTheDocument();
    expect(checklistBtn.className).toContain('dark:border-orange-500/30');

    // Clicking it opens the 4-pillar certificate requirements checklist
    fireEvent.click(checklistBtn);
    expect(onViewCertificate).toHaveBeenCalledTimes(1);

    // Official certificate button is not shown until 100%
    expect(screen.queryByRole('button', { name: /view official certificate/i })).not.toBeInTheDocument();
  });

  it('renders "View Official Certificate" when progressPercent is 100 and totalLessons > 0', () => {
    const onViewCertificate = vi.fn();
    const onViewReportCard = vi.fn();

    render(
      <MilestonePanel
        progressPercent={100}
        completedCount={20}
        totalLessons={20}
        onViewCertificate={onViewCertificate}
        onViewReportCard={onViewReportCard}
      />
    );

    const certBtn = screen.getByRole('button', { name: /view official certificate/i });
    expect(certBtn).toBeInTheDocument();

    fireEvent.click(certBtn);
    expect(onViewCertificate).toHaveBeenCalledTimes(1);

    // Incomplete checklist button is replaced by official certificate button
    expect(screen.queryByRole('button', { name: /view graduation checklist/i })).not.toBeInTheDocument();
  });

  it('omits graduation checklist button if onViewCertificate callback is undefined', () => {
    render(
      <MilestonePanel
        progressPercent={50}
        completedCount={10}
        totalLessons={20}
      />
    );

    expect(screen.queryByRole('button', { name: /view graduation checklist/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view official certificate/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Keep going/i)).toBeInTheDocument();
  });
});

