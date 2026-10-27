import { supabase } from './supabaseClient';
import { CreateOrderSchema, VerifyPaymentSchema } from './schemas/runtimeContracts';
import { checkCohortEnrollmentDeadline } from './studentAccessService';

export const DEFAULT_COHORT_FEE_INR = 4999;
export const DEFAULT_CURRENCY = 'INR';

/**
 * Authoritatively formats cohort price and currency for uniform display across landing, admin, and checkout.
 */
export function formatCohortPrice(priceInr?: number | null, currency?: string | null): string {
  const effectivePrice = priceInr ?? DEFAULT_COHORT_FEE_INR;
  const effectiveCurrency = currency ?? DEFAULT_CURRENCY;
  return `₹${effectivePrice.toLocaleString('en-IN')} ${effectiveCurrency}`;
}

/**
 * Returns authoritative pricing information for a cohort, falling back to canonical defaults.
 */
export function getAuthoritativeCohortPricing(cohort?: { price_inr?: number | null; currency?: string | null } | null) {
  const priceInr = cohort?.price_inr ?? DEFAULT_COHORT_FEE_INR;
  const currency = cohort?.currency ?? DEFAULT_CURRENCY;
  return {
    priceInr,
    currency,
    amountPaise: priceInr * 100,
    formatted: `₹${priceInr.toLocaleString('en-IN')}`,
    formattedWithCurrency: `₹${priceInr.toLocaleString('en-IN')} ${currency}`,
  };
}

