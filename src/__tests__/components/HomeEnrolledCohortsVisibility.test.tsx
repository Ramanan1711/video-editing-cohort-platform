import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Home } from '../../pages/Home';
import * as useAuthModule from '../../context/useAuth';
import * as courseService from '../../lib/courseService';

vi.mock('../../context/useAuth');
vi.mock('../../lib/courseService', async (importOriginal) => {
  const actual = await importOriginal<typeof courseService>();
  return {
    ...actual,
    listCohorts: vi.fn(),
    getUserEnrollments: vi.fn(),
  };
});

describe('Home Page - Enrolled User Cohort Visibility Rules', () => {
  const mock5Courses: courseService.Cohort[] = [
    {
      id: 'c1',
      name: 'Course 1 - Creative Video Editing',
      description: 'Master premiere pro and DaVinci resolve.',
      status: 'published',
      capacity: 30,
      visibility: 'public',
      course_id: 'course-1',
    },
    {
      id: 'c2',
      name: 'Course 2 - Kinetic Motion Design',
      description: 'Master After Effects typography and easing.',
      status: 'published',
      capacity: 30,
      visibility: 'public',
      course_id: 'course-2',
    },
    {
      id: 'c3',
      name: 'Course 3 - Soundscapes & Audio Design',
      description: 'Master sound mixing and foley art.',
      status: 'published',
      capacity: 30,
      visibility: 'public',
      course_id: 'course-3',
    },
    {
      id: 'c4',
      name: 'Course 4 - Commercial Color Grading',
      description: 'Master node workflows and HDR color spaces.',
      status: 'published',
      capacity: 30,
      visibility: 'public',
      course_id: 'course-4',
    },
    {
      id: 'c5',
      name: 'Course 5 - YouTube Retention Sprint',
      description: 'Master pacing, visual hooks, and narrative framing.',
      status: 'published',
      capacity: 30,
      visibility: 'public',
      course_id: 'course-5',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseService.listCohorts).mockResolvedValue(mock5Courses);
  });

  it('1. displays all 5 courses to logged-out unauthenticated visitors', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      expect(within(section).getByText('Course 1 - Creative Video Editing')).toBeInTheDocument();
      expect(within(section).getByText('Course 2 - Kinetic Motion Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 3 - Soundscapes & Audio Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 4 - Commercial Color Grading')).toBeInTheDocument();
      expect(within(section).getByText('Course 5 - YouTube Retention Sprint')).toBeInTheDocument();
    });
  });

  it('2. displays all 5 courses to newly registered users with 0 database enrollments', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'new-user-123', email: 'new@editor.com' } as unknown as User,
      profile: { id: 'new-user-123', email: 'new@editor.com', full_name: 'New Editor', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      expect(within(section).getByText('Course 1 - Creative Video Editing')).toBeInTheDocument();
      expect(within(section).getByText('Course 2 - Kinetic Motion Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 3 - Soundscapes & Audio Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 4 - Commercial Color Grading')).toBeInTheDocument();
      expect(within(section).getByText('Course 5 - YouTube Retention Sprint')).toBeInTheDocument();
    });
  });

  it('3. hides enrolled Course 1 and displays the remaining 4 courses when student is enrolled in 1 course', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-enrolled-1', email: 'student1@editor.com' } as unknown as User,
      profile: { id: 'student-enrolled-1', email: 'student1@editor.com', full_name: 'Student One', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockResolvedValue([
      { cohort_id: 'c1', status: 'enrolled' },
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      // Enrolled course 1 must NOT be shown in the available cohorts
      expect(within(section).queryByText('Course 1 - Creative Video Editing')).not.toBeInTheDocument();

      // Remaining 4 courses MUST be displayed
      expect(within(section).getByText('Course 2 - Kinetic Motion Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 3 - Soundscapes & Audio Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 4 - Commercial Color Grading')).toBeInTheDocument();
      expect(within(section).getByText('Course 5 - YouTube Retention Sprint')).toBeInTheDocument();
    });
  });

  it('4. hides enrolled Courses 1 & 2 and displays the remaining 3 courses when student is enrolled in 2 courses', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-enrolled-2', email: 'student2@editor.com' } as unknown as User,
      profile: { id: 'student-enrolled-2', email: 'student2@editor.com', full_name: 'Student Two', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockResolvedValue([
      { cohort_id: 'c1', status: 'enrolled' },
      { cohort_id: 'c2', status: 'active' },
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      // Enrolled courses 1 and 2 must NOT be displayed
      expect(within(section).queryByText('Course 1 - Creative Video Editing')).not.toBeInTheDocument();
      expect(within(section).queryByText('Course 2 - Kinetic Motion Design')).not.toBeInTheDocument();

      // Remaining 3 courses MUST be displayed
      expect(within(section).getByText('Course 3 - Soundscapes & Audio Design')).toBeInTheDocument();
      expect(within(section).getByText('Course 4 - Commercial Color Grading')).toBeInTheDocument();
      expect(within(section).getByText('Course 5 - YouTube Retention Sprint')).toBeInTheDocument();
    });
  });

  it('5. hides the entire Available Production Cohorts section when student is enrolled in all 5 courses', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-enrolled-all', email: 'superstudent@editor.com' } as unknown as User,
      profile: { id: 'student-enrolled-all', email: 'superstudent@editor.com', full_name: 'Super Student', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockResolvedValue([
      { cohort_id: 'c1', status: 'enrolled' },
      { cohort_id: 'c2', status: 'active' },
      { cohort_id: 'c3', status: 'completed' },
      { cohort_id: 'c4', status: 'enrolled' },
      { cohort_id: 'c5', status: 'active' },
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      // The Available Production Cohorts section MUST be hidden
      expect(screen.queryByTestId('active-cohorts-section')).not.toBeInTheDocument();
      // Hero CTA points to Student Dashboard
      expect(screen.getByText('Go to Student Dashboard')).toBeInTheDocument();
    });
  });

  it('6. handles database errors gracefully without incorrectly hiding available cohorts', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-err-test', email: 'err@editor.com' } as unknown as User,
      profile: { id: 'student-err-test', email: 'err@editor.com', full_name: 'Error Student', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockRejectedValue(new Error('PostgreSQL connection timeout'));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Must not falsely hide cohorts on database error
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      expect(within(section).getByText('Course 1 - Creative Video Editing')).toBeInTheDocument();
      expect(within(section).getByText('Course 2 - Kinetic Motion Design')).toBeInTheDocument();
    });
  });

  it('7. continues displaying a cohort if user enrollment is dropped', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-dropped', email: 'dropped@editor.com' } as unknown as User,
      profile: { id: 'student-dropped', email: 'dropped@editor.com', full_name: 'Dropped Student', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(courseService.getUserEnrollments).mockResolvedValue([
      { cohort_id: 'c1', status: 'dropped' },
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      const section = screen.getByTestId('active-cohorts-section');
      expect(section).toBeInTheDocument();
      // Dropped cohort is still available for re-enrollment
      expect(within(section).getByText('Course 1 - Creative Video Editing')).toBeInTheDocument();
      expect(within(section).getByText('Course 2 - Kinetic Motion Design')).toBeInTheDocument();
    });
  });
});
