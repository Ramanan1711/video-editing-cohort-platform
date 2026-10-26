import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  mentorCreateCohort,
  adminReviewCohort,
  mentorPublishCohort,
  listMentorCohorts,
  type Cohort,
} from '../../lib/services/curriculumService';
import { MentorCreateCohortModal } from '../../components/mentor/MentorCreateCohortModal';
import { MentorDashboard } from '../../pages/MentorDashboard';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'mentor-uid-101', email: 'mentor@iunoware.com' },
    profile: {
      id: 'mentor-uid-101',
      full_name: 'Lead Mentor Dave',
      role: 'mentor',
      admin_role: null,
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/mentorService', () => ({
  getMentorDashboardStats: vi.fn().mockResolvedValue({
    pendingCount: 2,
    warningCount: 0,
    overdueCount: 0,
    reviewedCount: 5,
    resubmitCount: 1,
    assignedCohorts: [{ id: 'cohort-1', name: 'Existing Cohort' }],
    cohortSummaries: [],
    skillDistribution: {
      storytelling: 4,
      pacing: 4,
      audio: 4,
      color: 4,
      technical: 4,
      overall_average: 4,
      lowest_skill_area: 'None',
      total_graded_reviews: 5,
    },
    attentionStudentsCount: 0,
    attentionStudents: [],
    avgResponseHours: 12,
    assignmentWorkload: [],
    recentReviews: [],
  }),
  listMentorOfficeHours: vi.fn().mockResolvedValue([]),
  createMentorOfficeHour: vi.fn(),
  deleteMentorOfficeHour: vi.fn(),
}));

