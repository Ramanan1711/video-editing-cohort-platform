import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VerifyCertificate } from '../../pages/VerifyCertificate';
import { CertificateModal } from '../../components/CertificateModal';
import * as courseService from '../../lib/courseService';

vi.mock('../../lib/courseService', async () => {
  const actual = await vi.importActual('../../lib/courseService');
  return {
    ...actual,
    getPublicCertificate: vi.fn(),
    verifyCertificateEligibility: vi.fn(),
  };
});

describe('Certificate Verification UI & Modal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VerifyCertificate Page', () => {
    it('renders empty search state when no certificate ID is passed', () => {
      render(
        <MemoryRouter initialEntries={['/verify-certificate']}>
          <Routes>
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Verify Academic Credential')).toBeDefined();
      expect(screen.getByPlaceholderText('Enter Credential ID (e.g. CC-202609-A8F2B1)')).toBeDefined();
      expect(screen.getByText('Ready for Verification')).toBeDefined();
    });

    it('verifies and displays authentic certificate with 4-pillar telemetry when query param is provided', async () => {
      vi.mocked(courseService.getPublicCertificate).mockResolvedValueOnce({
        valid: true,
        certificate_number: 'CC-202609-VALID99',
        student_name: 'Maya Lin',
        cohort_name: 'Summer 2026 Masterclass',
        issued_at: '2026-09-29T12:00:00Z',
        metadata: {
          total_lessons: 12,
          completed_lessons: 12,
          total_assignments: 3,
          approved_assignments: 3,
          total_challenges: 15,
          completed_challenges: 15,
          total_sessions: 4,
          attended_sessions: 4,
          attendance_rate_pct: 100,
        },
      });

      render(
        <MemoryRouter initialEntries={['/verify-certificate?id=CC-202609-VALID99']}>
          <Routes>
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Official Accredited Credential')).toBeDefined();
      });

      expect(screen.getByText('Maya Lin')).toBeDefined();
      expect(screen.getByText('Summer 2026 Masterclass')).toBeDefined();
      expect(screen.getByText('CC-202609-VALID99')).toBeDefined();
      expect(screen.getByText('4-Pillar Academic Telemetry')).toBeDefined();
      expect(screen.getByText('12 / 12')).toBeDefined();
      expect(screen.getByText('3 / 3')).toBeDefined();
      expect(screen.getByText('15 / 15')).toBeDefined();
      expect(screen.getByText('100%')).toBeDefined();
    });

    it('displays error notice when certificate ID is invalid or non-existent', async () => {
      vi.mocked(courseService.getPublicCertificate).mockResolvedValueOnce({
        valid: false,
        error: 'Certificate not found. The provided certificate number is invalid or has not been issued.',
      });

      render(
        <MemoryRouter initialEntries={['/verify-certificate?id=CC-INVALID']}>
          <Routes>
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Credential Record Not Found')).toBeDefined();
      });

      expect(screen.getByText(/The provided certificate number is invalid/)).toBeDefined();
    });

    it('triggers verification when submitting form manually', async () => {
      vi.mocked(courseService.getPublicCertificate).mockResolvedValueOnce({
        valid: true,
        certificate_number: 'CC-202609-SEARCHED',
        student_name: 'David Kim',
        cohort_name: 'Post-Production Cohort',
        issued_at: '2026-09-29T12:00:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/verify-certificate']}>
          <Routes>
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
          </Routes>
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText('Enter Credential ID (e.g. CC-202609-A8F2B1)');
      fireEvent.change(input, { target: { value: 'CC-202609-SEARCHED' } });

      const verifyButton = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(courseService.getPublicCertificate).toHaveBeenCalledWith('CC-202609-SEARCHED');
        expect(screen.getByText('David Kim')).toBeDefined();
      });
    });
  });

  describe('CertificateModal Canonical Certificate Numbers', () => {
    it('never displays synthetic unpersisted fake string like CC-COHORT-STUDENT', async () => {
      // Incomplete eligibility returns eligible: false with no certificate_number
      vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce({
        eligible: false,
        reason: 'Curriculum incomplete',
        completed_lessons: 5,
        total_lessons: 10,
        approved_assignments: 1,
        total_assignments: 2,
        completed_challenges: 5,
        total_challenges: 15,
        attended_sessions: 1,
        total_sessions: 2,
        attendance_rate_pct: 50,
      });

      render(
        <CertificateModal
          isOpen={true}
          onClose={() => {}}
          studentName="Jane Doe"
          cohortName="Editing Cohort 1"
          cohortId="c1111111-1111-1111-1111-111111111111"
          studentId="s2222222-2222-2222-2222-222222222222"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Certificate Requirements Incomplete')).toBeDefined();
      });

      // Assert that synthetic unpersisted fake number CC-C11111-S22222 is NEVER rendered in the document
      expect(screen.queryByText(/CC-C11111-S22222/i)).toBeNull();
    });

    it('renders authentic database-issued certificate number when eligible', async () => {
      vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce({
        eligible: true,
        already_issued: true,
        certificate_number: 'CC-202609-REAL999',
        issued_at: '2026-09-29T12:00:00Z',
        completed_lessons: 10,
        total_lessons: 10,
        approved_assignments: 2,
        total_assignments: 2,
        completed_challenges: 15,
        total_challenges: 15,
        attended_sessions: 2,
        total_sessions: 2,
        attendance_rate_pct: 100,
      });

      render(
        <CertificateModal
          isOpen={true}
          onClose={() => {}}
          studentName="Jane Doe"
          cohortName="Editing Cohort 1"
          cohortId="c1111111-1111-1111-1111-111111111111"
          studentId="s2222222-2222-2222-2222-222222222222"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('CC-202609-REAL999')).toBeDefined();
      });

      expect(screen.getByText('Verify Online')).toBeDefined();
      expect(screen.getByText(/Verify authentic credential at cutcraft.studio\/verify-certificate/)).toBeDefined();
    });
  });
});
