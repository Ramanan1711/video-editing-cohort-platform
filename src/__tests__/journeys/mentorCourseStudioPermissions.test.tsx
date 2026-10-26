import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminCourses from '../../pages/AdminCourses';
import * as useAuthModule from '../../context/useAuth';
import * as courseService from '../../lib/courseService';
import * as internshipService from '../../lib/internshipService';
import * as courseChallengeService from '../../lib/courseChallengeService';

vi.mock('../../context/useAuth');
vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockMentorProfile = {
  id: 'mentor-111',
  email: 'mentor@example.com',
  full_name: 'John Mentor',
  role: 'mentor' as const,
  admin_role: null,
  status: 'active',
};

const mockDraftCohort: courseService.Cohort = {
  id: 'cohort-draft-1',
  name: 'Premiere Pro Masterclass - Spring 2026',
  title: 'Premiere Pro Masterclass - Spring 2026',
  description: 'Overview of the learning objectives, deliverables, and expectations...',
  course_id: null,
  status: 'draft',
  capacity: 30,
  visibility: 'public',
  price_inr: 4999,
  currency: 'INR',
  enrollment_start: '2026-03-01T00:00:00.000Z',
  enrollment_end: '2026-03-15T00:00:00.000Z',
  review_feedback: null,
  created_by: 'mentor-111',
};

const mockPublishedCohort: courseService.Cohort = {
  id: 'cohort-published-1',
  name: 'Cybersecurity Masterclass',
  title: 'Cybersecurity Masterclass',
  description: 'A cybersecurity course teaches you how to protect computers.',
  course_id: null,
  status: 'published',
  capacity: 30,
  visibility: 'public',
  price_inr: 9999,
  currency: 'INR',
  enrollment_start: '2026-01-01T00:00:00.000Z',
  enrollment_end: '2026-01-15T00:00:00.000Z',
  review_feedback: null,
  created_by: 'mentor-111',
};

const mockModules: courseService.Module[] = [
  {
    id: 'mod-1',
    cohort_id: 'cohort-draft-1',
    course_id: null,
    title: 'Module 1: Introduction to Premiere Pro',
    description: 'Basics of cutting and sequencing',
    position: 1,
    status: 'draft',
    lessons: [],
  },
];

describe('Mentor Course Authoring Studio & Permission Gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'mentor-111', email: 'mentor@example.com' } as any,
      profile: mockMentorProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(courseService, 'listCohorts').mockResolvedValue([mockDraftCohort, mockPublishedCohort]);
    vi.spyOn(courseService, 'listCourses').mockResolvedValue([]);
    vi.spyOn(courseService, 'listModules').mockResolvedValue(mockModules);
    vi.spyOn(courseService, 'listAllAssignments').mockResolvedValue([]);
    vi.spyOn(courseService, 'listAllLessonResources').mockResolvedValue([]);
    vi.spyOn(internshipService, 'listDailyChallenges').mockResolvedValue([]);
    vi.spyOn(courseChallengeService, 'fetchCourseChallenges').mockResolvedValue([]);
  });

  it('allows mentor to access course studio and renders mentor branding and banner', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/courses']}>
        <AdminCourses />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mentor studio')).toBeInTheDocument();
      expect(screen.getByText('Course & Curriculum Authoring')).toBeInTheDocument();
      expect(screen.getByText('Course Author / Mentor')).toBeInTheDocument();
    });

    // Informative banner explaining draft workflow and permission gate
    expect(screen.getByText(/Mentor Course Authoring & Curriculum Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/ajayramanan17@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/ajayramanan4444@gmail.com/i)).toBeInTheDocument();
  });

  it('provides mentor with New Cohort modal containing all requested fields', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/courses']}>
        <AdminCourses />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('New Cohort').length).toBeGreaterThan(0);
    });

    // Click New Cohort button
    const newCohortButtons = screen.getAllByRole('button', { name: /New Cohort/i });
    fireEvent.click(newCohortButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText(/Cohort Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Cohort Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Master Course Container/i)).toBeInTheDocument();
      expect(screen.getByText(/Publish Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Visibility/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Capacity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Enrollment Fee \(INR ₹\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Enrollment Start/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Enrollment End/i)).toBeInTheDocument();
      expect(screen.getByText(/Administrator Review Feedback/i)).toBeInTheDocument();
    });
  });

  it('shows quick action "Submit for Review" for draft cohort and hides cohort delete button for mentors', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/courses']}>
        <AdminCourses />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Premiere Pro Masterclass - Spring 2026')).toBeInTheDocument();
    });

    // Mentor can submit draft for review
    expect(screen.getByRole('button', { name: /Submit for Review/i })).toBeInTheDocument();

    // Mentor cannot delete cohort (Trash2 icon on cohort header is hidden for non-admins)
    expect(screen.queryByRole('button', { name: /Delete Cohort/i })).not.toBeInTheDocument();
  });

  it('allows mentors to edit and add curriculum on published cohorts without locking banners', async () => {
    render(
      <MemoryRouter initialEntries={['/mentor/courses?cohortId=cohort-published-1']}>
        <AdminCourses />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cybersecurity Masterclass')).toBeInTheDocument();
    });

    // Does NOT display locking badges or lockout banners
    expect(screen.queryByTitle(/Published cohort is locked from editing without Super Admin permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Published & Live Cohort — Editing Locked/i)).not.toBeInTheDocument();

    // Mentor can edit published cohort and add modules
    expect(screen.getAllByRole('button', { name: /Edit Cohort/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Add Module/i }).length).toBeGreaterThan(0);
  });
});
