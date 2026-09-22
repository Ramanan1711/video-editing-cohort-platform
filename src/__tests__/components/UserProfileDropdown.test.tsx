import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserProfileDropdown } from '../../components/UserProfileDropdown';
import * as useAuthModule from '../../context/useAuth';

vi.mock('../../context/useAuth');

describe('UserProfileDropdown Component Suite', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u-1', email: 'john@cutcraft.dev' },
      profile: { id: 'u-1', role: 'admin', full_name: 'John Doe' },
      loading: false,
      signOut: mockSignOut,
      refreshProfile: vi.fn(),
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
  });

  it('renders user initials and opens dropdown menu on click', () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown />
      </MemoryRouter>
    );

    const avatarBtn = screen.getByRole('button', { name: /user profile menu/i });
    expect(avatarBtn).toBeInTheDocument();
    expect(screen.getByText('JO')).toBeInTheDocument();

    // Menu is closed initially
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(avatarBtn);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Admin Control Room')).toBeInTheDocument();
    expect(screen.getByText('Community Hub')).toBeInTheDocument();
  });

  it('calls signOut and closes dropdown when Sign out is clicked', () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown />
      </MemoryRouter>
    );

    const avatarBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(avatarBtn);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('closes dropdown when Escape key is pressed', () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown />
      </MemoryRouter>
    );

    const avatarBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(avatarBtn);
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});

