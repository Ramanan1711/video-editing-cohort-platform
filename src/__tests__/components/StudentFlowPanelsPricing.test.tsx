import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CohortDiscoveryModal, EnrollmentPanel } from '../../components/StudentFlowPanels';
import * as courseService from '../../lib/courseService';
import * as paymentService from '../../lib/paymentService';

vi.mock('../../lib/paymentService', async () => {
  const actual = await vi.importActual('../../lib/paymentService');
  return {
    ...actual,
    startCohortCheckout: vi.fn(),
  };
});

vi.mock('../../lib/courseService', async () => {
  const actual = await vi.importActual('../../lib/courseService');
  return {
    ...actual,
    listAllStudentCohorts: vi.fn(),
    listAvailableCohorts: vi.fn(),
  };
});

describe('StudentFlowPanels - Actual Cohort Pricing Display & Checkout', () => {
  const mockCohorts = [
    {
      id: 'cohort-starter',
      name: 'Starter Editing Sprint',
      title: 'Starter Editing Sprint',
      description: 'Foundations of premiere and cutcraft',
      status: 'published' as const,
      price_inr: 1499,
      currency: 'INR',
      isEnrolled: false,
    },
    {
      id: 'cohort-pro',
      name: 'Pro Color Grading Bootcamp',
      title: 'Pro Color Grading Bootcamp',
      description: 'Advanced DaVinci color theory',
      status: 'published' as const,
      price_inr: 2999,
      currency: 'INR',
      isEnrolled: false,
    },
    {
      id: 'cohort-mastery',
      name: 'VFX & 3D Masterclass',
      title: 'VFX & 3D Masterclass',
      description: 'After Effects & Blender mastery',
      status: 'published' as const,
      price_inr: 8999,
      currency: 'INR',
      isEnrolled: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CohortDiscoveryModal', () => {
    it('displays the actual distinct prices for each course rather than defaulting to 4,999', async () => {
      vi.mocked(courseService.listAllStudentCohorts).mockResolvedValue(mockCohorts);

      render(
        <CohortDiscoveryModal
          userId="student-1"
          userEmail="student@example.com"
          userName="Alice"
          isOpen={true}
          onClose={vi.fn()}
          onSelectCohort={vi.fn()}
        />
      );

      // Verify that actual prices are displayed for each cohort
      await waitFor(() => {
        expect(screen.getByText('Starter Editing Sprint')).toBeInTheDocument();
        expect(screen.getByText('Pro Color Grading Bootcamp')).toBeInTheDocument();
        expect(screen.getByText('VFX & 3D Masterclass')).toBeInTheDocument();
      });

      // Check badges for actual prices
      expect(screen.getByText('₹1,499 INR')).toBeInTheDocument();
      expect(screen.getByText('₹2,999 INR')).toBeInTheDocument();
      expect(screen.getByText('₹8,999 INR')).toBeInTheDocument();

      // Check Enroll buttons for actual prices
      expect(screen.getByRole('button', { name: /Enroll \(₹1,499 INR\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enroll \(₹2,999 INR\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enroll \(₹8,999 INR\)/i })).toBeInTheDocument();

      // Ensure 4,999 is NOT shown
      expect(screen.queryByText(/4,999/)).not.toBeInTheDocument();
    });

    it('triggers checkout with the selected cohort name and details', async () => {
      vi.mocked(courseService.listAllStudentCohorts).mockResolvedValue(mockCohorts);

      render(
        <CohortDiscoveryModal
          userId="student-1"
          userEmail="student@example.com"
          userName="Alice"
          isOpen={true}
          onClose={vi.fn()}
          onSelectCohort={vi.fn()}
        />
      );

      const proEnrollBtn = await screen.findByRole('button', { name: /Enroll \(₹2,999 INR\)/i });
      fireEvent.click(proEnrollBtn);

      expect(paymentService.startCohortCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          cohortId: 'cohort-pro',
          cohortName: 'Pro Color Grading Bootcamp',
          userEmail: 'student@example.com',
          userName: 'Alice',
        })
      );
    });
  });

  describe('EnrollmentPanel', () => {
    it('displays the actual distinct price on each available cohort option and checkout CTA', async () => {
      vi.mocked(courseService.listAvailableCohorts).mockResolvedValue(mockCohorts);

      render(
        <EnrollmentPanel
          userId="student-1"
          userEmail="student@example.com"
          userName="Alice"
          onEnrolled={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Starter Editing Sprint')).toBeInTheDocument();
      });

      // Price badges
      expect(screen.getByText('₹1,499 INR')).toBeInTheDocument();
      expect(screen.getByText('₹2,999 INR')).toBeInTheDocument();
      expect(screen.getByText('₹8,999 INR')).toBeInTheDocument();

      // Initial checkout button for first selected cohort (Starter: 1,499)
      expect(screen.getByRole('button', { name: /Proceed to Checkout \(₹1,499 INR\)/i })).toBeInTheDocument();

      // Click second cohort (Pro: 2,999)
      fireEvent.click(screen.getByText('Pro Color Grading Bootcamp'));

      expect(screen.getByRole('button', { name: /Proceed to Checkout \(₹2,999 INR\)/i })).toBeInTheDocument();
    });
  });
});

