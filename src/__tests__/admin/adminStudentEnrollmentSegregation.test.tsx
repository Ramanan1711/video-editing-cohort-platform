import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UsersTab } from '../../components/admin/tabs/UsersTab';
import type { UserProfile, AdminEnrollment } from '../../lib/adminService';

describe('Admin Console - Student Directory Enrollment Segregation', () => {
  const mockStudents: UserProfile[] = [
    {
      id: 'student-registered-1',
      email: 'registered1@iunoware.com',
      full_name: 'Rachel Registered',
      role: 'student',
      status: 'active',
      phone: '+1 555-0100',
      created_at: '2026-10-15T10:00:00Z',
    },
    {
      id: 'student-registered-2',
      email: 'registered2@iunoware.com',
      full_name: 'Peter Pending',
      role: 'student',
      status: 'suspended',
      phone: null,
      created_at: '2026-10-18T10:00:00Z',
    },
    {
      id: 'student-enrolled-1',
      email: 'enrolled1@iunoware.com',
      full_name: 'Emma Enrolled',
      role: 'student',
      status: 'active',
      phone: '+91 98765 43210',
      whatsapp_number: '+91 98765 43210',
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'student-enrolled-2',
      email: 'enrolled2@iunoware.com',
      full_name: 'Eric Enrolled',
      role: 'student',
      status: 'active',
      phone: null,
      created_at: '2026-09-05T10:00:00Z',
    },
  ];

  const mockEnrollments: AdminEnrollment[] = [
    {
      user_id: 'student-enrolled-1',
      cohort_id: 'cohort-premiere',
      cohort_name: 'Batch 1 - Premiere Pro',
      status: 'active',
      created_at: '2026-09-10T12:00:00Z',
      student_name: 'Emma Enrolled',
      student_email: 'enrolled1@iunoware.com',
    },
    {
      user_id: 'student-enrolled-1',
      cohort_id: 'cohort-ae',
      cohort_name: 'Batch 2 - Advanced After Effects',
      status: 'active',
      created_at: '2026-09-11T12:00:00Z',
      student_name: 'Emma Enrolled',
      student_email: 'enrolled1@iunoware.com',
    },
    {
      user_id: 'student-enrolled-1',
      cohort_id: 'cohort-davinci',
      cohort_name: 'Batch 3 - DaVinci Resolve Color Grading',
      status: 'active',
      created_at: '2026-09-12T12:00:00Z',
      student_name: 'Emma Enrolled',
      student_email: 'enrolled1@iunoware.com',
    },
    {
      user_id: 'student-enrolled-1',
      cohort_id: 'cohort-sound',
      cohort_name: 'Batch 4 - Sound Design & Foley',
      status: 'active',
      created_at: '2026-09-13T12:00:00Z',
      student_name: 'Emma Enrolled',
      student_email: 'enrolled1@iunoware.com',
    },
    {
      user_id: 'student-enrolled-1',
      cohort_id: 'cohort-3d',
      cohort_name: 'Batch 5 - 3D Motion Graphics',
      status: 'completed',
      created_at: '2026-09-14T12:00:00Z',
      student_name: 'Emma Enrolled',
      student_email: 'enrolled1@iunoware.com',
    },
    {
      user_id: 'student-enrolled-2',
      cohort_id: 'cohort-aftereffects',
      cohort_name: 'Batch 2 - After Effects',
      status: 'active',
      created_at: '2026-09-12T12:00:00Z',
      student_name: 'Eric Enrolled',
      student_email: 'enrolled2@iunoware.com',
    },
  ];

  const defaultProps = {
    users: mockStudents,
    enrollments: mockEnrollments,
    currentUserId: 'admin-id',
    currentUserEmail: 'admin@iunoware.com',
    canManageRoles: true,
    canManageStatus: true,
    isSuperAdmin: true,
    onRoleChange: vi.fn(),
    onStatusChange: vi.fn(),
    onAdminSubRoleChange: vi.fn(),
    onBulkUserStatus: vi.fn(),
    onExportUsers: vi.fn(),
  };

  it('renders segregated sections with headings "Registered Students" and "Enrolled Students"', () => {
    render(<UsersTab {...defaultProps} />);

    // Check headings
    const registeredHeadings = screen.getAllByRole('heading', { name: /Registered Students/i });
    expect(registeredHeadings.length).toBeGreaterThan(0);

    const enrolledHeadings = screen.getAllByRole('heading', { name: /Enrolled Students/i });
    expect(enrolledHeadings.length).toBeGreaterThan(0);

    // Verify sections exist
    expect(screen.getByTestId('registered-students-section')).toBeInTheDocument();
    expect(screen.getByTestId('enrolled-students-section')).toBeInTheDocument();
  });

  it('segregates unenrolled students into the "Registered Students" table with contact info', () => {
    render(<UsersTab {...defaultProps} />);

    const registeredSection = screen.getByTestId('registered-students-section');

    // Rachel and Peter are registered but not enrolled
    expect(registeredSection).toHaveTextContent('Rachel Registered');
    expect(registeredSection).toHaveTextContent('registered1@iunoware.com');
    expect(registeredSection).toHaveTextContent('+1 555-0100');

    expect(registeredSection).toHaveTextContent('Peter Pending');
    expect(registeredSection).toHaveTextContent('registered2@iunoware.com');

    // Enrolled students must NOT be in the Registered Students table
    expect(registeredSection).not.toHaveTextContent('Emma Enrolled');
    expect(registeredSection).not.toHaveTextContent('Eric Enrolled');
  });

  it('segregates enrolled students into the "Enrolled Students" table with cohort badges and contact info', () => {
    render(<UsersTab {...defaultProps} />);

    const enrolledSection = screen.getByTestId('enrolled-students-section');

    // Emma and Eric are enrolled in cohorts
    expect(enrolledSection).toHaveTextContent('Emma Enrolled');
    expect(enrolledSection).toHaveTextContent('Batch 1 - Premiere Pro');
    // Contact column info
    expect(enrolledSection).toHaveTextContent('+91 98765 43210');
    const waLink = enrolledSection.querySelector('a[href*="wa.me/919876543210"]');
    expect(waLink).toBeInTheDocument();

    expect(enrolledSection).toHaveTextContent('Eric Enrolled');
    expect(enrolledSection).toHaveTextContent('Batch 2 - After Effects');
    expect(enrolledSection).toHaveTextContent('Not provided');

    // Unenrolled students must NOT be in the Enrolled Students table
    expect(enrolledSection).not.toHaveTextContent('Rachel Registered');
    expect(enrolledSection).not.toHaveTextContent('Peter Pending');
  });

  it('allows switching views between All Students, Registered Students, and Enrolled Students', () => {
    render(<UsersTab {...defaultProps} />);

    // Click Registered Students view filter
    fireEvent.click(screen.getByTestId('student-filter-registered'));
    expect(screen.getByTestId('registered-students-section')).toBeInTheDocument();
    expect(screen.queryByTestId('enrolled-students-section')).not.toBeInTheDocument();

    // Click Enrolled Students view filter
    fireEvent.click(screen.getByTestId('student-filter-enrolled'));
    expect(screen.queryByTestId('registered-students-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('enrolled-students-section')).toBeInTheDocument();

    // Click All Students view filter
    fireEvent.click(screen.getByTestId('student-filter-all'));
    expect(screen.getByTestId('registered-students-section')).toBeInTheDocument();
    expect(screen.getByTestId('enrolled-students-section')).toBeInTheDocument();
  });

  it('filters students across segregated tables when searching', () => {
    render(<UsersTab {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'Rachel' } });

    // Registered section should show Rachel
    expect(screen.getByTestId('registered-students-section')).toHaveTextContent('Rachel Registered');
    // Enrolled section should show empty state
    expect(screen.getByTestId('enrolled-students-section')).toHaveTextContent(/No enrolled students/i);
  });

  it('calls onStatusChange when suspending or reactivating a student', async () => {
    render(<UsersTab {...defaultProps} />);

    // Peter Pending is suspended, should have a Reactivate button
    const reactivateButton = screen.getByRole('button', { name: /reactivate/i });
    expect(reactivateButton).toBeInTheDocument();

    fireEvent.click(reactivateButton);
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'student-registered-2' }),
      'active'
    );
  });

  it('handles multi-course enrolled students with uniform "+N more" badge and opens the detail modal', () => {
    render(<UsersTab {...defaultProps} />);

    const enrolledSection = screen.getByTestId('enrolled-students-section');

    // Emma has 5 enrollments: should show the primary badge + "+4 more"
    expect(enrolledSection).toHaveTextContent('Batch 1 - Premiere Pro');
    const moreBtn = screen.getByTestId('view-cohorts-student-enrolled-1');
    expect(moreBtn).toBeInTheDocument();
    expect(moreBtn).toHaveTextContent('+4 more');

    // Click "+4 more" to open the Enrolled Cohorts modal
    fireEvent.click(moreBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Emma Enrolled');
    expect(dialog).toHaveTextContent('5 Cohorts');
    expect(dialog).toHaveTextContent('Batch 1 - Premiere Pro');
    expect(dialog).toHaveTextContent('Batch 2 - Advanced After Effects');
    expect(dialog).toHaveTextContent('Batch 3 - DaVinci Resolve Color Grading');
    expect(dialog).toHaveTextContent('Batch 4 - Sound Design & Foley');
    expect(dialog).toHaveTextContent('Batch 5 - 3D Motion Graphics');

    // Close button dismisses the modal
    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows toggling cohort display mode between Compact and Expanded', () => {
    render(<UsersTab {...defaultProps} />);

    // Default is compact
    expect(screen.getByTestId('view-cohorts-student-enrolled-1')).toBeInTheDocument();

    // Toggle to expanded
    const expandedBtn = screen.getByTestId('cohort-display-expanded');
    fireEvent.click(expandedBtn);

    // In expanded mode, all badges are rendered directly in the table
    const enrolledSection = screen.getByTestId('enrolled-students-section');
    expect(enrolledSection).toHaveTextContent('Batch 2 - Advanced After Effects');
    expect(enrolledSection).toHaveTextContent('Batch 3 - DaVinci Resolve Color Grading');

    // Switch back to compact
    const compactBtn = screen.getByTestId('cohort-display-compact');
    fireEvent.click(compactBtn);
    expect(screen.getByTestId('view-cohorts-student-enrolled-1')).toBeInTheDocument();
  });
});
