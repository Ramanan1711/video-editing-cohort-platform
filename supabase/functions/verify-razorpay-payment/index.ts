import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id, x-request-id',
  'Access-Control-Expose-Headers': 'x-correlation-id',
};

interface StructuredTelemetry {
  timestamp: string;
  service: string;
  level: 'info' | 'warn' | 'error';
  traceId: string;
  durationMs: number;
  event?: string;
  errorCode?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

function logTelemetry(data: Omit<StructuredTelemetry, 'timestamp'>) {
  const payload: StructuredTelemetry = {
    timestamp: new Date().toISOString(),
    ...data,
  };
  const jsonStr = JSON.stringify(payload);
  if (data.level === 'error') {
    console.error(jsonStr);
  } else if (data.level === 'warn') {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

/**
 * Computes and verifies Razorpay HMAC-SHA256 signature.
 * Constant-time comparison protects against timing side-channel attacks.
 */
async function verifyHmacSha256Hex(text: string, secret: string, expectedHex: string): Promise<boolean> {
  if (!text || !secret || !expectedHex) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
    const calculatedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();

    const cleanExpected = expectedHex.trim().toLowerCase();
    if (calculatedHex.length !== cleanExpected.length) return false;

    let mismatch = 0;
    for (let i = 0; i < calculatedHex.length; i++) {
      mismatch |= calculatedHex.charCodeAt(i) ^ cleanExpected.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const startTime = performance.now();
  const traceId =
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID();

  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'x-correlation-id': traceId,
  };

  const getDuration = () => Math.round(performance.now() - startTime);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders });
  }

