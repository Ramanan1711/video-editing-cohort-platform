import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../../pages/Login';
import { Register } from '../../pages/Register';
import { EnrollmentPanel } from '../../components/StudentFlowPanels';
import { supabase } from '../../lib/supabaseClient';
import * as courseService from '../../lib/courseService';
import * as paymentService from '../../lib/paymentService';
import {
  setPendingCohortCheckout,
  getPendingCohortCheckout,
  clearPendingCohortCheckout,
  resolveTargetCohortId,
  buildCohortRedirectUrl,
  PENDING_COHORT_STORAGE_KEY,
} from '../../lib/cohortCheckoutPersistence';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../lib/courseService', async () => {
  const actual = await vi.importActual('../../lib/courseService');
  return {
    ...actual,
    listCohorts: vi.fn(),
    listAvailableCohorts: vi.fn(),
  };
});

vi.mock('../../lib/paymentService', async () => {
  const actual = await vi.importActual('../../lib/paymentService');
  return {
    ...actual,
    startCohortCheckout: vi.fn(),
  };
});

describe('Signup Journey & Cohort Selection Preservation Across Email Confirmation & Login', () => {
  const mockCohort = {
    id: 'c-uuid-999',
    name: 'Full-Stack Video Sprint Batch 15',
    description: '15-day intensive production internship',
    status: 'published' as const,
    price_inr: 4999,
    currency: 'INR',
    capacity: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    (courseService.listCohorts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockCohort]);
    (courseService.listAvailableCohorts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockCohort]);
  });

  describe('1. Cohort Checkout Persistence Utility', () => {
    it('persists and retrieves selected cohort in storage', () => {
      setPendingCohortCheckout('c-uuid-999', 'Full-Stack Video Sprint Batch 15', 4999, 'INR');

      const retrieved = getPendingCohortCheckout();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.cohortId).toBe('c-uuid-999');
      expect(retrieved?.cohortName).toBe('Full-Stack Video Sprint Batch 15');
      expect(retrieved?.priceInr).toBe(4999);
      expect(retrieved?.currency).toBe('INR');
    });

    it('clears pending cohort selection', () => {
      setPendingCohortCheckout('c-uuid-999');
      clearPendingCohortCheckout();
      expect(getPendingCohortCheckout()).toBeNull();
    });

    it('resolves cohort ID prioritizing URL query param over storage', () => {
      setPendingCohortCheckout('stored-cohort-id');
      const params = new URLSearchParams('cohort=url-cohort-id');

      const resolved = resolveTargetCohortId(params);
      expect(resolved).toBe('url-cohort-id');
    });

    it('falls back to storage when URL query param is missing', () => {
      setPendingCohortCheckout('stored-cohort-id');
      const params = new URLSearchParams('');

      const resolved = resolveTargetCohortId(params);
      expect(resolved).toBe('stored-cohort-id');
    });

    it('constructs complete redirect URL with cohort and checkout flags', () => {
      const url = buildCohortRedirectUrl('/student/dashboard', 'c-uuid-999', true);
      expect(url).toContain('/student/dashboard?cohort=c-uuid-999&checkout=true');
    });

    it('expires and purges stale pending selections older than 24 hours', () => {
      const staleData = {
        cohortId: 'stale-cohort',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      localStorage.setItem(PENDING_COHORT_STORAGE_KEY, JSON.stringify(staleData));

      expect(getPendingCohortCheckout()).toBeNull();
      expect(localStorage.getItem(PENDING_COHORT_STORAGE_KEY)).toBeNull();
    });
  });

  describe('2. Signup Flow (Register.tsx) With Selected Cohort', () => {
    it('preserves selected cohort from URL query, displays reservation banner, and sets emailRedirectTo', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'editor@example.com', identities: [{ id: 'usr-1' }] },
          session: null,
        },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/register?cohort=c-uuid-999']}>
          <Register />
        </MemoryRouter>
      );

      // Verify reservation indicator appears
      await waitFor(() => {
        expect(screen.getByText(/Joining Full-Stack Video Sprint Batch 15/i)).toBeInTheDocument();
        expect(screen.getByText(/Seat held during signup/i)).toBeInTheDocument();
      });

      // Verify selection is stored in localStorage
      expect(getPendingCohortCheckout()?.cohortId).toBe('c-uuid-999');

      // Submit registration form
      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Editor' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123456' } });

      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'editor@example.com',
          password: 'pass123456',
          options: {
            data: {
              full_name: 'Alex Editor',
              role: 'student',
              preferred_cohort_id: 'c-uuid-999',
            },
            emailRedirectTo: expect.stringContaining('/student/dashboard?cohort=c-uuid-999&checkout=true'),
          },
        });
      });

      // Verify email confirmation view shows return instructions for the selected cohort
      await waitFor(() => {
        expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
        expect(screen.getByText(/You will return directly to checkout for/i)).toBeInTheDocument();
      });
    });

    it('passes preserved cohort in resend confirmation verification', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'editor@example.com', identities: [{ id: 'usr-1' }] },
          session: null,
        },
        error: null,
      });

      (supabase.auth.resend as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/register?cohort=c-uuid-999']}>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Editor' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Confirm your email/i)).toBeInTheDocument();
      });

      // Click resend
      fireEvent.click(screen.getByRole('button', { name: /Resend verification email/i }));

      await waitFor(() => {
        expect(supabase.auth.resend).toHaveBeenCalledWith({
          type: 'signup',
          email: 'editor@example.com',
          options: {
            emailRedirectTo: expect.stringContaining('/student/dashboard?cohort=c-uuid-999&checkout=true'),
          },
        });
      });
    });

    it('routes immediately to checkout if session is granted directly', async () => {
      (supabase.auth.signUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'editor@example.com', identities: [{ id: 'usr-1' }] },
          session: { access_token: 'fake-token' },
        },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/register?cohort=c-uuid-999']}>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Editor' } });
      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard?cohort=c-uuid-999&checkout=true');
      });
    });
  });

  describe('3. Login Flow (Login.tsx) Returning to Checkout', () => {
    it('displays cohort checkout reminder and routes student to checkout upon successful login', async () => {
      (supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'editor@example.com' },
        },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'student' } }),
      });

      render(
        <MemoryRouter initialEntries={['/login?cohort=c-uuid-999']}>
          <Login />
        </MemoryRouter>
      );

      // Verify reservation indicator appears in Login
      await waitFor(() => {
        expect(screen.getByText(/Checkout: Full-Stack Video Sprint Batch 15/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard?cohort=c-uuid-999&checkout=true');
      });
    });

    it('uses stored pending cohort when URL query is absent on Login page', async () => {
      setPendingCohortCheckout('c-uuid-999', 'Full-Stack Video Sprint Batch 15', 4999, 'INR');

      (supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'editor@example.com' },
        },
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'student' } }),
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'editor@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Log in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard?cohort=c-uuid-999&checkout=true');
      });
    });
  });

  describe('4. EnrollmentPanel Pre-selection & Returning to Checkout', () => {
    it('automatically selects preserved cohort and enables checkout button', async () => {
      const onEnrolled = vi.fn();

      render(
        <EnrollmentPanel
          userId="usr-1"
          userEmail="editor@example.com"
          userName="Alex Editor"
          initialCohortId="c-uuid-999"
          onEnrolled={onEnrolled}
        />
      );

      // Wait for cohorts to load and confirm selection is preserved
      await waitFor(() => {
        expect(screen.getByText(/Full-Stack Video Sprint Batch 15/i)).toBeInTheDocument();
        expect(screen.getByText(/Proceed to Checkout \(₹4,999 INR\)/i)).toBeInTheDocument();
      });

      const checkoutBtn = screen.getByRole('button', { name: /Proceed to Checkout/i });
      expect(checkoutBtn).not.toBeDisabled();

      fireEvent.click(checkoutBtn);

      await waitFor(() => {
        expect(paymentService.startCohortCheckout).toHaveBeenCalledWith(
          expect.objectContaining({
            cohortId: 'c-uuid-999',
            cohortName: 'Full-Stack Video Sprint Batch 15',
            userEmail: 'editor@example.com',
            userName: 'Alex Editor',
          })
        );
      });
    });

    it('triggers autoCheckout directly if autoCheckout prop is true and clears storage upon success', async () => {
      setPendingCohortCheckout('c-uuid-999', 'Full-Stack Video Sprint Batch 15', 4999, 'INR');
      const onEnrolled = vi.fn();

      (paymentService.startCohortCheckout as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async (params: paymentService.CohortCheckoutParams) => {
          params.onSuccess('enr_123');
        }
      );

      render(
        <EnrollmentPanel
          userId="usr-1"
          userEmail="editor@example.com"
          userName="Alex Editor"
          initialCohortId="c-uuid-999"
          autoCheckout={true}
          onEnrolled={onEnrolled}
        />
      );

      await waitFor(() => {
        expect(paymentService.startCohortCheckout).toHaveBeenCalledWith(
          expect.objectContaining({
            cohortId: 'c-uuid-999',
          })
        );
        expect(onEnrolled).toHaveBeenCalled();
      });

      // Clear storage
      clearPendingCohortCheckout();
      expect(getPendingCohortCheckout()).toBeNull();
    });
  });
});
