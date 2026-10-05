import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleRazorpayWebhook,
  verifyWebhookSignature,
} from '../../lib/razorpayWebhookHandler';
import { SupabaseClient } from '@supabase/supabase-js';

const TEST_SECRET = 'whsec_test_secret_abc123';

/** Helper to generate valid HMAC-SHA256 signature for test payloads */
async function generateTestSignature(rawBody: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Razorpay Webhook Hardening & Verification (Problem 2)', () => {
  let mockSupabase: Partial<SupabaseClient>;
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;
  let mockSingle: ReturnType<typeof vi.fn>;
  let mockCohortSingle: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSingle = vi.fn();
    mockCohortSingle = vi.fn().mockResolvedValue({
      data: { id: 'cohort-uuid-1', price_inr: 4999 },
      error: null,
    });
    mockEq = vi.fn(() => ({ single: mockSingle }));
    mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockRpc = vi.fn();

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'cohorts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: mockCohortSingle,
              })),
            })),
          };
        }
        return {
          select: mockSelect,
        };
      }) as unknown as SupabaseClient['from'],
      rpc: mockRpc as unknown as SupabaseClient['rpc'],
    };
  });

  describe('1. Secret Configuration & Fail-Closed Gate', () => {
    it('rejects with 500 when webhook secret is missing (undefined)', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: undefined,
        signature: 'sig_123',
        rawBody,
      });

      expect(result.status).toBe(500);
      expect(result.data.error).toContain('Webhook secret is not configured');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 500 when webhook secret is empty or whitespace', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: '   ',
        signature: 'sig_123',
        rawBody,
      });

      expect(result.status).toBe(500);
      expect(result.data.error).toContain('Webhook secret is not configured');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('2. Webhook Signature Cryptographic Verification', () => {
    it('rejects with 401 when signature header is missing or empty', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature: '',
        rawBody,
      });

      expect(result.status).toBe(401);
      expect(result.data.error).toContain('Missing webhook signature header');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature is invalid or forged', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature: 'bad_forged_hex_signature',
        rawBody,
      });

      expect(result.status).toBe(401);
      expect(result.data.error).toBe('Invalid webhook signature');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('validates correct signature using exact raw body', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
      const validSig = await generateTestSignature(rawBody, TEST_SECRET);

      const isValid = await verifyWebhookSignature(rawBody, TEST_SECRET, validSig);
      expect(isValid).toBe(true);
    });

    it('rejects signature if raw body differs by even one whitespace', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
      const tamperedBody = rawBody + ' ';
      const validSig = await generateTestSignature(rawBody, TEST_SECRET);

      const isValid = await verifyWebhookSignature(tamperedBody, TEST_SECRET, validSig);
      expect(isValid).toBe(false);
    });
  });

  describe('3. Event Filtering & Payload Validation', () => {
    it('safely acknowledges non-capture events without invoking enrollment', async () => {
      const rawBody = JSON.stringify({ event: 'payment.failed', id: 'evt_failed_01' });
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(200);
      expect(result.data.received).toBe(true);
      expect(result.data.ignored).toBe(true);
      expect(result.data.eventType).toBe('payment.failed');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 400 when payload is missing order_id or payment_id', async () => {
      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { amount: 499900 } } },
      });
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('Missing order_id or payment_id');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('4. Authoritative Stored Order & Payment Attempt Validation', () => {
    const validEventPayload = {
      event: 'payment.captured',
      id: 'evt_captured_999',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_999',
            order_id: 'order_rzp_777',
            amount: 499900,
            currency: 'INR',
            notes: {
              cohort_id: 'cohort-uuid-1',
              user_id: 'user-uuid-1',
            },
          },
        },
      },
    };

    it('rejects with 404 when order is not found in stored payment records (fabricated event)', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Database returns not found
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Row not found' } });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(404);
      expect(result.data.error).toBe('Order not found in stored payment records');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 403 when user_id does not match stored order', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Stored order has different user_id
      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'different-user-uuid',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(403);
      expect(result.data.error).toBe('User mismatch for stored order');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 400 when cohort_id does not match stored order', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Stored order has different cohort_id
      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'different-cohort-uuid',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toBe('Cohort mismatch for stored order');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects with 400 when amount does not match stored order (spoofed underpayment)', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Stored order requires 499900 paise, but order row in DB was different
      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 999900, // DB expected 999900
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toBe('Payment amount mismatch for stored order');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('acknowledges idempotently with 200 when order was already captured', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Order already captured
      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'captured',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(200);
      expect(result.data.already_processed).toBe(true);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('successfully calls record_successful_payment_and_enroll when all authoritative checks match', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Legitimate stored order
      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          payment_id: 'pay_rzp_999',
          enrollment_id: 'user-uuid-1_cohort-uuid-1',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.payment_id).toBe('pay_rzp_999');
      expect(result.data.enrollment_id).toBe('user-uuid-1_cohort-uuid-1');

      expect(mockRpc).toHaveBeenCalledWith('record_successful_payment_and_enroll', {
        p_order_id: 'order_rzp_777',
        p_payment_id: 'pay_rzp_999',
        p_signature: signature,
        p_cohort_id: 'cohort-uuid-1',
        p_user_id: 'user-uuid-1',
        p_amount: 499900,
        p_currency: 'INR',
        p_metadata: expect.objectContaining({
          source: 'razorpay_webhook',
          event_type: 'payment.captured',
        }),
      });
    });

    it('fails closed with 500 if database RPC reports an error', async () => {
      const rawBody = JSON.stringify(validEventPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' },
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(500);
      expect(result.data.error).toBe('Database constraint violation');
    });
  });

  describe('5. Authoritative Capture and Amount Validation (Problem 3)', () => {
    it('rejects authorized-but-uncaptured payment even if signature is valid', async () => {
      const uncapturedPayload = {
        event: 'payment.captured',
        id: 'evt_auth_only',
        payload: {
          payment: {
            entity: {
              id: 'pay_auth_only',
              order_id: 'order_rzp_777',
              amount: 499900,
              currency: 'INR',
              status: 'authorized',
              captured: false,
              notes: {
                cohort_id: 'cohort-uuid-1',
                user_id: 'user-uuid-1',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(uncapturedPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('not captured');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects wrong-amount payment where paid amount is less than authoritative cohort fee', async () => {
      // Example: Student pays ₹1,000 (100000 paise) for a cohort priced at ₹5,000 (500000 paise)
      const underpaidPayload = {
        event: 'payment.captured',
        id: 'evt_underpaid',
        payload: {
          payment: {
            entity: {
              id: 'pay_underpaid',
              order_id: 'order_rzp_777',
              amount: 100000, // ₹1,000 in paise
              currency: 'INR',
              status: 'captured',
              captured: true,
              notes: {
                cohort_id: 'cohort-uuid-1',
                user_id: 'user-uuid-1',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(underpaidPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      // Order in DB was created for 100000 paise, but cohort price in cohorts table is ₹5,000 (500000 paise)
      mockSingle.mockResolvedValueOnce({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 100000,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      mockCohortSingle.mockResolvedValueOnce({
        data: {
          id: 'cohort-uuid-1',
          price_inr: 5000, // authoritative price is ₹5,000 (500000 paise)
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('does not meet authoritative cohort price');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects webhook when cohort price is zero or invalid under paid-only policy', async () => {
      const freePayload = {
        event: 'payment.captured',
        id: 'evt_free_777',
        payload: {
          payment: {
            entity: {
              id: 'pay_free_777',
              order_id: 'order_free_777',
              amount: 0,
              currency: 'INR',
              status: 'captured',
              captured: true,
              notes: {
                cohort_id: 'cohort-uuid-free',
                user_id: 'user-uuid-1',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(freePayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      mockSingle.mockResolvedValueOnce({
        data: {
          order_id: 'order_free_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-free',
          amount: 0,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      mockCohortSingle.mockResolvedValueOnce({
        data: {
          id: 'cohort-uuid-free',
          price_inr: 0,
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('Free enrollment is prohibited');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects failed payment notification', async () => {
      const failedPayload = {
        event: 'payment.captured',
        id: 'evt_failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed',
              order_id: 'order_rzp_777',
              amount: 499900,
              currency: 'INR',
              status: 'failed',
              captured: false,
              notes: {
                cohort_id: 'cohort-uuid-1',
                user_id: 'user-uuid-1',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(failedPayload);
      const signature = await generateTestSignature(rawBody, TEST_SECRET);

      mockSingle.mockResolvedValue({
        data: {
          order_id: 'order_rzp_777',
          user_id: 'user-uuid-1',
          cohort_id: 'cohort-uuid-1',
          amount: 499900,
          currency: 'INR',
          status: 'created',
        },
        error: null,
      });

      const result = await handleRazorpayWebhook({
        supabase: mockSupabase as SupabaseClient,
        webhookSecret: TEST_SECRET,
        signature,
        rawBody,
      });

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('not captured');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
