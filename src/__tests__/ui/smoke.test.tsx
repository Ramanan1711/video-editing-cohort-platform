import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StateFallback } from '../../components/ui/StateFallback';
import { Pagination } from '../../components/ui/Pagination';

describe('UI Smoke & Viewport Responsiveness Suite', () => {
  describe('StateFallback Component Smoke Tests', () => {
    it('renders network offline fallback with retry button', () => {
      const mockRetry = vi.fn();
      render(
        <MemoryRouter>
          <StateFallback
            type="network"
            title="Network Offline"
            description="Check your connection."
            onAction={mockRetry}
            actionText="Retry Connection"
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Network Offline')).toBeInTheDocument();
      expect(screen.getByText('Check your connection.')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
      fireEvent.click(retryBtn);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('renders permission denied fallback with appropriate icon and message', () => {
      render(
        <MemoryRouter>
          <StateFallback
            type="permission"
            title="Access Restricted"
            description="Administrator role required."
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText('Administrator role required.')).toBeInTheDocument();
    });

    it('renders missing migration fallback with technical guidance hint', () => {
      render(
        <MemoryRouter>
          <StateFallback
            type="migration"
            title="Migration Required"
            description="Table does not exist."
            appError={{
              code: 'MIGRATION_MISSING',
              title: 'Migration Required',
              message: 'Table does not exist.',
              actionHint: 'Run migration 0004 in SQL editor',
              canRetry: false,
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Migration Required')).toBeInTheDocument();
      expect(screen.getByText(/Run migration 0004 in SQL editor/i)).toBeInTheDocument();
    });

    it('renders stale session fallback prompting re-authentication', () => {
      render(
        <MemoryRouter>
          <StateFallback
            type="stale-auth"
            title="Session Expired"
            description="Please log in again."
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText('Please log in again.')).toBeInTheDocument();
    });

    it('renders empty dataset state with custom action button', () => {
      const mockAction = vi.fn();
      render(
        <MemoryRouter>
          <StateFallback
            type="empty"
            title="No Cohorts Found"
            description="Join your first cohort to get started."
            actionText="Explore Cohorts"
            onAction={mockAction}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('No Cohorts Found')).toBeInTheDocument();
      const actionBtn = screen.getByRole('button', { name: /Explore Cohorts/i });
      fireEvent.click(actionBtn);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pagination Component Smoke Tests', () => {
    it('renders pagination pills and record count correctly', () => {
      const mockPageChange = vi.fn();
      const mockPageSizeChange = vi.fn();

      render(
        <Pagination
          currentPage={2}
          totalItems={95}
          pageSize={25}
          onPageChange={mockPageChange}
          onPageSizeChange={mockPageSizeChange}
          itemLabel="submissions"
        />
      );

      // Record counter: Showing 26 to 50 of 95 submissions
      expect(
        screen.getByText((_, el) => el?.textContent?.replace(/\s+/g, ' ').trim() === 'Showing 26 to 50 of 95 submissions')
      ).toBeInTheDocument();

      // Click page 3 pill
      const page3Btn = screen.getByRole('button', { name: '3' });
      fireEvent.click(page3Btn);
      expect(mockPageChange).toHaveBeenCalledWith(3);
    });

    it('handles next and previous navigation clicks', () => {
      const mockPageChange = vi.fn();
      render(
        <Pagination
          currentPage={2}
          totalItems={100}
          pageSize={25}
          onPageChange={mockPageChange}
        />
      );

      const nextBtn = screen.getByRole('button', { name: /Next page/i });
      fireEvent.click(nextBtn);
      expect(mockPageChange).toHaveBeenCalledWith(3);

      const prevBtn = screen.getByRole('button', { name: /Previous page/i });
      fireEvent.click(prevBtn);
      expect(mockPageChange).toHaveBeenCalledWith(1);
    });

    it('changes page size using selector dropdown', () => {
      const mockPageSizeChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalItems={100}
          pageSize={25}
          onPageChange={vi.fn()}
          onPageSizeChange={mockPageSizeChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '50' } });
      expect(mockPageSizeChange).toHaveBeenCalledWith(50);
    });

    it('renders nothing when totalItems is 0', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalItems={0}
          pageSize={25}
          onPageChange={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Viewport Adaptation & Responsiveness Smoke', () => {
    it('adapts pagination layout for mobile viewport (375px)', () => {
      window.innerWidth = 375;
      window.innerHeight = 667;

      const { container } = render(
        <Pagination
          currentPage={1}
          totalItems={50}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      );

      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('adapts pagination layout for desktop viewport (1280px)', () => {
      window.innerWidth = 1280;
      window.innerHeight = 800;

      const { container } = render(
        <Pagination
          currentPage={1}
          totalItems={50}
          pageSize={10}
          onPageChange={vi.fn()}
        />
      );

      expect(container.querySelector('nav')).toBeInTheDocument();
    });
  });
});

