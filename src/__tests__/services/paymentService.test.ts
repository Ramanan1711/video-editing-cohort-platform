import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_COHORT_FEE_INR,
  DEFAULT_CURRENCY,
  createCohortRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayScript,
  startCohortCheckout,
} from '../../lib/paymentService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('paymentService (Razorpay INR Payments - Fail-Closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses standard INR defaults (₹4,999 and INR currency)', () => {
    expect(DEFAULT_COHORT_FEE_INR).toBe(4999);
    expect(DEFAULT_CURRENCY).toBe('INR');
  });

  it('creates a Razorpay order using only cohortId via edge function', async () => {
    const mockOrderResponse = {
      orderId: 'order_test_123',
      amount: 499900,
      currency: 'INR',
      keyId: 'rzp_live_test_key',
      cohortTitle: 'Video Editing Masterclass',
    };

    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockOrderResponse,
      error: null,
    });

    const order = await createCohortRazorpayOrder('cohort-abc-123');
    expect(order.id).toBe('order_test_123');
    expect(order.amount).toBe(499900);
    expect(order.currency).toBe('INR');
    expect(order.keyId).toBe('rzp_live_test_key');
    expect(order.cohortTitle).toBe('Video Editing Masterclass');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-razorpay-order', {
      body: { cohortId: 'cohort-abc-123' },
    });
  });

  it('fails closed and throws error if order creation edge function fails', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Cohort capacity reached' },
    });

    await expect(createCohortRazorpayOrder('cohort-full-123')).rejects.toThrow(
      'Cohort capacity reached'
    );
  });

  it('fails closed and throws if order creation network rejects', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network offline')
    );

    await expect(createCohortRazorpayOrder('cohort-abc')).rejects.toThrow('Network offline');
  });

  it('verifies payment signature through edge function and confirms enrollment', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, verified: true, enrollmentId: 'enrollment-test-789' },
      error: null,
    });

    const result = await verifyRazorpayPayment(
      {
        razorpay_payment_id: 'pay_test_001',
        razorpay_order_id: 'order_test_123',
        razorpay_signature: 'sig_valid_hex',
      },
      'cohort-abc'
    );

    expect(result.success).toBe(true);
    expect(result.enrollmentId).toBe('enrollment-test-789');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('verify-razorpay-payment', {
      body: {
        orderId: 'order_test_123',
        paymentId: 'pay_test_001',
        signature: 'sig_valid_hex',
        cohortId: 'cohort-abc',
      },
    });
  });

  it('fails closed and throws error if payment verification is invalid or rejected', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: false, verified: false, error: 'Signature verification failed' },
      error: null,
    });

    await expect(
      verifyRazorpayPayment(
        {
          razorpay_payment_id: 'pay_tampered_002',
          razorpay_order_id: 'order_test_123',
          razorpay_signature: 'sig_invalid_hex',
        },
        'cohort-abc'
      )
    ).rejects.toThrow('Signature verification failed');
  });

  it('fails closed if payment verification edge function returns a network error', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Verification server unreachable')
    );

    await expect(
      verifyRazorpayPayment(
        {
          razorpay_payment_id: 'pay_test_003',
          razorpay_order_id: 'order_test_333',
          razorpay_signature: 'sig_test',
        },
        'cohort-abc'
      )
    ).rejects.toThrow('Verification server unreachable');
  });

  it('fails closed and rejects if payment is authorized but uncaptured', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: false, verified: false, error: 'Payment is not captured. Current payment status is authorized.' },
      error: null,
    });

    await expect(
      verifyRazorpayPayment(
        {
          razorpay_payment_id: 'pay_auth_only',
          razorpay_order_id: 'order_123',
          razorpay_signature: 'sig_auth',
        },
        'cohort-abc'
      )
    ).rejects.toThrow('Payment is not captured');
  });

  it('fails closed and rejects if payment amount does not match authoritative cohort price', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        success: false,
        verified: false,
        error: 'Payment amount (100000 paise) does not match required cohort fee (499900 paise)',
      },
      error: null,
    });

    await expect(
      verifyRazorpayPayment(
        {
          razorpay_payment_id: 'pay_underpaid',
          razorpay_order_id: 'order_underpaid',
          razorpay_signature: 'sig_underpaid',
        },
        'cohort-abc'
      )
    ).rejects.toThrow('does not match required cohort fee');
  });

  it('detects existing window.Razorpay when loading script', async () => {
    (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {};
    const loaded = await loadRazorpayScript();
    expect(loaded).toBe(true);
  });

  it('orchestrates checkout flow with startCohortCheckout and opens modal', async () => {
    const openMock = vi.fn();
    (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {
      open = openMock;
    };

    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        orderId: 'order_flow_123',
        amount: 499900,
        currency: 'INR',
        keyId: 'rzp_test_key_1',
      },
      error: null,
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await startCohortCheckout({
      cohortId: 'cohort-100',
      cohortName: 'Advanced Motion Design',
      userEmail: 'student@example.com',
      userName: 'Jane Doe',
      onSuccess,
      onError,
    });

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('startCohortCheckout invokes onError when order creation fails', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Server error')
    );

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await startCohortCheckout({
      cohortId: 'cohort-fail',
      cohortName: 'Failed Cohort',
      onSuccess,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('strictly routes through edge functions and never calls record_successful_payment_and_enroll directly from client', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, verified: true, enrollmentId: 'enrollment-secure-123' },
      error: null,
    });

    await verifyRazorpayPayment(
      {
        razorpay_order_id: 'order_test_secure',
        razorpay_payment_id: 'pay_test_secure',
        razorpay_signature: 'sig_test_secure',
      },
      'cohort-test-secure'
    );

    // Assert it called the edge function
    expect(supabase.functions.invoke).toHaveBeenCalledWith('verify-razorpay-payment', expect.any(Object));

    // Verify client never attempted to call the privileged RPC directly
    const rpcMock = (supabase as unknown as { rpc?: ReturnType<typeof vi.fn> }).rpc;
    if (rpcMock) {
      expect(rpcMock).not.toHaveBeenCalledWith('record_successful_payment_and_enroll', expect.anything());
    }
  });
});