describe('Mentor Cohort Creation, Admin Review & Mentor Publishing Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Curriculum Service: Mentor & Admin Operations', () => {
    it('creates a new cohort in strict draft state for the mentor', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'mentor-uid-101' } as any },
        error: null,
      });

      const mockCreatedCohort: Cohort = {
        id: 'new-cohort-abc',
        name: 'Premiere Pro Cinematic Mastery',
        title: 'Premiere Pro Cinematic Mastery',
        description: 'Advanced cohort for video editing mastery',
        status: 'draft',
        duration_days: 21,
        price_inr: 5999,
        track_type: 'non_coding',
        created_by: 'mentor-uid-101',
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockCreatedCohort,
        error: null,
      } as any);

      const result = await mentorCreateCohort({
        name: 'Premiere Pro Cinematic Mastery',
        description: 'Advanced cohort for video editing mastery',
        duration_days: 21,
        price_inr: 5999,
        track_type: 'non_coding',
      });

      expect(result.id).toBe('new-cohort-abc');
      expect(result.status).toBe('draft');
      expect(result.name).toBe('Premiere Pro Cinematic Mastery');
    });

    it('allows administrators to review and transition cohort status (reviewing, approved, rejected)', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'admin-uid-1' } as any },
        error: null,
      });

      vi.spyOn(supabase, 'rpc').mockImplementation(async (method, params: any) => {
        if (method === 'admin_review_cohort') {
          return {
            data: {
              id: params.p_cohort_id,
              status: params.p_decision,
              review_feedback: params.p_feedback ?? null,
              title: 'Test Cohort',
              name: 'Test Cohort',
            },
            error: null,
          } as any;
        }
        return { data: null, error: null } as any;
      });

      // 1. Mark In Review
      const underReview = await adminReviewCohort('cohort-xyz', 'reviewing');
      expect(underReview.status).toBe('reviewing');

      // 2. Reject with feedback
      const rejected = await adminReviewCohort('cohort-xyz', 'rejected', 'Please extend duration to 30 days');
      expect(rejected.status).toBe('rejected');
      expect(rejected.review_feedback).toBe('Please extend duration to 30 days');

      // 3. Approve
      const approved = await adminReviewCohort('cohort-xyz', 'approved', 'Looks great! Approved for launch.');
      expect(approved.status).toBe('approved');
    });

    it('enforces that mentors CANNOT publish cohorts when status is draft, reviewing, or rejected', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'Cohort must be approved by an administrator before publishing (current status: draft).', code: 'P0001' } as any,
      });

      await expect(mentorPublishCohort('draft-cohort-id')).rejects.toThrow(
        /Cohort must be approved/i
      );
    });

    it('allows mentors to publish ONLY when status is approved', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          id: 'approved-cohort-id',
          name: 'Motion Design Bootcamp',
          title: 'Motion Design Bootcamp',
          status: 'published',
        },
        error: null,
      } as any);

      const published = await mentorPublishCohort('approved-cohort-id');
      expect(published.status).toBe('published');
    });
  });

  describe('MentorCreateCohortModal UI Component', () => {
    it('renders the modal with inputs and creates draft cohort on submission', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'mentor-uid-101' } as any },
        error: null,
      });

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          id: 'cohort-modal-created',
          name: 'Color Grading Masterclass',
          title: 'Color Grading Masterclass',
          description: 'Deep dive into DaVinci Resolve',
          status: 'draft',
          duration_days: 15,
          price_inr: 4999,
          track_type: 'non_coding',
        },
        error: null,
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

      expect(screen.getByText('Propose New Cohort')).toBeInTheDocument();
      expect(screen.getByText(/Your cohort will be created in/i)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Cinematic Color Grading/i), {
        target: { value: 'Color Grading Masterclass' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Provide a concise syllabus breakdown/i), {
        target: { value: 'Deep dive into DaVinci Resolve' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Draft Cohort/i }));

      await waitFor(() => {
        expect(onCohortCreated).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'cohort-modal-created',
            status: 'draft',
          })
        );
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MentorDashboard Cohorts Section & Status Reflection', () => {
    it('displays mentor cohorts with accurate statuses, feedback, and action buttons', async () => {
      const mockMentorCohorts: Cohort[] = [
        {
          id: 'c-draft',
          name: 'Draft Proposal Cohort',
          title: 'Draft Proposal Cohort',
          description: 'A cohort currently being drafted',
          status: 'draft',
          duration_days: 15,
          price_inr: 4999,
          track_type: 'general',
        },
        {
          id: 'c-reviewing',
          name: 'In Review Cohort',
          title: 'In Review Cohort',
          description: 'Under administrator review',
          status: 'reviewing',
          duration_days: 20,
          price_inr: 4999,
          track_type: 'non_coding',
        },
        {
          id: 'c-approved',
          name: 'Approved Cohort',
          title: 'Approved Cohort',
          description: 'Ready to be published by mentor',
          status: 'approved',
          duration_days: 30,
          price_inr: 7999,
          track_type: 'coding',
        },
        {
          id: 'c-rejected',
          name: 'Rejected Proposal Cohort',
          title: 'Rejected Proposal Cohort',
          description: 'Needs modifications',
          status: 'rejected',
          review_feedback: 'Please reduce cohort pricing to ₹3,999 for first launch.',
          duration_days: 10,
          price_inr: 9999,
          track_type: 'general',
        },
      ];

      // Mock listMentorCohorts query responses
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockMentorCohorts,
              error: null,
            }),
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          } as any;
        }
        if (table === 'mentor_cohorts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      });

      render(
        <MemoryRouter>
          <MentorDashboard />
        </MemoryRouter>
      );

      // Verify header button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Propose New Cohort/i })).toBeInTheDocument();
      });

      // Verify the Cohort Proposals section is rendered
      expect(screen.getByText('My Cohort Proposals & Approvals')).toBeInTheDocument();

      // Verify the 4 cohorts render with their respective badges
      expect(screen.getByText('Draft Proposal Cohort')).toBeInTheDocument();
      expect(screen.getByText('○ Draft')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit for Review/i })).toBeInTheDocument();

      expect(screen.getByText('In Review Cohort')).toBeInTheDocument();
      expect(screen.getByText('◐ In Review')).toBeInTheDocument();
      expect(screen.getByText('Under Administrator Review')).toBeInTheDocument();

      expect(screen.getByText('Approved Cohort')).toBeInTheDocument();
      expect(screen.getByText('✓ Approved')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Publish Cohort/i })).toBeInTheDocument();

      expect(screen.getByText('Rejected Proposal Cohort')).toBeInTheDocument();
      expect(screen.getByText('✕ Rejected')).toBeInTheDocument();
      expect(screen.getByText(/Please reduce cohort pricing to ₹3,999/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Revise Proposal/i })).toBeInTheDocument();
    });
  });
});

