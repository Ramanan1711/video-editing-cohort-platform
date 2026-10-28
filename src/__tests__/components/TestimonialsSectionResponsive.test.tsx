import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestimonialsSection } from '../../components/home/sections/TestimonialsSection';

// Mock soundFx to prevent audio errors in jsdom
vi.mock('../../lib/soundFx', () => ({
  soundFx: {
    playBlip: vi.fn(),
    playSweep: vi.fn(),
  },
}));

describe('TestimonialsSection (Responsive Mobile & Tablet View)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the selected production deliverables section header and tabs', () => {
    render(<TestimonialsSection />);

    expect(
      screen.getByText('Selected Production Proof-of-Work')
    ).toBeInTheDocument();

    // Verify all deliverable filter tabs exist
    expect(screen.getByText('Kinetic Motion')).toBeInTheDocument();
    expect(screen.getByText('Audio Engineering')).toBeInTheDocument();
    expect(screen.getByText('Color Grading')).toBeInTheDocument();
    expect(screen.getByText('Commercial Pacing')).toBeInTheDocument();
  });

  it('renders the mobile/tablet snap carousel region with accessible label', () => {
    render(<TestimonialsSection />);

    const carousel = screen.getByRole('list', {
      name: /production deliverables carousel/i,
    });
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveClass('lg:hidden');
  });

  it('renders navigation controls and indicator counters accessible on all viewports', () => {
    render(<TestimonialsSection />);

    const prevButtons = screen.getAllByRole('button', {
      name: /previous deliverable/i,
    });
    const nextButtons = screen.getAllByRole('button', {
      name: /next deliverable/i,
    });

    expect(prevButtons.length).toBeGreaterThanOrEqual(1);
    expect(nextButtons.length).toBeGreaterThanOrEqual(1);

    // Initial counter: 01 / 04
    expect(screen.getAllByText(/01 \/ 04/).length).toBeGreaterThanOrEqual(1);

    // Clicking Next updates counter to 02 / 04
    fireEvent.click(nextButtons[0]);
    expect(screen.getAllByText(/02 \/ 04/).length).toBeGreaterThanOrEqual(1);

    // Clicking Prev wraps back to 01 / 04
    fireEvent.click(prevButtons[0]);
    expect(screen.getAllByText(/01 \/ 04/).length).toBeGreaterThanOrEqual(1);
  });

  it('switches active deliverable when clicking quick-select filter tabs and dots', () => {
    render(<TestimonialsSection />);

    const colorGradingTab = screen.getByText('Color Grading');
    fireEvent.click(colorGradingTab);

    // Counter updates to 03 / 04
    expect(screen.getAllByText(/03 \/ 04/).length).toBeGreaterThanOrEqual(1);

    // Clicking dot 4 jumps to deliverable 4
    const dot4 = screen.getByLabelText('Go to deliverable 4');
    fireEvent.click(dot4);
    expect(screen.getAllByText(/04 \/ 04/).length).toBeGreaterThanOrEqual(1);
  });

  it('opens DeliverableInspectorModal on mobile/tablet card click and closes on dismiss', () => {
    render(<TestimonialsSection />);

    // Click on inspect trigger for the first deliverable
    const inspectLinks = screen.getAllByRole('link', {
      name: /cinematic pacing & kinetic title sequence/i,
    });
    expect(inspectLinks.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(inspectLinks[0]);

    // Modal dialog should open with title and senior mentor score
    const modalTitle = screen.getByRole('heading', {
      name: /cinematic pacing & kinetic title sequence/i,
    });
    expect(modalTitle).toBeInTheDocument();
    expect(screen.getByText('Senior Mentor Audit Score')).toBeInTheDocument();
    expect(screen.getByText('99% RUBRIC MATCH')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);

    expect(modalTitle).not.toBeInTheDocument();
  });

  it('renders verified credential section with mobile-optimized tilt certificate and wall of love', () => {
    render(<TestimonialsSection />);

    expect(
      screen.getByText('A Verifiable Credential That Employers Actually Respect.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Certificate of Internship Completion')
    ).toBeInTheDocument();
    expect(screen.getByText('PCH-2026-VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('✓ Cryptographically Signed')).toBeInTheDocument();

    // Wall of love testimonials
    expect(screen.getByText('Pooja S.')).toBeInTheDocument();
    expect(screen.getByText('Rahul K.')).toBeInTheDocument();
  });
});

