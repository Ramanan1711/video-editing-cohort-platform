import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MentorDashboard } from '../../pages/MentorDashboard';

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'usr-mentor-1', email: 'mentor@test.com' },
    profile: {
      id: 'usr-mentor-1',
      role: 'mentor',
      full_name: 'Lead Mentor',
      avatar_url: null,
      admin_role: null,
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/services/curriculumService', () => ({
  listMentorCohorts: vi.fn().mockResolvedValue([]),
  updateCohort: vi.fn(),
  mentorPublishCohort: vi.fn(),
}));

vi.mock('../../lib/mentorService', () => ({
  getMentorDashboardStats: vi.fn().mockResolvedValue({
    pendingCount: 10,
    warningCount: 3,
    overdueCount: 2,
    reviewedCount: 25,
    resubmitCount: 4,
    assignedCohorts: [{ id: 'cohort-1', name: 'Autumn Batch' }],
    cohortSummaries: [],
    skillDistribution: {
      storytelling: 4.2,
      pacing: 3.8,
      audio: 4.5,
      color: 3.2,
      technical: 4.0,
      overall_average: 3.9,
      lowest_skill_area: 'Color Grade & Match',
      total_graded_reviews: 12,
    },
    attentionStudentsCount: 1,
    attentionStudents: [
      {
        student_id: 'st-1',
        student_name: 'Sarah Connor',
        cohort_id: 'cohort-1',
        cohort_name: 'Autumn Batch',
        progress_pct: 35,
        resubmission_count: 3,
        attention_reasons: ['Multiple revisions required', 'Behind cohort pace'],
      },
    ],
    avgResponseHours: 14,
    assignmentWorkload: [],
    recentReviews: [],
  }),
  listMentorOfficeHours: vi.fn().mockResolvedValue([]),
  listMentorCohorts: vi.fn().mockResolvedValue([]),
  createMentorOfficeHour: vi.fn(),
  deleteMentorOfficeHour: vi.fn(),
}));

vi.mock('../../lib/notificationService', () => ({
  listUserNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(true),
  markAllNotificationsRead: vi.fn().mockResolvedValue(true),
  subscribeToUserNotifications: vi.fn().mockReturnValue(() => {}),
}));

describe('MentorDashboard Responsiveness & Dark Mode Polish', () => {
  it('renders Review SLA Aging cards and threshold pills with dark mode tokens', async () => {
    render(
      <MemoryRouter>
        <MentorDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fresh Submissions')).toBeInTheDocument();
    });

    const freshBadge = screen.getByText('< 12 Hours');
    expect(freshBadge).toBeInTheDocument();
    expect(freshBadge.className).toContain('dark:border-emerald-500/30');
    expect(freshBadge.className).toContain('dark:bg-emerald-950/60');
    expect(freshBadge.className).toContain('dark:text-emerald-300');

    const warningBadge = screen.getByText('12 - 24 Hours');
    expect(warningBadge).toBeInTheDocument();
    expect(warningBadge.className).toContain('dark:border-amber-500/30');
    expect(warningBadge.className).toContain('dark:bg-amber-950/60');
    expect(warningBadge.className).toContain('dark:text-amber-300');

    const overdueBadge = screen.getByText('> 24 Hours');
    expect(overdueBadge).toBeInTheDocument();
    expect(overdueBadge.className).toContain('dark:border-red-500/30');
    expect(overdueBadge.className).toContain('dark:bg-red-950/60');
    expect(overdueBadge.className).toContain('dark:text-red-300');
  });

  it('renders Cohort Student Skill Distribution with responsive multi-breakpoint grid and truncation', async () => {
    render(
      <MemoryRouter>
        <MentorDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cohort Student Skill Distribution')).toBeInTheDocument();
    });

    const skillTitle = screen.getByText('Storytelling & Arc');
    expect(skillTitle).toBeInTheDocument();
    expect(skillTitle.className).toContain('truncate');
    expect(skillTitle.className).toContain('min-w-0');

    // Find the parent grid container
    const gridContainer = skillTitle.closest('.grid');
    expect(gridContainer).not.toBeNull();
    expect(gridContainer?.className).toContain('sm:grid-cols-2');
    expect(gridContainer?.className).toContain('md:grid-cols-3');
    expect(gridContainer?.className).toContain('xl:grid-cols-5');
  });

  it('renders Student Performance Alerts icon with dark mode tokens', async () => {
    render(
      <MemoryRouter>
        <MentorDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Student Performance Alerts/)).toBeInTheDocument();
    });

    const studentName = screen.getByText('Sarah Connor');
    expect(studentName).toBeInTheDocument();

    const reasonBadge = screen.getByText('Multiple revisions required');
    expect(reasonBadge).toBeInTheDocument();
    expect(reasonBadge.className).toContain('dark:border-amber-500/30');
    expect(reasonBadge.className).toContain('dark:bg-amber-950/40');
    expect(reasonBadge.className).toContain('dark:text-amber-300');
  });
});
