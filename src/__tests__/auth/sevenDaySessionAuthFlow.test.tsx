import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  SEVEN_DAYS_MS,
  SESSION_TIMESTAMP_KEY,
  recordSessionEstablished,
  getSessionEstablishedAt,
  isSessionExpired,
  clearSessionEstablished,
  enforceSevenDaySessionPolicy,
  getSessionTelemetry,
} from '../../lib/authSessionService';
import { Login } from '../../pages/Login';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import * as useAuthModule from '../../context/useAuth';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        resend: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
      })),
    },
  };
});

describe('Seven-Day Session Persistence & Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe('AuthSessionService (7-Day Policy)', () => {
    it('records and retrieves session establishment timestamp correctly in storage', () => {
      const testTime = 1700000000000;
      recordSessionEstablished(testTime);

      expect(window.localStorage.getItem(SESSION_TIMESTAMP_KEY)).toBe(testTime.toString());
      expect(getSessionEstablishedAt()).toBe(testTime);
    });

    it('identifies sessions within 7 days as NOT expired', () => {
      const now = Date.now();
      const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000; // 6 days
      recordSessionEstablished(sixDaysAgo);

      expect(isSessionExpired()).toBe(false);

      const telemetry = getSessionTelemetry();
      expect(telemetry.active).toBe(true);
      expect(telemetry.remainingDays).toBeGreaterThanOrEqual(1);
    });

    it('identifies sessions beyond 7 days as EXPIRED', () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000; // 8 days
      recordSessionEstablished(eightDaysAgo);

      expect(isSessionExpired()).toBe(true);

      const telemetry = getSessionTelemetry();
      expect(telemetry.active).toBe(false);
      expect(telemetry.remainingDays).toBe(0);
    });

    it('enforceSevenDaySessionPolicy automatically signs out and clears expired sessions', async () => {
      const now = Date.now();
      const eightDaysAgo = now - (SEVEN_DAYS_MS + 1000);
      recordSessionEstablished(eightDaysAgo);

      const mockSession = { user: { id: 'usr-expired' }, expires_at: Math.floor(now / 1000) + 3600 };
      const isValid = await enforceSevenDaySessionPolicy(mockSession);

      expect(isValid).toBe(false);
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(SESSION_TIMESTAMP_KEY)).toBeNull();
    });

    it('enforceSevenDaySessionPolicy validates and retains active sessions within 7 days', async () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
      recordSessionEstablished(twoDaysAgo);

      const mockSession = { user: { id: 'usr-valid' }, expires_at: Math.floor(now / 1000) + 3600 };
      const isValid = await enforceSevenDaySessionPolicy(mockSession);

      expect(isValid).toBe(true);
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(getSessionEstablishedAt()).toBe(twoDaysAgo);
    });

    it('clearSessionEstablished clears storage on user logout', () => {
      recordSessionEstablished(Date.now());
      expect(getSessionEstablishedAt()).not.toBeNull();

      clearSessionEstablished();
      expect(getSessionEstablishedAt()).toBeNull();
    });
  });

  describe('Student Login Navigation to /profile', () => {
    it('redirects student to /profile after successful login when no cohort checkout is pending', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: { id: 'student-uuid-1', email: 'student@iunoware.com' },
          session: { access_token: 'fake-jwt', refresh_token: 'fake-refresh' },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'student-uuid-1', role: 'student', status: 'active' },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'student@iunoware.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'CorrectPassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/profile');
      });

      // Verify session timestamp was recorded
      expect(getSessionEstablishedAt()).not.toBeNull();
    });

    it('redirects mentor to /mentor after successful login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: { id: 'mentor-uuid-1', email: 'mentor@iunoware.com' },
          session: { access_token: 'fake-jwt', refresh_token: 'fake-refresh' },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'mentor-uuid-1', role: 'mentor', status: 'active' },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'mentor@iunoware.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'MentorPassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/mentor');
      });
    });

    it('redirects admin to /admin after successful login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: { id: 'admin-uuid-1', email: 'admin@iunoware.com' },
          session: { access_token: 'fake-jwt', refresh_token: 'fake-refresh' },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'admin-uuid-1', role: 'admin', status: 'active' },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'admin@iunoware.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'AdminPassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });
  });

  describe('ProtectedRoute & Session Validation', () => {
    it('signs out automatically when visiting a protected route with an expired 7-day session', () => {
      const mockSignOut = vi.fn();
      const mockRefresh = vi.fn();

      // Session established 8 days ago
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      recordSessionEstablished(eightDaysAgo);

      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'u-1', email: 'editor@iunoware.com' },
        profile: { id: 'u-1', role: 'student', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: mockRefresh,
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <div>Student Profile Area</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Verify sign out is triggered because session exceeded 7 days
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('permits access to /profile when session is valid and within 7 days', () => {
      const mockSignOut = vi.fn();
      const mockRefresh = vi.fn();

      // Session established 1 day ago
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
      recordSessionEstablished(oneDayAgo);

      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: { id: 'u-1', email: 'editor@iunoware.com' },
        profile: { id: 'u-1', role: 'student', status: 'active' },
        loading: false,
        signOut: mockSignOut,
        refreshProfile: mockRefresh,
      } as unknown as ReturnType<typeof useAuthModule.useAuth>);

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <div>Student Profile Area</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Student Profile Area')).toBeInTheDocument();
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});

