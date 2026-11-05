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

  const mockEligibleResult = {
    eligible: true,
    already_issued: true,
    certificate_number: 'CC-202611-CONFIRM01',
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

  it('prompts student to confirm legal name when studentName defaults to "Student"', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

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
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

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

  it('saves legal name to Supabase profiles, notifies parent, and renders certificate with new legal name', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

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

    // Certificate now displays verified legal name
    expect(screen.getByText('Maya Lin')).toBeInTheDocument();
    // Edit Legal Name button is accessible
    expect(screen.getByRole('button', { name: /edit legal name/i })).toBeInTheDocument();
  });

  it('renders certificate directly without prompt when student already has a valid legal name', async () => {
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
    expect(screen.getByRole('button', { name: /edit legal name/i })).toBeInTheDocument();
  });

  it('allows student with existing name to open Edit Legal Name and update it', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

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
        studentName="Alex Vance"
        cohortName="Masterclass Cohort"
        cohortId="cohort-1"
        studentId="student-1"
        onUpdateStudentName={onUpdateStudentName}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Vance').length).toBeGreaterThanOrEqual(1);
    });

    // Click Edit Legal Name button
    fireEvent.click(screen.getByRole('button', { name: /edit legal name/i }));

    expect(screen.getByText('Confirm Your Legal Name')).toBeInTheDocument();
    const input = screen.getByLabelText(/full legal name/i) as HTMLInputElement;
    expect(input.value).toBe('Alex Vance');

    // Change to full legal name
    fireEvent.change(input, { target: { value: 'Alexander Vance' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm & view certificate/i }));

    await waitFor(() => {
      expect(screen.queryByText('Confirm Your Legal Name')).not.toBeInTheDocument();
    });

    expect(updateSpy).toHaveBeenCalledWith('profiles');
    expect(onUpdateStudentName).toHaveBeenCalledWith('Alexander Vance');
    await waitFor(() => {
      expect(screen.getAllByText('Alexander Vance').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls onClose if student cancels the mandatory initial name confirmation', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);
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
