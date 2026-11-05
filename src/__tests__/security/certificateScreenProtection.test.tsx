import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CertificateModal } from '../../components/CertificateModal';
import { isCertificateModalActive } from '../../lib/certificateProtectionHelper';
import { useScreenProtection } from '../../hooks/useScreenProtection';
import { usePortalScreenSecurity, CAPTURE_DETECTED_STORAGE_KEY } from '../../hooks/usePortalScreenSecurity';
import * as courseService from '../../lib/courseService';

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

describe('Issue 7: Certificate "Print / Save PDF" Screen Protection Suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.body.className = '';
    document.body.removeAttribute('data-certificate-modal-open');
    document.body.removeAttribute('data-printing-active');
  });

  afterEach(() => {
    sessionStorage.clear();
    document.body.className = '';
    document.body.removeAttribute('data-certificate-modal-open');
    document.body.removeAttribute('data-printing-active');
  });

  it('recognizes when CertificateModal is active via isCertificateModalActive()', () => {
    expect(isCertificateModalActive()).toBe(false);

    document.body.classList.add('certificate-modal-open');
    expect(isCertificateModalActive()).toBe(true);

    document.body.classList.remove('certificate-modal-open');
    document.body.setAttribute('data-certificate-modal-open', 'true');
    expect(isCertificateModalActive()).toBe(true);

    document.body.removeAttribute('data-certificate-modal-open');
    expect(isCertificateModalActive()).toBe(false);
  });

  it('suppresses Cmd+P / Ctrl+P restriction in useScreenProtection when CertificateModal is open', () => {
    document.body.classList.add('certificate-modal-open');

    const { result } = renderHook(() =>
      useScreenProtection({
        enabled: true,
        userEmail: 'student@example.com',
      })
    );

    // Simulate Cmd + P
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.restrictionReason).toBeNull();
    expect(sessionStorage.getItem('iunoware_capture_detected')).toBeNull();
  });

  it('triggers restriction on Cmd+P when CertificateModal is NOT open (standard video lesson protection)', () => {
    const { result } = renderHook(() =>
      useScreenProtection({
        enabled: true,
        userEmail: 'student@example.com',
      })
    );

    // Simulate Cmd + P without certificate modal
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.isRestricted).toBe(true);
    expect(result.current.restrictionReason).toBe('Page print / PDF export shortcut detected');
    expect(sessionStorage.getItem('iunoware_capture_detected')).toBe(
      'Page print / PDF export shortcut detected'
    );
  });

  it('suppresses capture shortcuts and PrintScreen while CertificateModal is open', () => {
    document.body.classList.add('certificate-modal-open');

    const { result: screenResult } = renderHook(() =>
      useScreenProtection({
        enabled: true,
        userEmail: 'student@example.com',
      })
    );
    renderHook(() => usePortalScreenSecurity());

    // 1. Simulate PrintScreen
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'PrintScreen',
          code: 'PrintScreen',
          cancelable: true,
          bubbles: true,
        })
      );
    });

    // 2. Simulate Cmd+Shift+4 (macOS screenshot)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '4',
          code: 'Digit4',
          metaKey: true,
          shiftKey: true,
          cancelable: true,
          bubbles: true,
        })
      );
    });

    expect(screenResult.current.isRestricted).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CAPTURE_DETECTED_STORAGE_KEY)).toBeNull();
  });

  it('prioritizes official Print/Save PDF credential export as the primary action', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce({
      eligible: true,
      already_issued: true,
      certificate_number: 'CC-202611-TEST001',
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
    });

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Alex Vance"
        cohortName="Kinetic Pacing Sprint"
        cohortId="c-123"
        studentId="s-456"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('CC-202611-TEST001')).toBeInTheDocument();
    });

    // Verify modal marked body with open attribute
    expect(document.body.classList.contains('certificate-modal-open')).toBe(true);
    expect(document.body.getAttribute('data-certificate-modal-open')).toBe('true');

    // Verify button hierarchy: Print / Save PDF is the primary button
    const printBtn = screen.getByRole('button', { name: /print \/ save pdf/i });
    expect(printBtn).toBeInTheDocument();
    expect(printBtn.className).toContain('bg-orange-500');

    // Redundant canvas PNG export button is eliminated to ensure visual fidelity
    const downloadPngBtn = screen.queryByRole('button', { name: /download certificate \(png\)/i });
    expect(downloadPngBtn).toBeNull();

    // Click Print button
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  it('handles Cmd+P inside CertificateModal by directly invoking window.print()', async () => {
    vi.mocked(courseService.verifyCertificateEligibility).mockResolvedValueOnce({
      eligible: true,
      already_issued: true,
      certificate_number: 'CC-202611-TEST002',
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
    });

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        studentName="Alex Vance"
        cohortName="Kinetic Pacing Sprint"
        cohortId="c-123"
        studentId="s-456"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('CC-202611-TEST002')).toBeInTheDocument();
    });

    // Press Cmd+P inside the modal
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(printSpy).toHaveBeenCalled();
  });
});
