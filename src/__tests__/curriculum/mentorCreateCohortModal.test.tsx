import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MentorCreateCohortModal } from '../../components/mentor/MentorCreateCohortModal';
import * as curriculumService from '../../lib/services/curriculumService';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('MentorCreateCohortModal Schedule & Duration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders duration and course start/end date inputs', () => {
    render(
      <MentorCreateCohortModal
        isOpen={true}
        onClose={vi.fn()}
        onCohortCreated={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Duration \(Days\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Course Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Course End Date/i)).toBeInTheDocument();
  });

  it('auto-calculates end date when start date and duration are entered', () => {
    render(
      <MentorCreateCohortModal
        isOpen={true}
        onClose={vi.fn()}
        onCohortCreated={vi.fn()}
      />
    );

    const startDateInput = screen.getByLabelText(/Course Start Date/i) as HTMLInputElement;
    const endDateInput = screen.getByLabelText(/Course End Date/i) as HTMLInputElement;

    // Set start date to 2026-11-01 (default duration is 15 days)
    fireEvent.change(startDateInput, { target: { value: '2026-11-01' } });

    // 15 days from Nov 1 is Nov 15 (inclusive, i.e. Nov 1 + 14 days)
    expect(endDateInput.value).toBe('2026-11-15');
  });

  it('prevents submission when course end date is earlier than start date', async () => {
    render(
      <MentorCreateCohortModal
        isOpen={true}
        onClose={vi.fn()}
        onCohortCreated={vi.fn()}
      />
    );

    const titleInput = screen.getByPlaceholderText(/e\.g\. Cinematic Color Grading/i);
    fireEvent.change(titleInput, { target: { value: 'Test Cohort' } });

    const startDateInput = screen.getByLabelText(/Course Start Date/i);
    const endDateInput = screen.getByLabelText(/Course End Date/i);

    fireEvent.change(startDateInput, { target: { value: '2026-11-10' } });
    fireEvent.change(endDateInput, { target: { value: '2026-11-05' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Draft Cohort/i }));

    await waitFor(() => {
      expect(screen.getByText(/Course end date cannot be earlier than course start date\./i)).toBeInTheDocument();
    });
  });

  it('submits valid cohort with start_date and end_date', async () => {
    const mentorCreateCohortSpy = vi.spyOn(curriculumService, 'mentorCreateCohort').mockResolvedValue({
      id: 'cohort-123',
      name: 'Test Cohort',
      title: 'Test Cohort',
      status: 'draft',
      duration_days: 15,
      start_date: '2026-11-01T00:00:00.000Z',
      end_date: '2026-11-15T23:59:59.000Z',
      price_inr: 4999,
      capacity: 30,
      visibility: 'public',
    } as any);

    const onCohortCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <MentorCreateCohortModal
        isOpen={true}
        onClose={onClose}
        onCohortCreated={onCohortCreated}
      />
    );

    const titleInput = screen.getByPlaceholderText(/e\.g\. Cinematic Color Grading/i);
    fireEvent.change(titleInput, { target: { value: 'Test Cohort' } });

    const startDateInput = screen.getByLabelText(/Course Start Date/i);
    fireEvent.change(startDateInput, { target: { value: '2026-11-01' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Draft Cohort/i }));

    await waitFor(() => {
      expect(mentorCreateCohortSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Cohort',
          duration_days: 15,
          start_date: '2026-11-01T00:00:00.000Z',
          end_date: '2026-11-15T23:59:59.000Z',
        })
      );
      expect(onCohortCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

