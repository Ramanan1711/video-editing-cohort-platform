import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceList } from '../../components/student/player/ResourceList';
import type { LessonResource } from '../../lib/courseService';

describe('ResourceList - Practice Footage vs Benchmark Solution Access Rules', () => {
  const mockOnDownload = vi.fn();
  const mockOnToggleComplete = vi.fn();

  const practiceFootage: LessonResource = {
    id: 'res-footage-1',
    lesson_id: 'lesson-1',
    name: 'Action Scene Raw Practice Footage.mp4',
    url: 'course-assets/resources/footage1.mp4',
    visibility: 'enrolled',
    resource_type: 'video',
    file_size: 157286400, // 150 MB
  };

  const projectTemplate: LessonResource = {
    id: 'res-template-1',
    lesson_id: 'lesson-1',
    name: 'Premiere Pro Starter Timeline.prproj',
    url: 'course-assets/resources/starter.prproj',
    visibility: 'enrolled',
    resource_type: 'project_file',
    file_size: 5242880, // 5 MB
  };

  const benchmarkSolution: LessonResource = {
    id: 'res-solution-1',
    lesson_id: 'lesson-1',
    name: 'Instructor Benchmark Solution Timeline.drp',
    url: 'course-assets/resources/solution.drp',
    visibility: 'after_completion',
    resource_type: 'project_file',
    file_size: 10485760, // 10 MB
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders practice footage and project templates as unlocked and downloadable at the start of a lesson (completed = false)', () => {
    render(
      <ResourceList
        resources={[practiceFootage, projectTemplate, benchmarkSolution]}
        completed={false}
        onToggleComplete={mockOnToggleComplete}
        downloadingResourceId={null}
        onDownloadResource={mockOnDownload}
      />
    );

    // Practice footage & starter project files are immediately accessible
    expect(screen.getByText('Action Scene Raw Practice Footage.mp4')).toBeInTheDocument();
    expect(screen.getByText('Premiere Pro Starter Timeline.prproj')).toBeInTheDocument();

    const enrolledBadges = screen.getAllByText('Practice Footage & Project Assets');
    expect(enrolledBadges.length).toBe(2);

    // Download buttons exist and are active for practice assets
    const downloadButtons = screen.getAllByRole('button', { name: /Download \/ Open/i });
    expect(downloadButtons.length).toBe(2);

    fireEvent.click(downloadButtons[0]);
    expect(mockOnDownload).toHaveBeenCalledWith(practiceFootage);

    fireEvent.click(downloadButtons[1]);
    expect(mockOnDownload).toHaveBeenCalledWith(projectTemplate);

    // Benchmark solution is locked with clear messaging
    expect(screen.getByText('Instructor Benchmark Solution Timeline.drp')).toBeInTheDocument();
    expect(screen.getByText('Solution / Benchmark (Locked)')).toBeInTheDocument();
    expect(
      screen.getByText(/Complete this lesson to unlock this reference solution file or benchmark project/i)
    ).toBeInTheDocument();
  });

  it('unlocks benchmark solution files when lesson is marked complete (completed = true)', () => {
    render(
      <ResourceList
        resources={[practiceFootage, projectTemplate, benchmarkSolution]}
        completed={true}
        onToggleComplete={mockOnToggleComplete}
        downloadingResourceId={null}
        onDownloadResource={mockOnDownload}
      />
    );

    // All three resources should now have download buttons
    const downloadButtons = screen.getAllByRole('button', { name: /Download \/ Open/i });
    expect(downloadButtons.length).toBe(3);

    // Solution shows the unlocked badge
    expect(screen.getByText('✓ Solution Unlocked')).toBeInTheDocument();

    fireEvent.click(downloadButtons[2]);
    expect(mockOnDownload).toHaveBeenCalledWith(benchmarkSolution);
  });
});

