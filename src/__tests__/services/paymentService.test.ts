import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_COHORT_FEE_INR,
  DEFAULT_CURRENCY,
  createCohortRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayScript,
  startCohortCheckout,
  cancelCohortCheckoutReservation,
} from '../../lib/paymentService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
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

  it('fails closed and throws error if cohort is free or zero-priced under paid-only policy', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Free enrollment is prohibited under the platform paid-only policy. Cohorts must have a valid positive price.' },
    });

    await expect(createCohortRazorpayOrder('cohort-free-zero')).rejects.toThrow(
      /Free enrollment is prohibited/i
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

  it('halts checkout and throws error if pending payment attempt cannot be recorded (Problem 4)', async () => {
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        error: 'Unable to initiate checkout: payment attempt could not be recorded in database.',
        details: 'Database connection failed',
      },
      error: null,
    });

    await expect(createCohortRazorpayOrder('cohort-unpersisted-123')).rejects.toThrow(
      'Unable to initiate checkout: payment attempt could not be recorded in database.'
    );
  });

  it('startCohortCheckout stops and never opens Razorpay modal if payment attempt is unpersisted', async () => {
    const openMock = vi.fn();
    (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {
      open = openMock;
    };

    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        error: 'Unable to initiate checkout: payment attempt could not be recorded in database.',
      },
      error: null,
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await startCohortCheckout({
      cohortId: 'cohort-db-error',
      cohortName: 'Failed DB Cohort',
      onSuccess,
      onError,
    });

    expect(openMock).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('payment attempt could not be recorded in database'),
      })
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  describe('Problem 5: Atomic Cohort Capacity & Race Condition Elimination', () => {
    it('halts checkout and throws error when cohort capacity is exhausted', async () => {
      (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          error: 'Cohort capacity reached. No seats currently available.',
        },
        error: null,
      });

      await expect(createCohortRazorpayOrder('cohort-full-123')).rejects.toThrow(
        'Cohort capacity reached. No seats currently available.'
      );
    });

    it('cancelCohortCheckoutReservation invokes cancel_cohort_checkout_reservation RPC with orderId', async () => {
      const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
      rpcMock.mockResolvedValue({
        data: { success: true, status: 'cancelled' },
        error: null,
      });

      const released = await cancelCohortCheckoutReservation('order_test_release_999');
      expect(released).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith('cancel_cohort_checkout_reservation', {
        p_order_id: 'order_test_release_999',
      });
    });

    it('cancelCohortCheckoutReservation returns false on missing orderId or RPC failure', async () => {
      const emptyResult = await cancelCohortCheckoutReservation('');
      expect(emptyResult).toBe(false);

      const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const failedResult = await cancelCohortCheckoutReservation('order_err');
      expect(failedResult).toBe(false);
    });

    it('releases reserved capacity when user dismisses the checkout modal', async () => {
      const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
      rpcMock.mockResolvedValue({
        data: { success: true, status: 'cancelled' },
        error: null,
      });

      let capturedOptions: { modal?: { ondismiss?: () => void } } | null = null;
      (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {
        constructor(options: { modal?: { ondismiss?: () => void } }) {
          capturedOptions = options;
        }
        open = vi.fn();
      };

      (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          orderId: 'order_dismiss_123',
          amount: 499900,
          currency: 'INR',
          keyId: 'rzp_test_key_1',
          paymentRecordId: 'resv_uuid_123',
        },
        error: null,
      });

      const onDismiss = vi.fn();
      await startCohortCheckout({
        cohortId: 'cohort-atomic-dismiss',
        cohortName: 'Dismiss Cohort',
        onSuccess: vi.fn(),
        onError: vi.fn(),
        onDismiss,
      });

      expect(capturedOptions).not.toBeNull();
      (capturedOptions as { modal?: { ondismiss?: () => void } } | null)?.modal?.ondismiss?.();

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith('cancel_cohort_checkout_reservation', {
        p_order_id: 'order_dismiss_123',
      });
    });

    it('releases reserved capacity when payment failure event is triggered', async () => {
      const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
      rpcMock.mockResolvedValue({
        data: { success: true, status: 'cancelled' },
        error: null,
      });

      let capturedFailedHandler: ((response: unknown) => void) | null = null;
      (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpay {
        open = vi.fn();
        on = (event: string, handler: (response: unknown) => void) => {
          if (event === 'payment.failed') {
            capturedFailedHandler = handler;
          }
        };
      };

      (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          orderId: 'order_failed_event_456',
          amount: 499900,
          currency: 'INR',
          keyId: 'rzp_test_key_1',
          paymentRecordId: 'resv_uuid_456',
        },
        error: null,
      });

      const onError = vi.fn();
      await startCohortCheckout({
        cohortId: 'cohort-atomic-failure',
        cohortName: 'Failure Cohort',
        onSuccess: vi.fn(),
        onError,
      });

      expect(capturedFailedHandler).not.toBeNull();
      (capturedFailedHandler as ((response: unknown) => void) | null)?.({
        error: { description: 'Card declined by issuing bank' },
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Card declined by issuing bank',
        })
      );
      expect(rpcMock).toHaveBeenCalledWith('cancel_cohort_checkout_reservation', {
        p_order_id: 'order_failed_event_456',
      });
    });

    it('blocks checkout with PRODUCTION PAYMENT SAFETY LOCK if test keys are used when PROD is true', async () => {
      const originalProd = import.meta.env.PROD;
      try {
        (import.meta.env as unknown as { PROD: boolean }).PROD = true;

        (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: {
            orderId: 'order_test_prod_123',
            amount: 499900,
            currency: 'INR',
            keyId: 'rzp_test_forbidden_in_prod',
          },
          error: null,
        });

        const onError = vi.fn();
        await startCohortCheckout({
          cohortId: 'cohort-prod-test',
          cohortName: 'Test Cohort',
          onSuccess: vi.fn(),
          onError,
        });

        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('PRODUCTION PAYMENT SAFETY LOCK'),
          })
        );
      } finally {
        (import.meta.env as unknown as { PROD: boolean }).PROD = originalProd;
      }
    });
  });
});
