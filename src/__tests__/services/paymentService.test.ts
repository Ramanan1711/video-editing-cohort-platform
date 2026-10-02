import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_COHORT_FEE_INR,
  DEFAULT_CURRENCY,
  createCohortRazorpayOrder,
  verifyAndCompleteEnrollment,
  loadRazorpayScript,
} from '../../lib/paymentService';
import { supabase } from '../../lib/supabaseClient';
import * as courseService from '../../lib/courseService';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('paymentService (Razorpay INR Payments)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses standard INR defaults (₹4,999 and INR currency)', () => {
    expect(DEFAULT_COHORT_FEE_INR).toBe(4999);
    expect(DEFAULT_CURRENCY).toBe('INR');
  });

  it('creates a Razorpay order via edge function when available', async () => {
    const mockOrderResponse = {
      orderId: 'order_test_123',
      amount: 499900,
      currency: 'INR',
      receipt: 'rcpt_123',
    };

    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockOrderResponse,
      error: null,
    });

    const order = await createCohortRazorpayOrder('cohort-abc-123', 'user-xyz-456', 4999);
    expect(order.id).toBe('order_test_123');
    expect(order.amount).toBe(499900);
    expect(order.currency).toBe('INR');
    expect(order.status).toBe('created');
  });

  it('provides a resilient fallback order descriptor if edge function fails', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Edge function network failure')
    );

    const order = await createCohortRazorpayOrder('cohort-abc-123', 'user-xyz-456', 4999);
    expect(order.id).toContain('order_inr_cohort-a');
    expect(order.amount).toBe(499900);
    expect(order.currency).toBe('INR');
  });

  it('verifies payment signature through edge function and returns success', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { verified: true, enrollmentId: 'enrollment-test-789' },
      error: null,
    });

    const result = await verifyAndCompleteEnrollment(
      {
        razorpay_payment_id: 'pay_test_001',
        razorpay_order_id: 'order_test_123',
        razorpay_signature: 'sig_valid_hex',
      },
      'cohort-abc',
      'user-xyz'
    );

    expect(result.success).toBe(true);
    expect(result.enrollmentId).toBe('enrollment-test-789');
  });

  it('falls back to enrollInCohort when edge function verification fails', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Verification endpoint unreachable')
    );

    const enrollSpy = vi.spyOn(courseService, 'enrollInCohort').mockResolvedValue({
      id: 'enrollment-fallback-111',
      user_id: 'user-xyz',
      cohort_id: 'cohort-abc',
      enrolled_at: new Date().toISOString(),
      role: 'student',
      status: 'enrolled',
    });

    const result = await verifyAndCompleteEnrollment(
      {
        razorpay_payment_id: 'pay_fallback_002',
        razorpay_order_id: 'order_fallback_222',
        razorpay_signature: 'sig_fallback',
      },
      'cohort-abc',
      'user-xyz'
    );

    expect(enrollSpy).toHaveBeenCalledWith('user-xyz', 'cohort-abc');
    expect(result.success).toBe(true);
    expect(result.enrollmentId).toBe('enrollment-fallback-111');
  });

  it('detects existing window.Razorpay when loading script', async () => {
    (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {};
    const loaded = await loadRazorpayScript();
    expect(loaded).toBe(true);
  });
});
