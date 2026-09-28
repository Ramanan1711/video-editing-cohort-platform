import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../../pages/Home';
import { listCohorts } from '../../lib/courseService';

vi.mock('../../lib/courseService', () => ({
  listCohorts: vi.fn(),
}));

describe('Home Page (Public Landing Page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page, invokes listCohorts, and displays live published cohorts from database', async () => {
    const mockCohorts = [
      {
        id: 'cohort-uuid-1',
        name: 'Full-Stack Software Production Cohort (Batch 15)',
        description: 'Intensive 15-day engineering sprint building production SaaS with React 19 and Supabase.',
        status: 'published' as const,
        capacity: 30,
        visibility: 'public' as const,
      },
      {
        id: 'cohort-uuid-2',
        name: 'Creative Video & Kinetic Motion Cohort (Batch 15)',
        description: '15-day commercial video sprint covering kinetic captions, soundscapes, and color grading.',
        status: 'published' as const,
        capacity: 25,
        visibility: 'public' as const,
      },
    ];

    (listCohorts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCohorts);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Initial check for hero text
    expect(screen.getByText(/Stop Watching Tutorials/i)).toBeInTheDocument();

    // Verify listCohorts was invoked
    expect(listCohorts).toHaveBeenCalledTimes(1);

    // Wait for live cohorts to be rendered in the document
    await waitFor(() => {
      expect(
        screen.getByText('Full-Stack Software Production Cohort (Batch 15)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Creative Video & Kinetic Motion Cohort (Batch 15)')
      ).toBeInTheDocument();
    });

    // Verify substantiated methodology note is present
    expect(screen.getByText(/Methodology Note:/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Platform Operations/i)).toBeInTheDocument();
  });

  it('handles empty database cohort response gracefully with pre-registration fallback', async () => {
    (listCohorts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Next Sprint Cycle Opening Soon/i)).toBeInTheDocument();
    });
  });
});
