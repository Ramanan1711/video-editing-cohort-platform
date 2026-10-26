import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ParentSuperAdminRegister } from '../../pages/ParentSuperAdminRegister';
import * as useAuthModule from '../../context/useAuth';
import * as toastModule from '../../context/useToast';
import * as adminService from '../../lib/adminService';

vi.mock('../../context/useAuth');
vi.mock('../../context/useToast');
vi.mock('../../lib/adminService');

describe('Parent Super Admin Registration Portal', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    showToast: vi.fn(),
    dismiss: vi.fn(),
    removeToast: vi.fn(),
  };

  const parentSuperAdminProfile = {
    id: 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b',
    email: 'ajayramanan17@gmail.com',
    full_name: 'Ramanan',
    role: 'admin',
    admin_role: 'parent_super_admin' as const,
    status: 'active' as const,
  };

  const sampleStaffList: adminService.UserProfile[] = [
    {
      id: 'e7d1e39f-d098-42d3-a0b0-6a1e93c3538b',
      email: 'ajayramanan17@gmail.com',
      full_name: 'Ramanan',
      role: 'admin',
      admin_role: 'parent_super_admin',
      status: 'active',
      created_at: '2026-09-18T00:00:00Z',
      whatsapp_number: '919080995108',
    },
    {
      id: 'child-admin-1',
      email: 'child.admin@iunoware.com',
      full_name: 'Child Admin User',
      role: 'admin',
      admin_role: 'child_super_admin',
      status: 'active',
      created_at: '2026-09-20T00:00:00Z',
      whatsapp_number: '919876543210',
    },
    {
      id: 'mentor-1',
      email: 'mentor.jane@iunoware.com',
      full_name: 'Jane Mentor',
      role: 'mentor',
      status: 'active',
      created_at: '2026-09-22T00:00:00Z',
      whatsapp_number: '919876543211',
    },
    {
      id: 'admin-1',
      email: 'admin.mark@iunoware.com',
      full_name: 'Mark Admin',
      role: 'admin',
      status: 'active',
      created_at: '2026-09-23T00:00:00Z',
      whatsapp_number: '919876543212',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toastModule, 'useToast').mockReturnValue(mockToast);
    vi.spyOn(adminService, 'listUsers').mockResolvedValue(sampleStaffList);
  });

  it('redirects unauthorized users (non-parent super admins) to /unauthorized', () => {
    // Ordinary admin trying to access parent super admin portal
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin.mark@iunoware.com' } as any,
      profile: {
        id: 'admin-1',
        email: 'admin.mark@iunoware.com',
        full_name: 'Mark Admin',
        role: 'admin',
        status: 'active',
      } as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <Routes>
          <Route path="/admin/super-admin" element={<ParentSuperAdminRegister />} />
          <Route path="/unauthorized" element={<div>Access Denied - Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Denied - Unauthorized')).toBeInTheDocument();
  });

  it('renders registration form and staff roster when accessed by Parent Super Admin', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    // Verify header & authority badge
    expect(screen.getByText(/Leadership & Staff Registration Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Parent Super Admin Exclusive Authority/i)).toBeInTheDocument();

    // Verify all required form fields are present
    expect(screen.getByLabelText(/Full name\*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address\*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number\*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password\*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password\*/i)).toBeInTheDocument();
    expect(screen.getByText(/^Role\*/i)).toBeInTheDocument();

    // Verify role choices
    expect(screen.getByTestId('role-btn-mentor')).toBeInTheDocument();
    expect(screen.getByTestId('role-btn-child-super-admin')).toBeInTheDocument();

    // Verify initial staff roster loaded
    await waitFor(() => {
      expect(screen.getByText('Jane Mentor')).toBeInTheDocument();
      expect(screen.getByText('Mark Admin')).toBeInTheDocument();
      expect(screen.getByText('Child Admin User')).toBeInTheDocument();
    });
  });

  it('validates password mismatch before attempting registration', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name\*/i), { target: { value: 'Test Mentor' } });
    fireEvent.change(screen.getByLabelText(/Email address\*/i), { target: { value: 'test@iunoware.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number\*/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/^Password\*/i), { target: { value: 'Secret123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password\*/i), { target: { value: 'Mismatch999!' } });

    fireEvent.click(screen.getByTestId('submit-register-staff'));

    expect(screen.getByText(/Password and Confirm Password do not match/i)).toBeInTheDocument();
    expect(adminService.registerStaffUser).not.toHaveBeenCalled();
  });

  it('validates phone number length requirement', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name\*/i), { target: { value: 'Short Phone User' } });
    fireEvent.change(screen.getByLabelText(/Email address\*/i), { target: { value: 'short@iunoware.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number\*/i), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText(/^Password\*/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password\*/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByTestId('submit-register-staff'));

    expect(screen.getByText(/Please enter a valid phone number with at least 10 digits/i)).toBeInTheDocument();
    expect(adminService.registerStaffUser).not.toHaveBeenCalled();
  });

  it('successfully registers a Mentor and updates the staff roster', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    const newMentor = {
      id: 'new-mentor-99',
      full_name: 'Samantha Mentor',
      email: 'samantha.mentor@iunoware.com',
      role: 'mentor',
      status: 'active' as const,
      created_at: new Date().toISOString(),
      whatsapp_number: '919876500000',
    };

    vi.spyOn(adminService, 'registerStaffUser').mockResolvedValue(newMentor);

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/Full name\*/i), { target: { value: 'Samantha Mentor' } });
    fireEvent.change(screen.getByLabelText(/Email address\*/i), { target: { value: 'samantha.mentor@iunoware.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number\*/i), { target: { value: '9876500000' } });
    fireEvent.change(screen.getByLabelText(/^Password\*/i), { target: { value: 'SuperSecure123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password\*/i), { target: { value: 'SuperSecure123!' } });

    // Select Role = Mentor
    fireEvent.click(screen.getByTestId('role-btn-mentor'));

    // Submit
    fireEvent.click(screen.getByTestId('submit-register-staff'));

    await waitFor(() => {
      expect(adminService.registerStaffUser).toHaveBeenCalledWith(
        {
          fullName: 'Samantha Mentor',
          email: 'samantha.mentor@iunoware.com',
          phone: '9876500000',
          password: 'SuperSecure123!',
          role: 'Mentor',
        },
        {
          id: parentSuperAdminProfile.id,
          email: parentSuperAdminProfile.email,
        }
      );
      expect(screen.getByTestId('register-staff-success')).toHaveTextContent(/Successfully registered Samantha Mentor as Mentor/i);
    });
  });

  it('successfully registers a Child Super Admin', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    const newChildAdmin = {
      id: 'new-child-admin-1',
      full_name: 'Daniel Operations',
      email: 'daniel.ops@iunoware.com',
      role: 'admin',
      admin_role: 'child_super_admin' as const,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      whatsapp_number: '919876511111',
    };

    vi.spyOn(adminService, 'registerStaffUser').mockResolvedValue(newChildAdmin);

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full name\*/i), { target: { value: 'Daniel Operations' } });
    fireEvent.change(screen.getByLabelText(/Email address\*/i), { target: { value: 'daniel.ops@iunoware.com' } });
    fireEvent.change(screen.getByLabelText(/Phone number\*/i), { target: { value: '9876511111' } });
    fireEvent.change(screen.getByLabelText(/^Password\*/i), { target: { value: 'ExecutivePassword999!' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password\*/i), { target: { value: 'ExecutivePassword999!' } });

    // Select Role = Child Super_Admin
    fireEvent.click(screen.getByTestId('role-btn-child-super-admin'));

    // Submit
    fireEvent.click(screen.getByTestId('submit-register-staff'));

    await waitFor(() => {
      expect(adminService.registerStaffUser).toHaveBeenCalledWith(
        {
          fullName: 'Daniel Operations',
          email: 'daniel.ops@iunoware.com',
          phone: '9876511111',
          password: 'ExecutivePassword999!',
          role: 'Child Super_Admin',
        },
        expect.anything()
      );
      expect(screen.getByTestId('register-staff-success')).toHaveTextContent(/Successfully registered Daniel Operations as Child Super Admin/i);
    });
  });

  it('allows filtering the staff roster by role tabs', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: parentSuperAdminProfile.id, email: parentSuperAdminProfile.email } as any,
      profile: parentSuperAdminProfile as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/super-admin']}>
        <ParentSuperAdminRegister />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Mentor')).toBeInTheDocument();
      expect(screen.getByText('Mark Admin')).toBeInTheDocument();
    });

    // Filter to Mentors only
    fireEvent.click(screen.getByRole('button', { name: /Mentors \(1\)/i }));

    expect(screen.getByText('Jane Mentor')).toBeInTheDocument();
    expect(screen.queryByText('Mark Admin')).not.toBeInTheDocument();

    // Filter to Child Super only
    fireEvent.click(screen.getByRole('button', { name: /Child Super Admins \(2\)/i }));

    expect(screen.getByText('Child Admin User')).toBeInTheDocument();
    expect(screen.getByText('Mark Admin')).toBeInTheDocument();
    expect(screen.queryByText('Jane Mentor')).not.toBeInTheDocument();
  });
});
