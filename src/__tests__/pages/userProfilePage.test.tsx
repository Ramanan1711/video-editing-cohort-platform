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
        platform: 'Iunoware Academy',
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
        platform: 'Iunoware Academy',
      },
    ],
    certificates: [
      {
        id: 'cert-1',
        certificateNumber: 'CC-202609-JAVA101',
        cohortId: 'cohort-java-id',
        cohortTitle: 'JAVA Masterclass Cohort',
        issuedAt: '2026-09-25T00:00:00Z',
        metadata: {
          total_lessons: 10,
          completed_lessons: 10,
          total_assignments: 4,
          approved_assignments: 4,
          total_challenges: 15,
          completed_challenges: 15,
          total_sessions: 10,
          attended_sessions: 9,
          attendance_rate_pct: 90,
          verified_by: 'system',
        },
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

    // Hero Identity Card professional home page theme styling
    const heroHeading = screen.getByText('Alex Morgan');
    const heroCard = heroHeading.closest('.rounded-3xl');
    expect(heroCard).toBeInTheDocument();
    expect(heroCard).toHaveClass('relative');
    expect(heroCard).toHaveClass('overflow-hidden');
    expect(heroCard).toHaveClass('dark:to-surface-base');

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

  it('renders "Back to Public Website" button to navigate to home without logging out and shows active 7-day session indicator', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const publicWebsiteLink = screen.getByRole('link', { name: /Back to Public Website/i });
    expect(publicWebsiteLink).toBeInTheDocument();
    expect(publicWebsiteLink).toHaveAttribute('href', '/');

    expect(screen.getByText(/7-Day Session Active/i)).toBeInTheDocument();
  });

  it('allows switching to Earned Certificates tab and viewing issued credentials with download and verify links', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const certsTabBtn = screen.getByRole('button', { name: /Earned Certificates/i });
    fireEvent.click(certsTabBtn);

    // Verify Tab Header
    expect(screen.getByText('Earned Certificates & Credentials')).toBeInTheDocument();
    expect(screen.getByText(/1 Verified Credential/i)).toBeInTheDocument();

    // Verify Certificate Card details
    expect(screen.getByText('Official Graduate Certificate')).toBeInTheDocument();
    expect(screen.getByText('JAVA Masterclass Cohort')).toBeInTheDocument();
    expect(screen.getByText('CC-202609-JAVA101')).toBeInTheDocument();
    expect(screen.getByText(/September 25, 2026/i)).toBeInTheDocument();

    // 4-Pillar metrics
    expect(screen.getByText(/10 \/ 10 Lessons/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 4 Approved/i)).toBeInTheDocument();
    expect(screen.getByText(/15 \/ 15 Accepted/i)).toBeInTheDocument();
    expect(screen.getAllByText(/90%/i).length).toBeGreaterThanOrEqual(2);

    // Verify button and direct verify link
    const downloadBtn = screen.getByRole('button', { name: /Download Certificate/i });
    expect(downloadBtn).toBeInTheDocument();

    const verifyLink = screen.getByRole('link', { name: /Verify/i });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute('href', '/verify-certificate?id=CC-202609-JAVA101');
    expect(verifyLink).toHaveAttribute('target', '_blank');
  });

  it('displays certified graduate badge and View Certificate button on enrolled course cards', async () => {
    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    // Certified Graduate badge is visible on the JAVA course card
    expect(screen.getByText('Certified Graduate')).toBeInTheDocument();

    // View Certificate button is present
    const viewCertBtn = screen.getByRole('button', { name: /View Certificate/i });
    expect(viewCertBtn).toBeInTheDocument();
  });

  it('displays empty state on Certificates tab when user has no issued certificates', async () => {
    vi.spyOn(userProfileServiceModule, 'getUserProfileOverview').mockResolvedValueOnce({
      ...mockOverviewData,
      certificates: [],
    });

    render(
      <MemoryRouter>
        <UserProfile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
    });

    const certsTabBtn = screen.getByRole('button', { name: /Earned Certificates \(0\)/i });
    fireEvent.click(certsTabBtn);

    expect(screen.getByText('No Certificates Issued Yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Enrolled Courses/i })).toBeInTheDocument();
  });
});

