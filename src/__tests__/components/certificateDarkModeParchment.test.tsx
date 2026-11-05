import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CertificateModal } from '../../components/CertificateModal';
import * as courseService from '../../lib/courseService';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
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

describe('Certificate Parchment Preservation in Dark Mode', () => {
  const mockEligibleResult = {
    eligible: true,
    already_issued: true,
    certificate_number: 'CC-202611-DARKMODE1',
    issued_at: '2026-11-05T00:00:00Z',
    completed_lessons: 12,
    total_lessons: 12,
    approved_assignments: 3,
    total_assignments: 3,
    completed_challenges: 10,
    total_challenges: 10,
    attended_sessions: 4,
    total_sessions: 4,
    attendance_rate_pct: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
    document.body.className = '';
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.body.className = '';
  });

  it('renders certificate parchment with dark mode isolation styles when dark mode is enabled', async () => {
    document.documentElement.classList.add('dark');
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce(mockEligibleResult);

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        studentName="Maya Lin"
        cohortName="Cinematic Post-Production Sprint"
        cohortId="cohort-123"
        studentId="student-456"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Certificate of Completion')).toBeInTheDocument();
    });

    const certPrintArea = document.getElementById('certificate-print-area');
    expect(certPrintArea).toBeInTheDocument();
    expect(certPrintArea).toHaveClass('bg-[#fffdfa]');

    // Confirm all diploma components are mounted inside the parchment
    expect(screen.getByText('IUNOWARE ACADEMY OF POST-PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('This certificate is proudly conferred upon')).toBeInTheDocument();
    expect(screen.getByText('Maya Lin')).toBeInTheDocument();
    expect(screen.getByText('Cinematic Post-Production Sprint')).toBeInTheDocument();
    expect(screen.getByText('Alex Vance')).toBeInTheDocument();
    expect(screen.getByText('Sarah Lin')).toBeInTheDocument();
    expect(screen.getByText(/CC-202611-DARKMODE1/)).toBeInTheDocument();

    // Verify scoped styles are present in document defining dark parchment preservation
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent || '');
    const hasParchmentPreservation = styles.some((s) => s.includes('.dark #certificate-print-area'));
    expect(hasParchmentPreservation).toBe(true);
  });
});

