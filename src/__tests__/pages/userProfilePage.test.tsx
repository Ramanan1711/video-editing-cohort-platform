import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserProfile } from '../../pages/UserProfile';
import * as useAuthModule from '../../context/useAuth';
import * as useToastModule from '../../context/useToast';
import * as userProfileServiceModule from '../../lib/userProfileService';

vi.mock('../../context/useAuth');
vi.mock('../../context/useToast');
vi.mock('../../lib/userProfileService');

describe('UserProfile Page Component (Dedicated Student Profile Area)', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  const mockOverviewData: userProfileServiceModule.UserProfileOverview = {
    user: {
      id: 'student-42',
      email: 'alex@example.com',
      fullName: 'Alex Morgan',
      role: 'student',
      status: 'active',
      whatsappNumber: '+91 98765 00000',
      createdAt: '2026-08-15T00:00:00Z',
    },
    stats: {
      enrolledCount: 2,
      totalFeePaidInr: 9998,
      attendanceRatePct: 90,
      completedCoursesCount: 0,
    },
    enrolledCourses: [
      {
        cohortId: 'cohort-java-id',
        cohortTitle: 'JAVA Masterclass Cohort',
        courseTitle: 'Fullstack Java & Microservices',
        status: 'active',
        enrolledAt: '2026-08-20T00:00:00Z',
        priceInr: 4999,
        currency: 'INR',
        progressPercent: 50,
        totalLessons: 10,
        completedLessons: 5,
        platform: 'ProCut Hub',
      },
      {
        cohortId: 'cohort-python-id',
        cohortTitle: 'PYTHON AI Sprint',
        courseTitle: 'Python Data Science & Automation',
        status: 'active',
        enrolledAt: '2026-09-01T00:00:00Z',
        priceInr: 4999,
        currency: 'INR',
        progressPercent: 20,
        totalLessons: 10,
        completedLessons: 2,
        platform: 'ProCut Hub',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        orderId: 'order_java_101',
        paymentId: 'pay_rzp_java',
        cohortId: 'cohort-java-id',
        cohortTitle: 'JAVA Masterclass Cohort',
        amountInr: 4999,
        currency: 'INR',
        status: 'captured',
        paidAt: '2026-08-20T00:00:00Z',
        receipt: 'rcpt_01',
        provider: 'razorpay',
      },
      {
        id: 'pay-2',
        orderId: 'order_py_202',
        paymentId: 'pay_rzp_py',
        cohortId: 'cohort-python-id',
        cohortTitle: 'PYTHON AI Sprint',
        amountInr: 4999,
        currency: 'INR',
        status: 'captured',
        paidAt: '2026-09-01T00:00:00Z',
        receipt: 'rcpt_02',
        provider: 'razorpay',
      },
    ],
    attendance: {
      totalSessionsHeld: 10,
      attendedCount: 9,
      attendanceRatePct: 90,
      lastAttendedAt: '2026-09-20T00:00:00Z',
      records: [
        {
          id: 'att-1',
          session_id: 'sess-1',
          session_title: 'Java Architecture Workshop',
          session_starts_at: '2026-09-20T00:00:00Z',
          student_id: 'student-42',
          status: 'present',
          join_time: '2026-09-20T00:00:00Z',
          duration_minutes: 60,
          notes: null,
          verified_by: null,
          check_in_method: 'self_check_in',
          created_at: '2026-09-20T00:00:00Z',
          updated_at: '2026-09-20T00:00:00Z',
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useToastModule, 'useToast').mockReturnValue(mockToast as unknown as ReturnType<typeof useToastModule.useToast>);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'student-42', email: 'alex@example.com' },
      profile: { id: 'student-42', full_name: 'Alex Morgan', role: 'student' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);

    vi.spyOn(userProfileServiceModule, 'getUserProfileOverview').mockResolvedValue(mockOverviewData);
    vi.spyOn(userProfileServiceModule, 'updateUserProfileContact').mockResolvedValue();
  });

  it('renders student identity, stats, and lists multi-course enrollments (JAVA + PYTHON)', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    // Identity assertions
    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    expect(screen.getByText('STUDENT')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 00000')).toBeInTheDocument();

    // Stats KPIs
    expect(screen.getByText('Enrolled Courses')).toBeInTheDocument();
    expect(screen.getByText('Total Fee Paid')).toBeInTheDocument();
    expect(screen.getByText('Attendance Rate')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();

    // Multi-course verification: both JAVA and PYTHON are listed
    expect(screen.getByText('JAVA Masterclass Cohort')).toBeInTheDocument();
    expect(screen.getByText('PYTHON AI Sprint')).toBeInTheDocument();
    expect(screen.getAllByText(/Go to Classroom/i)).toHaveLength(2);
  });

  it('allows switching to Attendance tab and viewing live session logs', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const attendanceTabBtn = screen.getByRole('button', { name: /Attendance & Sessions/i });
    fireEvent.click(attendanceTabBtn);

    expect(screen.getByText('Live Session Attendance Log')).toBeInTheDocument();
    expect(screen.getByText('Java Architecture Workshop')).toBeInTheDocument();
    expect(screen.getByText('present')).toBeInTheDocument();
  });

  it('allows switching to Fee Payments tab and viewing Razorpay receipts', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const paymentsTabBtn = screen.getByRole('button', { name: /Fee Payments & Receipts/i });
    fireEvent.click(paymentsTabBtn);

    expect(screen.getByText('Payment History & Receipts')).toBeInTheDocument();
    expect(screen.getByText('order_java_101')).toBeInTheDocument();
    expect(screen.getByText('order_py_202')).toBeInTheDocument();
  });

  it('opens Edit Profile modal and submits contact updates', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Edit Profile/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Update Profile Details')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Ramanan M/i);
    fireEvent.change(nameInput, { target: { value: 'Alex Morgan Updated' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(userProfileServiceModule.updateUserProfileContact).toHaveBeenCalledWith('student-42', {
        fullName: 'Alex Morgan Updated',
        whatsappNumber: '+91 98765 00000',
      });
      expect(mockToast.success).toHaveBeenCalledWith('Profile details updated successfully.');
    });
  });
});

