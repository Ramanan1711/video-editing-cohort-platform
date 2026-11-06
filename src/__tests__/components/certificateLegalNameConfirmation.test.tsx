import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CertificateModal } from '../../components/CertificateModal';
import * as courseService from '../../lib/courseService';
import { supabase } from '../../lib/supabaseClient';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  }),
}));

vi.mock('../../lib/courseService', async () => {
  const actual = await vi.importActual<typeof courseService>('../../lib/courseService');
  return {
    ...actual,
    verifyCertificateEligibility: vi.fn(),
  };
});

describe('Issue 8: Certificate Legal Name Confirmation & Edit Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.className = '';
  });

  const mockNotYetIssuedResult = {
    eligible: true,
    already_issued: false,
    certificate_number: undefined,
    completed_lessons: 10,
    total_lessons: 10,
    approved_assignments: 2,
    total_assignments: 2,
    completed_challenges: 15,
    total_challenges: 15,
    attended_sessions: 2,
    total_sessions: 2,
    attendance_rate_pct: 100,
  };

  const mockEligibleResult = {
    eligible: true,
    already_issued: true,
    certificate_number: 'CC-202611-CONFIRM01',
    recipient_name: 'Alex Vance',
    issued_at: '2026-11-01T00:00:00Z',
    completed_lessons: 10,
    total_lessons: 10,
    approved_assignments: 2,
    total_assignments: 2,
    completed_challenges: 15,
    total_challenges: 15,
    attended_sessions: 2,
    total_sessions: 2,
    attendance_rate_pct: 100,
  };

  it('prompts student to confirm legal name before initial certificate issuance when studentName is placeholder', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockNotYetIssuedResult);

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Student"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
      />
    );

    // Wait for eligibility verification
    await waitFor(() => {
      expect(screen.getByText('Confirm Your Legal Name')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Please confirm your official legal name as it should permanently appear/i)
    ).toBeInTheDocument();

    const input = screen.getByLabelText(/full legal name/i);
    expect(input).toBeInTheDocument();
    // Default placeholder should be cleared for input
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('validates legal name input and rejects empty or placeholder names', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockNotYetIssuedResult);

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Student"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Confirm Your Legal Name')).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/full legal name/i);

    // 1. Try single letter
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.submit(screen.getByRole('button', { name: /confirm & view certificate/i }));

    expect(
      await screen.findByText(/Please enter your full legal name \(minimum 2 characters\)/i)
    ).toBeInTheDocument();

    // 2. Try generic placeholder
    fireEvent.change(input, { target: { value: 'Verified Graduate' } });
    fireEvent.submit(screen.getByRole('button', { name: /confirm & view certificate/i }));

    expect(
      await screen.findByText(/Please provide your official legal name rather than a placeholder/i)
    ).toBeInTheDocument();
  });

  it('saves legal name to Supabase profiles and verifies credential before permanent locking', async () => {
    vi.mocked(courseService.verifyCertificateEligibility)
      .mockResolvedValueOnce(mockNotYetIssuedResult)
      .mockResolvedValueOnce({
        ...mockEligibleResult,
        recipient_name: 'Maya Lin',
      });

    const updateSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any);

    const onUpdateStudentName = vi.fn();

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Student"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
        onUpdateStudentName={onUpdateStudentName}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Confirm Your Legal Name')).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/full legal name/i);
    fireEvent.change(input, { target: { value: 'Maya Lin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm & view certificate/i }));

    await waitFor(() => {
      expect(screen.queryByText('Confirm Your Legal Name')).not.toBeInTheDocument();
    });

    expect(updateSpy).toHaveBeenCalledWith('profiles');
    expect(onUpdateStudentName).toHaveBeenCalledWith('Maya Lin');
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Legal name successfully verified')
    );

    // Certificate now displays verified legal name and is permanently locked
    await waitFor(() => {
      expect(screen.getByText('Maya Lin')).toBeInTheDocument();
      expect(screen.getByText('Verified Recipient')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit legal name/i })).not.toBeInTheDocument();
    });
  });

  it('renders certificate directly with Verified Recipient lock and hides Edit button once issued', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Alex Vance"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Vance').length).toBeGreaterThanOrEqual(1);
    });

    // Confirmation prompt should NOT be open
    expect(screen.queryByText('Confirm Your Legal Name')).not.toBeInTheDocument();
    // Tamper-proof Verified Recipient badge is displayed
    expect(screen.getByText('Verified Recipient')).toBeInTheDocument();
    // Edit Legal Name button MUST BE HIDDEN to prevent re-issuing credentials to third parties
    expect(screen.queryByRole('button', { name: /edit legal name/i })).not.toBeInTheDocument();
  });

  it('displays administrative correction policy note on issued certificates', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Alex Vance"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/permanently registered in public ledger/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/support@iunoware.com/i)).toBeInTheDocument();
  });

  it('calls onClose if student cancels the mandatory initial name confirmation', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockNotYetIssuedResult);
    const onClose = vi.fn();

    render(
      <CertificateModal
        isOpen={true}
        onClose={onClose}
        studentName="Student"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Confirm Your Legal Name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
