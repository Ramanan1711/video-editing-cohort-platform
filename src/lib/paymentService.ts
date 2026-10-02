import { supabase } from './supabaseClient';

export const DEFAULT_COHORT_FEE_INR = 4999;
export const DEFAULT_CURRENCY = 'INR';

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
  if (!cohortId) {
    throw new Error('Cohort ID is required to initiate checkout.');
  }

  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    cohortTitle?: string;
    error?: string;
  }>('create-razorpay-order', {
    body: { cohortId },
  });

  if (error || !data || !data.orderId) {
    const errorMessage = data?.error || error?.message || 'Failed to create payment order.';
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
  if (!paymentData.razorpay_order_id || !paymentData.razorpay_payment_id || !paymentData.razorpay_signature) {
    throw new Error('Incomplete payment response received from gateway.');
  }

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    verified: boolean;
    enrollmentId?: string;
    error?: string;
  }>('verify-razorpay-payment', {
    body: {
      orderId: paymentData.razorpay_order_id,
      paymentId: paymentData.razorpay_payment_id,
      signature: paymentData.razorpay_signature,
      cohortId,
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
 * Orchestrates the full paid checkout flow:
 * 1. Loads Razorpay script.
 * 2. Fetches server-authoritative order from Edge Function using only cohortId.
 * 3. Opens Razorpay Checkout modal.
 * 4. Calls server-side verification upon completion.
 * 5. Notifies UI only after verified enrollment is secured.
 */
export async function startCohortCheckout(params: CohortCheckoutParams): Promise<void> {
  try {
    const order = await createCohortRazorpayOrder(params.cohortId);

    // If order was created in mock development mode, bypass external Razorpay CDN to avoid invalid key crashes
    if (order.id.startsWith('order_mock_')) {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(
            `[DEV MODE] Simulated Razorpay Checkout:\n\nCohort: ${params.cohortName}\nAmount: ₹${(order.amount / 100).toLocaleString('en-IN')}\nOrder ID: ${order.id}\n\nClick OK to simulate verified payment and complete enrollment.`
          )
        : true;

      if (!confirmed) {
        params.onDismiss?.();
        return;
      }

      const mockResponse: RazorpayPaymentResponse = {
        razorpay_order_id: order.id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: `sig_mock_${Date.now()}`,
      };

      const verification = await verifyRazorpayPayment(mockResponse, params.cohortId);
      params.onSuccess(verification.enrollmentId);
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      throw new Error('Unable to load Razorpay payment gateway. Please check your internet connection.');
    }

    const effectiveKey =
      (order.keyId && order.keyId !== 'rzp_test_placeholder')
        ? order.keyId
        : (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined);

    if (!effectiveKey || effectiveKey === 'rzp_test_placeholder' || !effectiveKey.startsWith('rzp_')) {
      throw new Error(
        'Razorpay Key ID is not configured or invalid. Please configure RAZORPAY_KEY_ID (e.g. rzp_test_...) in your Supabase Edge Function secrets or set VITE_RAZORPAY_KEY_ID in your .env file.'
      );
    }

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
      prefill: {
        email: params.userEmail,
        name: params.userName,
      },
      handler: async (response: RazorpayPaymentResponse) => {
        try {
          const verification = await verifyRazorpayPayment(response, params.cohortId);
          params.onSuccess(verification.enrollmentId);
        } catch (verificationError) {
          const err = verificationError instanceof Error ? verificationError : new Error(String(verificationError));
          params.onError(err);
        }
      },
      modal: {
        ondismiss: () => {
          params.onDismiss?.();
        },
      },
    };

    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.open();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    params.onError(error);
  }
}
