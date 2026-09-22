import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../../context/SidebarContext';
import { WorkspaceShell } from '../../components/WorkspaceShell';
import * as useAuthModule from '../../context/useAuth';

vi.mock('../../context/useAuth');

describe('WorkspaceSidebar & WorkspaceShell Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@cutcraft.dev' },
      profile: { id: 'admin-1', role: 'admin', full_name: 'Admin User' },
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      login: vi.fn(),
      signup: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
  });

  it('renders expanded workspace sidebar by default with lg:pl-64 on shell', () => {
    const { container } = render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceShell>
            <div>Page Content</div>
          </WorkspaceShell>
        </MemoryRouter>
      </SidebarProvider>
    );

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.getByText('Course studio')).toBeInTheDocument();

    const shellContainer = container.firstChild as HTMLElement;
    expect(shellContainer.className).toContain('lg:pl-64');
  });

  it('collapses sidebar when clicking collapse footer button and updates shell padding to lg:pl-20', () => {
    const { container } = render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceShell>
            <div>Page Content</div>
          </WorkspaceShell>
        </MemoryRouter>
      </SidebarProvider>
    );

    const collapseBtn = screen.getByTitle('Collapse sidebar');
    fireEvent.click(collapseBtn);

    const shellContainer = container.firstChild as HTMLElement;
    expect(shellContainer.className).toContain('lg:pl-20');
    expect(shellContainer.className).not.toContain('lg:pl-64');

    expect(localStorage.getItem('cutcraft_sidebar_collapsed')).toBe('true');

    // Expanding it again
    const expandBtn = screen.getByTitle('Expand sidebar');
    fireEvent.click(expandBtn);

    expect(shellContainer.className).toContain('lg:pl-64');
    expect(localStorage.getItem('cutcraft_sidebar_collapsed')).toBe('false');
  });
});

