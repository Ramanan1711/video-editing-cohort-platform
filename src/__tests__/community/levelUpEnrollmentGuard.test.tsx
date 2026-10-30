import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LevelUpModal } from '../../components/community/LevelUpModal';
import { LevelUpView } from '../../components/community/LevelUpView';
import * as useAuthModule from '../../context/useAuth';
import * as studentAccessService from '../../lib/studentAccessService';
import * as gamificationService from '../../lib/gamificationService';

vi.mock('../../context/useAuth');
vi.mock('../../lib/studentAccessService');
vi.mock('../../lib/gamificationService');

describe('Level UP Enrollment Guard', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(gamificationService, 'fetchAvailableCourses').mockResolvedValue([
      { id: 'course-1', title: 'Premiere Pro Mastery' },
    ]);
    vi.spyOn(gamificationService, 'fetchUserEnrolledCourses').mockResolvedValue([]);
    vi.spyOn(gamificationService, 'fetchUserEnrolledCohort').mockResolvedValue(null);
    vi.spyOn(gamificationService, 'fetchEnrolledLeaderboard').mockResolvedValue([]);
    vi.spyOn(gamificationService, 'fetchUserProHistory').mockResolvedValue([]);
  });

  describe('LevelUpModal', () => {
    it('renders Cohort Enrollment Required paywall when registered student is not enrolled', async () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'unenrolled-student', email: 'unenrolled@cutcraft.test' },
        profile: { id: 'unenrolled-student', email: 'unenrolled@cutcraft.test', role: 'student', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      vi.spyOn(studentAccessService, 'checkStudentLoginAccess').mockResolvedValue({
        hasAccess: true,
        isEnrolled: false,
        courseEndDate: null,
        accessExpiryDate: null,
        formattedCourseEndDate: null,
        formattedAccessExpiryDate: null,
      });

      render(
        <MemoryRouter>
          <LevelUpModal isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      );

      expect(await screen.findByText('Cohort Enrollment Required')).toBeInTheDocument();
      expect(screen.getByText('Registered (Unenrolled)')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Explore Cohorts & Enroll/i })).toBeInTheDocument();
      expect(screen.queryByText('PRO LEADERBOARD')).not.toBeInTheDocument();
    });

    it('renders regular leaderboard when student is enrolled in a course', async () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'enrolled-student', email: 'enrolled@cutcraft.test' },
        profile: { id: 'enrolled-student', email: 'enrolled@cutcraft.test', role: 'student', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      vi.spyOn(studentAccessService, 'checkStudentLoginAccess').mockResolvedValue({
        hasAccess: true,
        isEnrolled: true,
        courseEndDate: '2026-12-31T00:00:00.000Z',
        accessExpiryDate: '2027-02-28T00:00:00.000Z',
        formattedCourseEndDate: '31 Dec 2026',
        formattedAccessExpiryDate: '28 Feb 2027',
      });

      vi.spyOn(gamificationService, 'fetchUserEnrolledCourses').mockResolvedValue([
        { id: 'course-1', title: 'Premiere Pro Mastery' },
      ]);

      render(
        <MemoryRouter>
          <LevelUpModal isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      );

      expect(await screen.findByText('PRO LEADERBOARD')).toBeInTheDocument();
      expect(screen.queryByText('Cohort Enrollment Required')).not.toBeInTheDocument();
    });
  });

  describe('LevelUpView', () => {
    it('renders Cohort Enrollment Required paywall when registered student is not enrolled', async () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'unenrolled-student', email: 'unenrolled@cutcraft.test' },
        profile: { id: 'unenrolled-student', email: 'unenrolled@cutcraft.test', role: 'student', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      vi.spyOn(studentAccessService, 'checkStudentLoginAccess').mockResolvedValue({
        hasAccess: true,
        isEnrolled: false,
        courseEndDate: null,
        accessExpiryDate: null,
        formattedCourseEndDate: null,
        formattedAccessExpiryDate: null,
      });

      render(
        <MemoryRouter>
          <LevelUpView />
        </MemoryRouter>
      );

      expect(await screen.findByText('Cohort Enrollment Required')).toBeInTheDocument();
      expect(screen.getByText('Registered (Unenrolled)')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Explore Cohorts & Enroll/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Go to Student Dashboard/i })).toBeInTheDocument();
    });

    it('renders Level Up workspace when mentor or admin accesses it without enrollment check blockage', async () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'mentor-1', email: 'mentor@cutcraft.test' },
        profile: { id: 'mentor-1', email: 'mentor@cutcraft.test', role: 'mentor', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      render(
        <MemoryRouter>
          <LevelUpView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Cohort Enrollment Required')).not.toBeInTheDocument();
      });
    });
  });
});