export interface RazorpayOrder {
  id: string;
  amount: number; // in paise (e.g. 499900)
  currency: string;
  keyId: string;
  receipt?: string;
  cohortTitle?: string;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface CohortCheckoutParams {
  cohortId: string;
  cohortName: string;
  userEmail?: string;
  userName?: string;
  onSuccess: (enrollmentId: string) => void;
  onError: (error: Error) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

/**
 * Dynamically loads the Razorpay checkout script if not already present.
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Requests an order from the server using only the cohort ID.
 * The Supabase Edge Function reads the server-authoritative cohort price and returns order details.
 * Fail-closed: Never returns a fabricated local order on failure.
 */
export async function createCohortRazorpayOrder(cohortId: string): Promise<RazorpayOrder> {
  const validation = CreateOrderSchema.safeParse({ cohortId });
  if (!validation.success) {
    throw new Error('Cohort ID is required to initiate checkout.');
  }

  const validatedCohortId = validation.data.cohortId;

  // Pre-flight check: Verify cohort enrollment deadline (30 days before course end date)
  try {
    const { data: cohortData } = await supabase
      .from('cohorts')
      .select('end_date, start_date, duration_days, enrollment_end')
      .eq('id', validatedCohortId)
      .maybeSingle();

    if (cohortData) {
      const deadlineCheck = checkCohortEnrollmentDeadline(cohortData);
      if (deadlineCheck.isClosed) {
        throw new Error(deadlineCheck.reason || 'Enrollment for this cohort has closed.');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Admissions for this cohort closed')) {
      throw err;
    }
  }

  const correlationId = `corr_ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    cohortTitle?: string;
    error?: string | Record<string, unknown>;
  }>('create-razorpay-order', {
    body: { cohortId: validatedCohortId },
    headers: {
      'x-correlation-id': correlationId,
    },
  });

  if (error || !data || !data.orderId) {
    let errorMessage = error?.message || 'Failed to create payment order.';
    if (data?.error) {
      errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
    throw new Error(errorMessage);
  }

  return {
    id: data.orderId,
    amount: data.amount,
    currency: data.currency || DEFAULT_CURRENCY,
    keyId: data.keyId,
    cohortTitle: data.cohortTitle,
  };
}

/**
 * Verifies Razorpay payment signature server-side and confirms enrollment.
 * Fail-closed: Never falls back to direct client-side enrollment if verification fails.
 */
export async function verifyRazorpayPayment(
  paymentData: RazorpayPaymentResponse,
  cohortId: string
): Promise<{ success: boolean; enrollmentId: string }> {
  const validation = VerifyPaymentSchema.safeParse({
    orderId: paymentData.razorpay_order_id,
    paymentId: paymentData.razorpay_payment_id,
    signature: paymentData.razorpay_signature,
    cohortId,
  });

  if (!validation.success) {
    throw new Error('Incomplete payment response received from gateway.');
  }

  const { orderId, paymentId, signature, cohortId: validatedCohortId } = validation.data;
  const correlationId = `corr_ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    verified: boolean;
    enrollmentId?: string;
    error?: string | Record<string, unknown>;
  }>('verify-razorpay-payment', {
    body: {
      orderId,
      paymentId,
      signature,
      cohortId: validatedCohortId,
    },
    headers: {
      'x-correlation-id': correlationId,
    },
  });

  if (error || !data || !data.verified || !data.enrollmentId) {
    const errorMsg = data?.error || error?.message || 'Payment signature verification failed.';
    throw new Error(errorMsg);
  }

  return {
    success: true,
    enrollmentId: data.enrollmentId,
  };
}

/**
 * Immediately releases an uncompleted checkout reservation (Problem 5 remediation).
 * Ensures seats are freed right away without requiring the student to wait for the 15-minute TTL.
 */
export async function cancelCohortCheckoutReservation(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  try {
    const { data, error } = await supabase.rpc('cancel_cohort_checkout_reservation', {
      p_order_id: orderId,
    });
    if (error) {
      console.warn('Failed to release cohort checkout reservation:', error.message);
      return false;
    }
    return Boolean(data?.success);
  } catch (err) {
    console.warn('Error releasing checkout reservation:', err);
    return false;
  }
}

/**
 * Releases all expired checkout reservations platform-wide (Friction Point A).
 * Safely frees up seats whose 15-minute TTL has elapsed.
 */
export async function releaseExpiredCohortReservations(): Promise<number> {
  try {
    const res = typeof supabase?.rpc === 'function' ? await supabase.rpc('release_expired_cohort_reservations') : null;
    if (!res || res.error) {
      if (res?.error) {
        console.warn('Failed to release expired cohort reservations:', res.error.message);
      }
      return 0;
    }
    return typeof res.data === 'number' ? res.data : 0;
  } catch (err) {
    console.warn('Error releasing expired reservations:', err);
    return 0;
  }
}

/**
 * Returns the up-to-date remaining seat capacity for a cohort after triggering the expired reservation reaper.
 */
export async function getRemainingCohortSeats(cohortId: string): Promise<{
  capacity: number;
  enrolled: number;
  reserved: number;
  remaining: number;
}> {
  if (!cohortId) {
    return { capacity: 0, enrolled: 0, reserved: 0, remaining: 0 };
  }

  // Trigger reaper in background to clean any elapsed reservations
  void releaseExpiredCohortReservations();

  const [{ data: cohort }, { count: enrolledCount }, { count: reservedCount }] = await Promise.all([
    supabase.from('cohorts').select('capacity').eq('id', cohortId).single(),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', cohortId).in('status', ['enrolled', 'active']),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('cohort_id', cohortId).eq('status', 'created').gt('expires_at', new Date().toISOString()),
  ]);

  const capacity = cohort?.capacity ?? 30;
  const enrolled = enrolledCount ?? 0;
  const reserved = reservedCount ?? 0;
  const remaining = Math.max(0, capacity - enrolled - reserved);

  return { capacity, enrolled, reserved, remaining };
}

/**
 * Orchestrates the full paid checkout flow:
 * 1. Loads Razorpay script.
 * 2. Fetches server-authoritative order from Edge Function using only cohortId.
 * 3. Opens Razorpay Checkout modal.
 * 4. Calls server-side verification upon completion.
 * 5. Notifies UI only after verified enrollment is secured.
 * 6. Immediately releases seat reservation if modal is dismissed or payment fails.
 */
export async function startCohortCheckout(params: CohortCheckoutParams): Promise<void> {
  try {
    // Proactively reap any stale reservations before creating a new order
    void releaseExpiredCohortReservations();

    const order = await createCohortRazorpayOrder(params.cohortId);

    // Mock orders are prohibited on production gateway
    if (order.id.startsWith('order_mock_')) {
      void cancelCohortCheckoutReservation(order.id);
      throw new Error('Simulated mock orders are not permitted. A genuine Razorpay order is required.');
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      // Script load failed: immediately release seat reservation
      void cancelCohortCheckoutReservation(order.id);
      throw new Error('Unable to load Razorpay payment gateway. Please check your internet connection.');
    }

    const effectiveKey =
      (order.keyId && order.keyId !== 'rzp_test_placeholder')
        ? order.keyId
        : (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined);

    if (!effectiveKey || effectiveKey === 'rzp_test_placeholder' || !effectiveKey.startsWith('rzp_')) {
      // Configuration invalid: release seat reservation
      void cancelCohortCheckoutReservation(order.id);
      throw new Error(
        'Razorpay Key ID is not configured or invalid. Please configure RAZORPAY_KEY_ID in your Supabase Edge Function secrets or set VITE_RAZORPAY_KEY_ID in your .env file.'
      );
    }

    // Production safety lock: prohibit test keys in production unless on Vercel preview/staging or explicitly permitted
    const isVercelOrStaging =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('vercel.app') ||
        window.location.hostname.includes('staging'));

    if (
      import.meta.env.PROD &&
      !isVercelOrStaging &&
      effectiveKey.startsWith('rzp_test_') &&
      import.meta.env.VITE_ALLOW_TEST_PAYMENTS_IN_PROD !== 'true'
    ) {
      void cancelCohortCheckoutReservation(order.id);
      throw new Error(
        'PRODUCTION PAYMENT SAFETY LOCK: Platform is configured with Razorpay Test Mode keys (rzp_test_...). Live cohort enrollments require rzp_live_... keys. Please configure live credentials in production environment variables and Supabase secrets.'
      );
    }

    const prefill: Record<string, string> = {};
    if (params.userEmail) prefill.email = params.userEmail;
    if (params.userName) prefill.name = params.userName;

    const options: RazorpayCheckoutOptions = {
      key: effectiveKey,
      amount: order.amount,
      currency: order.currency,
      name: 'Iunoware Platform',
      description: `${params.cohortName} Enrollment`,
      order_id: order.id,
      theme: {
        color: '#f97316',
      },
      ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
      handler: async (response: RazorpayPaymentResponse) => {
        try {
          const verification = await verifyRazorpayPayment(response, params.cohortId);
          params.onSuccess(verification.enrollmentId);
        } catch (verificationError) {
          const err = verificationError instanceof Error ? verificationError : new Error(String(verificationError));
          // If verification failed, release reservation
          void cancelCohortCheckoutReservation(order.id);
          params.onError(err);
        }
      },
      modal: {
        ondismiss: () => {
          // Immediately release pending reservation upon client dismissal
          void cancelCohortCheckoutReservation(order.id);
          params.onDismiss?.();
        },
      },
    };

    const razorpayInstance = new window.Razorpay(options);
    if (typeof razorpayInstance.on === 'function') {
      razorpayInstance.on('payment.failed', (failedResponse: unknown) => {
        // Immediately release reservation upon explicit payment failure
        void cancelCohortCheckoutReservation(order.id);
        const errorDetail = failedResponse && typeof failedResponse === 'object' && 'error' in failedResponse
          ? (failedResponse as { error?: { description?: string } }).error?.description
          : null;
        params.onError(new Error(errorDetail || 'Payment failed or was cancelled.'));
      });
    }
    razorpayInstance.open();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    params.onError(error);
  }
}
