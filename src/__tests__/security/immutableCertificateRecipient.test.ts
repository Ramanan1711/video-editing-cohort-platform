import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicCertificate, verifyCertificateEligibility } from '../../lib/services/certificateService';
import { supabase } from '../../lib/supabaseClient';

describe('Security Audit: Soulbound & Immutable Certificate Recipient Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves original frozen recipient name on public verification even if profile name is changed', async () => {
    const issuedCredentialNumber = 'CC-202611-ALICE01';
    const originalRecipientName = 'Alice Cooper';
    const mutatedProfileName = 'Bob Smith (Friend)';

    // Mock RPC returning null (or not configured) so it falls back to public table query
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'RPC not available' },
    } as any);

    // Mock certificates table query returning the frozen recipient_name column
    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'certificates') {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'cert-123',
                  certificate_number: issuedCredentialNumber,
                  recipient_name: originalRecipientName, // Frozen at issuance
                  issued_at: '2026-11-01T12:00:00Z',
                  student_id: 'alice-student-id',
                  cohort_id: 'cohort-video-masterclass',
                  metadata: { student_name: originalRecipientName },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { full_name: mutatedProfileName }, // Altered profile name
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cohorts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: 'Full Video Production Cohort' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    }) as any);

    const publicCert = await getPublicCertificate(issuedCredentialNumber);

    expect(publicCert).not.toBeNull();
    // CRITICAL SECURITY ASSERTION:
    // Even though profiles.full_name was altered to 'Bob Smith (Friend)',
    // the public credential verifier MUST display the frozen recipient 'Alice Cooper'.
    expect(publicCert?.student_name).toBe(originalRecipientName);
    expect(publicCert?.recipient_name).toBe(originalRecipientName);
    expect(publicCert?.student_name).not.toBe(mutatedProfileName);
  });

  it('reads frozen recipient_name from RPC verify_certificate_authenticity when available', async () => {
    const issuedCredentialNumber = 'CC-202611-ALICE02';
    const originalRecipientName = 'Alice Cooper';

    // Mock RPC returning structured verified authenticity record
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        {
          is_valid: true,
          certificate_id: 'cert-456',
          certificate_number: issuedCredentialNumber,
          recipient_name: originalRecipientName,
          student_name: originalRecipientName,
          cohort_name: 'Documentary Editing Intensive',
          issued_at: '2026-11-02T10:00:00Z',
          completed_date: '2026-11-02T10:00:00Z',
        },
      ],
      error: null,
    } as any);

    const publicCert = await getPublicCertificate(issuedCredentialNumber);

    expect(publicCert).not.toBeNull();
    expect(publicCert?.student_name).toBe(originalRecipientName);
    expect(publicCert?.recipient_name).toBe(originalRecipientName);
  });

  it('returns frozen recipient_name in eligibility check for already issued certificates', async () => {
    // When verify_and_issue_certificate RPC is invoked for an already issued certificate,
    // it must return the frozen recipient_name rather than generating a new one
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: {
        eligible: true,
        already_issued: true,
        certificate_number: 'CC-202611-LOCKED01',
        recipient_name: 'Alice Cooper',
        issued_at: '2026-11-01T12:00:00Z',
        completed_lessons: 10,
        total_lessons: 10,
        approved_assignments: 2,
        total_assignments: 2,
        completed_challenges: 10,
        total_challenges: 10,
        attended_sessions: 2,
        total_sessions: 2,
        attendance_rate_pct: 100,
        min_attendance_pct: 75,
      },
      error: null,
    } as any);

    const result = await verifyCertificateEligibility('alice-student-id', 'cohort-1', 'Bob Smith (Friend)');

    expect(result.already_issued).toBe(true);
    expect(result.certificate_number).toBe('CC-202611-LOCKED01');
    // Even if student passes a different legalName parameter, the already issued certificate keeps Alice Cooper
    expect(result.recipient_name).toBe('Alice Cooper');
  });
});