  if (req.method !== 'POST') {
    logTelemetry({
      service: 'verify-razorpay-payment',
      level: 'warn',
      traceId,
      durationMs: getDuration(),
      event: 'payment.verify',
      errorCode: 'METHOD_NOT_ALLOWED',
      message: `Invalid HTTP method: ${req.method}`,
    });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'CONFIG_MISSING',
        message: 'Missing Supabase service configuration',
      });
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service configuration' }),
        { status: 500, headers: responseHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization Bearer token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'AUTH_REQUIRED',
        message: 'Missing authorization bearer token',
      });
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: responseHeaders }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'AUTH_INVALID',
        message: 'Invalid authentication session or user not found',
        metadata: { error: userError?.message },
      });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication session' }),
        { status: 401, headers: responseHeaders }
      );
    }

    // 2. Parse and validate request parameters
    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;
    const paymentId = body?.paymentId;
    const signature = body?.signature;
    const cohortId = body?.cohortId;

    if (!orderId || !paymentId || !signature || !cohortId) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'MISSING_PARAMS',
        message: 'Missing required payment verification parameters',
        metadata: { hasOrderId: !!orderId, hasPaymentId: !!paymentId, hasSignature: !!signature, hasCohortId: !!cohortId },
      });
      return new Response(
        JSON.stringify({ error: 'Missing required payment verification parameters' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // 3. Reject simulated mock orders and verify cryptographic HMAC signature
    if (orderId.startsWith('order_mock_')) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'MOCK_ORDER_REJECTED',
        message: `Rejected simulated mock order: ${orderId}`,
      });
      return new Response(
        JSON.stringify({ error: 'Mock orders are strictly prohibited on payment gateway' }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (!razorpayKeySecret) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'GATEWAY_SECRET_MISSING',
        message: 'Payment gateway credentials are not configured on this server',
      });
      return new Response(
        JSON.stringify({ error: 'Payment gateway credentials are not configured on this server' }),
        { status: 503, headers: responseHeaders }
      );
    }

    const payloadText = `${orderId}|${paymentId}`;
    const isSignatureValid = await verifyHmacSha256Hex(payloadText, razorpayKeySecret, signature);

    if (!isSignatureValid) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'SIGNATURE_MISMATCH',
        message: `Invalid cryptographic signature for order ${orderId}`,
        metadata: { orderId, paymentId },
      });

      // Record failed payment attempt in database
      await supabase
        .from('payments')
        .update({
          payment_id: paymentId,
          signature,
          status: 'failed',
          metadata: { failure_reason: 'Cryptographic signature mismatch', trace_id: traceId },
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      return new Response(
        JSON.stringify({ success: false, verified: false, error: 'Invalid payment signature' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // 4. Fetch the stored order record from DB to verify order ownership & cohort scoping
    const { data: paymentRecord, error: paymentLookupError } = await supabase
      .from('payments')
      .select('cohort_id, user_id, amount, currency, status, order_id')
      .eq('order_id', orderId)
      .single();

    if (paymentLookupError || !paymentRecord) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} not found in platform payment records`,
        metadata: { orderId },
      });
      return new Response(
        JSON.stringify({ error: 'Order not found in platform payment records' }),
        { status: 404, headers: responseHeaders }
      );
    }

    if (paymentRecord.user_id !== user.id) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'USER_MISMATCH',
        message: `Payment order ${orderId} does not belong to authenticated user ${user.id}`,
        metadata: { orderId, expectedUserId: user.id, storedUserId: paymentRecord.user_id },
      });
      return new Response(
        JSON.stringify({ error: 'Payment does not belong to the authenticated user' }),
        { status: 403, headers: responseHeaders }
      );
    }

    if (paymentRecord.cohort_id !== cohortId) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'COHORT_MISMATCH',
        message: `Order cohort (${paymentRecord.cohort_id}) does not match requested cohort (${cohortId})`,
      });
      return new Response(
        JSON.stringify({ error: 'Order cohort does not match requested cohort' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // 5. Authoritative Cohort Price Verification in smallest currency unit (paise)
    const { data: cohortRecord, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, price_inr, currency')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohortRecord) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'COHORT_NOT_FOUND',
        message: `Cohort ${cohortId} not found in database records`,
      });
      return new Response(
        JSON.stringify({ error: 'Cohort not found in database records' }),
        { status: 404, headers: responseHeaders }
      );
    }

    // Enforce paid-only launch policy: free or zero-priced cohorts are rejected
    if (!cohortRecord.price_inr || cohortRecord.price_inr <= 0) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'FREE_ENROLLMENT_PROHIBITED',
        message: `Free enrollment prohibited for cohort ${cohortId}`,
      });
      return new Response(
        JSON.stringify({ error: 'Cohort does not have a valid positive paid price. Free enrollment is prohibited.' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const expectedCohortPaise = cohortRecord.price_inr * 100;
    if (paymentRecord.amount < expectedCohortPaise || paymentRecord.amount <= 0) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'PAYMENT_UNDERPAID',
        message: `Payment underpaid: storedOrder=${paymentRecord.amount}, required=${expectedCohortPaise}`,
        metadata: { storedAmount: paymentRecord.amount, expectedCohortPaise },
      });
      return new Response(
        JSON.stringify({
          error: `Payment amount (${paymentRecord.amount} paise) does not match authoritative cohort price (${expectedCohortPaise} paise)`,
        }),
        { status: 400, headers: responseHeaders }
      );
    }

    // 6. Confirm capture against trusted provider data (Razorpay API)
    let verifiedPaymentAmount = paymentRecord.amount;
    let verifiedCurrency = paymentRecord.currency || 'INR';
    let providerStatus = 'captured';

    if (razorpayKeyId && razorpayKeySecret) {
      const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!rzpRes.ok) {
        const errorText = await rzpRes.text();
        logTelemetry({
          service: 'verify-razorpay-payment',
          level: 'error',
          traceId,
          durationMs: getDuration(),
          event: 'payment.verify',
          errorCode: 'GATEWAY_FETCH_FAILED',
          message: 'Failed to fetch payment status from Razorpay API',
          metadata: { statusCode: rzpRes.status, errorText: errorText.slice(0, 500) },
        });
        return new Response(
          JSON.stringify({ error: 'Unable to verify payment status with payment gateway' }),
          { status: 502, headers: responseHeaders }
        );
      }

      const rzpPayment = await rzpRes.json();
      providerStatus = rzpPayment.status;
      verifiedPaymentAmount = Number(rzpPayment.amount);
      verifiedCurrency = rzpPayment.currency || 'INR';

      // (a) Validate actual payment status: MUST be 'captured'
      if (providerStatus !== 'captured' || !rzpPayment.captured) {
        logTelemetry({
          service: 'verify-razorpay-payment',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: 'payment.verify',
          errorCode: 'PAYMENT_NOT_CAPTURED',
          message: `Payment rejected: provider status '${providerStatus}' (captured=${rzpPayment.captured})`,
          metadata: { providerStatus, captured: rzpPayment.captured },
        });

        await supabase
          .from('payments')
          .update({
            payment_id: paymentId,
            status: providerStatus === 'failed' ? 'failed' : 'uncaptured',
            metadata: {
              provider_status: providerStatus,
              captured: rzpPayment.captured,
              failure_reason: 'Payment status is not captured',
              trace_id: traceId,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        return new Response(
          JSON.stringify({
            error: `Payment is not captured. Current payment status is '${providerStatus}'.`,
            status: providerStatus,
          }),
          { status: 400, headers: responseHeaders }
        );
      }

      // (b) Validate order ID matches expected order
      if (rzpPayment.order_id && rzpPayment.order_id !== orderId) {
        logTelemetry({
          service: 'verify-razorpay-payment',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: 'payment.verify',
          errorCode: 'PROVIDER_ORDER_MISMATCH',
          message: `Provider order ID mismatch: provider=${rzpPayment.order_id}, expected=${orderId}`,
        });
        return new Response(
          JSON.stringify({ error: 'Payment order ID does not match expected order' }),
          { status: 400, headers: responseHeaders }
        );
      }

      // (c) Validate amount against stored order & cohort pricing
      if (verifiedPaymentAmount !== paymentRecord.amount || verifiedPaymentAmount < expectedCohortPaise) {
        logTelemetry({
          service: 'verify-razorpay-payment',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: 'payment.verify',
          errorCode: 'PROVIDER_AMOUNT_MISMATCH',
          message: `Provider amount mismatch: provider=${verifiedPaymentAmount}, expected=${expectedCohortPaise}`,
        });
        return new Response(
          JSON.stringify({
            error: `Payment amount (${verifiedPaymentAmount} paise) does not match required cohort fee (${expectedCohortPaise} paise)`,
          }),
          { status: 400, headers: responseHeaders }
        );
      }

      // (d) Validate currency
      if (verifiedCurrency.toUpperCase() !== (paymentRecord.currency || 'INR').toUpperCase()) {
        logTelemetry({
          service: 'verify-razorpay-payment',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: 'payment.verify',
          errorCode: 'PROVIDER_CURRENCY_MISMATCH',
          message: `Currency mismatch: provider=${verifiedCurrency}, expected=${paymentRecord.currency}`,
        });
        return new Response(
          JSON.stringify({ error: 'Payment currency mismatch' }),
          { status: 400, headers: responseHeaders }
        );
      }
    } else {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'GATEWAY_CREDENTIALS_MISSING',
        message: 'Payment gateway credentials are not configured on this server',
      });
      return new Response(
        JSON.stringify({ error: 'Payment gateway credentials are not configured on this server' }),
        { status: 503, headers: responseHeaders }
      );
    }

    // 7. Transactionally record successful payment and activate enrollment via privileged RPC
    const { data: enrollmentData, error: enrollError } = await supabase.rpc(
      'record_successful_payment_and_enroll',
      {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_signature: signature,
        p_cohort_id: cohortId,
        p_user_id: user.id,
        p_amount: verifiedPaymentAmount,
        p_currency: verifiedCurrency,
        p_metadata: {
          verified_by: 'edge_function',
          trace_id: traceId,
          user_email: user.email,
          provider_status: providerStatus,
          verified_at: new Date().toISOString(),
        },
      }
    );

    if (enrollError || !enrollmentData) {
      logTelemetry({
        service: 'verify-razorpay-payment',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'payment.verify',
        errorCode: 'ENROLLMENT_RPC_FAILED',
        message: `Failed to record payment & enroll: ${enrollError?.message}`,
        metadata: { error: enrollError },
      });
      return new Response(
        JSON.stringify({ error: enrollError?.message || 'Failed to complete enrollment' }),
        { status: 500, headers: responseHeaders }
      );
    }

    logTelemetry({
      service: 'verify-razorpay-payment',
      level: 'info',
      traceId,
      durationMs: getDuration(),
      event: 'payment.verify',
      message: `Successfully verified payment ${paymentId} and enrolled user in cohort ${cohortId}`,
      metadata: { orderId, paymentId, cohortId, enrollmentId: enrollmentData.enrollment_id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        enrollmentId: enrollmentData.enrollment_id,
        paymentId,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logTelemetry({
      service: 'verify-razorpay-payment',
      level: 'error',
      traceId,
      durationMs: getDuration(),
      event: 'payment.verify',
      errorCode: 'UNHANDLED_EXCEPTION',
      message: `Unhandled exception in verify-razorpay-payment: ${message}`,
      metadata: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
