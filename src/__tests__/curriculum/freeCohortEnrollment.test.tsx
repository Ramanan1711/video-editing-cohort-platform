import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrollmentPanel, CohortDiscoveryModal } from '../../components/StudentFlowPanels';
import * as courseService from '../../lib/courseService';
import * as paymentService from '../../lib/paymentService';
import * as cohortPersistence from '../../lib/cohortCheckoutPersistence';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('Free Workshops and Demo Sprints Enrollment (Issue 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('createEnrollment & enrollInCohort service logic', () => {
    it('directly enrolls student in free cohort (price_inr = 0) without requiring captured payment', async () => {
      // Mock cohort check to return price_inr = 0
      const mockSingleCohort = vi.fn().mockResolvedValue({
        data: { id: 'cohort-free-1', price_inr: 0 },
        error: null,
      });
      const mockSingleProfile = vi.fn().mockResolvedValue({
        data: { id: 'student-123', role: 'student' },
        error: null,
      });

      const mockRpc = vi.fn().mockResolvedValue({
        data: { status: 'enrolled' },
        error: null,
      });

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSingleCohort,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSingleProfile,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        // payments should NOT be queried for free cohorts
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      vi.spyOn(supabase, 'rpc').mockImplementation(mockRpc as unknown as typeof supabase.rpc);

      const result = await courseService.createEnrollment('student-123', 'cohort-free-1');

      expect(result).toBeDefined();
      expect(result.cohort_id).toBe('cohort-free-1');
      expect(result.user_id).toBe('student-123');
      expect(result.status).toBe('active');
      expect(mockRpc).toHaveBeenCalledWith('enroll_student_in_cohort', {
        p_cohort_id: 'cohort-free-1',
        p_student_id: 'student-123',
      });
    });

    it('rejects un-purchased enrollment when cohort is paid (price_inr = 4999)', async () => {
      const mockSingleCohort = vi.fn().mockResolvedValue({
        data: { id: 'cohort-paid-1', price_inr: 4999 },
        error: null,
      });
      const mockSingleProfile = vi.fn().mockResolvedValue({
        data: { id: 'student-123', role: 'student' },
        error: null,
      });
      const mockSinglePayment = vi.fn().mockResolvedValue({
        data: null, // No captured payment
        error: null,
      });

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSingleCohort,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSingleProfile,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: mockSinglePayment,
                  }),
                }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      await expect(courseService.createEnrollment('student-123', 'cohort-paid-1')).rejects.toThrow(
        /Payment required to enroll in this cohort/i
      );
    });
  });

  describe('EnrollmentPanel UI & interaction', () => {
    it('renders FREE badge and "Enroll for Free" button for zero-price cohorts', async () => {
      const freeCohort: courseService.Cohort = {
        id: 'free-workshop-1',
        name: 'Premiere Pro Speed Editing Masterclass',
        description: 'Free live introductory workshop',
        status: 'published',
        capacity: 100,
        price_inr: 0,
        currency: 'INR',
      };

      vi.spyOn(courseService, 'listAvailableCohorts').mockResolvedValue([freeCohort]);

      render(
        <EnrollmentPanel
          userId="student-123"
          userEmail="student@example.com"
          userName="Student Name"
          onEnrolled={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Premiere Pro Speed Editing Masterclass')).toBeInTheDocument();
      });

      expect(screen.getByText('FREE')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enroll for free/i })).toBeInTheDocument();
    });

    it('bypasses startCohortCheckout and directly enrolls when "Enroll for Free" is clicked', async () => {
      const freeCohort: courseService.Cohort = {
        id: 'free-workshop-1',
        name: 'Premiere Pro Speed Editing Masterclass',
        description: 'Free live introductory workshop',
        status: 'published',
        capacity: 100,
        price_inr: 0,
        currency: 'INR',
      };

      vi.spyOn(courseService, 'listAvailableCohorts').mockResolvedValue([freeCohort]);
      const createEnrollmentSpy = vi.spyOn(courseService, 'createEnrollment').mockResolvedValue({
        cohort_id: 'free-workshop-1',
        user_id: 'student-123',
        status: 'active',
      });
      const startCheckoutSpy = vi.spyOn(paymentService, 'startCohortCheckout');
      const markEnrolledSpy = vi.spyOn(cohortPersistence, 'markJustEnrolledCohort');
      const onEnrolledMock = vi.fn();

      render(
        <EnrollmentPanel
          userId="student-123"
          userEmail="student@example.com"
          userName="Student Name"
          onEnrolled={onEnrolledMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enroll for free/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enroll for free/i }));

      await waitFor(() => {
        expect(createEnrollmentSpy).toHaveBeenCalledWith('student-123', 'free-workshop-1');
      });

      expect(startCheckoutSpy).not.toHaveBeenCalled();
      expect(markEnrolledSpy).toHaveBeenCalledWith('free-workshop-1', 'Premiere Pro Speed Editing Masterclass');
      expect(onEnrolledMock).toHaveBeenCalled();
    });
  });

  describe('CohortDiscoveryModal UI & interaction', () => {
    it('bypasses checkout and directly enrolls into free cohort in discovery modal', async () => {
      const freeCohort: courseService.Cohort = {
        id: 'free-workshop-2',
        name: 'DaVinci Resolve Color Sprint (Free Demo)',
        description: 'Demo sprint for color grading',
        status: 'published',
        capacity: 50,
        price_inr: 0,
        currency: 'INR',
      };

      vi.spyOn(courseService, 'listAllStudentCohorts').mockResolvedValue([
        { ...freeCohort, isEnrolled: false },
      ]);
      const createEnrollmentSpy = vi.spyOn(courseService, 'createEnrollment').mockResolvedValue({
        cohort_id: 'free-workshop-2',
        user_id: 'student-123',
        status: 'active',
      });
      const startCheckoutSpy = vi.spyOn(paymentService, 'startCohortCheckout');
      const onSelectCohortMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <CohortDiscoveryModal
          isOpen={true}
          onClose={onCloseMock}
          userId="student-123"
          onSelectCohort={onSelectCohortMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DaVinci Resolve Color Sprint (Free Demo)')).toBeInTheDocument();
      });

      expect(screen.getByText('FREE')).toBeInTheDocument();
      const enrollBtn = screen.getByRole('button', { name: /enroll for free/i });
      expect(enrollBtn).toBeInTheDocument();

      fireEvent.click(enrollBtn);

      await waitFor(() => {
        expect(createEnrollmentSpy).toHaveBeenCalledWith('student-123', 'free-workshop-2');
      });

      expect(startCheckoutSpy).not.toHaveBeenCalled();
      expect(onSelectCohortMock).toHaveBeenCalledWith('free-workshop-2');
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});

