import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-correlation-id, x-request-id',
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
  deliveryLatencyMs?: number;
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
 * Verifies Razorpay Webhook HMAC-SHA256 signature against the exact raw request body.
 * Implements constant-time string comparison to prevent timing side-channel attacks.
 */
async function verifyWebhookSignature(rawBody: string, secret: string, signature: string): Promise<boolean> {
  if (!rawBody || !secret || !signature) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const calculatedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();

    const expectedHex = signature.trim().toLowerCase();
    if (calculatedHex.length !== expectedHex.length) {
      return false;
    }

    // Timing-safe constant-time comparison
    let mismatch = 0;
    for (let i = 0; i < calculatedHex.length; i++) {
      mismatch |= calculatedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }

    return mismatch === 0;
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'razorpay-webhook',
        level: 'error',
        errorCode: 'SIGNATURE_VERIFY_EXCEPTION',
        message: 'Exception in verifyWebhookSignature',
        metadata: { error: err instanceof Error ? err.message : String(err) },
      })
    );
    return false;
  }
}

interface RazorpayEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  captured?: boolean;
  notes?: Record<string, string>;
  method?: string;
  error_code?: string;
  error_description?: string;
  created_at?: number;
}

interface RazorpayWebhookEvent {
  id?: string;
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
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
      service: 'razorpay-webhook',
      level: 'warn',
      traceId,
      durationMs: getDuration(),
      errorCode: 'METHOD_NOT_ALLOWED',
      message: `Invalid HTTP method: ${req.method}`,
    });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  let deliveryLatencyMs: number | undefined;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    // 1. Critical Pre-Flight: Database & service configuration check
    if (!supabaseUrl || !supabaseServiceKey) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        errorCode: 'CONFIG_MISSING',
        message: 'Missing Supabase service configuration',
      });
      return new Response(JSON.stringify({ error: 'Missing service configuration' }), {
        status: 500,
        headers: responseHeaders,
      });
    }

    // 2. Critical Security Gate: Mandatory webhook secret check
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim() === '') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        errorCode: 'SECRET_NOT_CONFIGURED',
        message: 'CRITICAL: RAZORPAY_WEBHOOK_SECRET is missing or empty. Rejecting webhook request.',
      });
      return new Response(
        JSON.stringify({ error: 'Webhook secret is not configured on this server' }),
        { status: 500, headers: responseHeaders }
      );
    }

    // 3. Mandatory Signature Header Check
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature || signature.trim() === '') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        errorCode: 'SIGNATURE_HEADER_MISSING',
        message: 'Rejected Razorpay webhook: missing x-razorpay-signature header',
      });
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature header' }),
        { status: 401, headers: responseHeaders }
      );
    }

    // 4. Exact Raw Request Body Verification
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        errorCode: 'EMPTY_BODY',
        message: 'Rejected Razorpay webhook: empty request body',
      });
      return new Response(
        JSON.stringify({ error: 'Empty request body' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const isValidSignature = await verifyWebhookSignature(rawBody, webhookSecret.trim(), signature.trim());
    if (!isValidSignature) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        errorCode: 'SIGNATURE_MISMATCH',
        message: 'Rejected Razorpay webhook: cryptographic signature mismatch',
      });
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: responseHeaders }
      );
    }

    // 5. Parse Webhook Event JSON
    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    } catch {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        errorCode: 'MALFORMED_JSON',
        message: 'Rejected Razorpay webhook: malformed JSON payload',
      });
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const eventType = event.event;

    // Track Webhook Delivery Latency
    const eventCreatedAtSec =
      event.created_at ||
      event.payload?.payment?.entity?.created_at ||
      event.payload?.order?.entity?.created_at;

    if (typeof eventCreatedAtSec === 'number' && eventCreatedAtSec > 0) {
      deliveryLatencyMs = Math.max(0, Date.now() - eventCreatedAtSec * 1000);
    }

    // Problem 5: Release pending reservation capacity immediately if payment fails at gateway
    if (eventType === 'payment.failed') {
      const failedPaymentEntity = event.payload?.payment?.entity;
      const failedOrderId = failedPaymentEntity?.order_id;
      if (failedOrderId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              failure_reason: failedPaymentEntity?.error_description || 'Payment failed at gateway',
              error_code: failedPaymentEntity?.error_code,
              released_at: new Date().toISOString(),
              source: 'webhook_payment_failed',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', failedOrderId)
          .eq('status', 'created');
      }

      logTelemetry({
        service: 'razorpay-webhook',
        level: 'info',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        message: `Processed payment.failed: released reservation for order ${failedOrderId}`,
        metadata: { orderId: failedOrderId, error: failedPaymentEntity?.error_description },
      });

      return new Response(
        JSON.stringify({ received: true, ignored: true, status: 'failed_reservation_released', eventType }),
        { status: 200, headers: responseHeaders }
      );
    }

    // Acknowledge other non-capture events safely without granting access
    if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'info',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        message: `Safely acknowledged non-capture webhook event: ${eventType}`,
      });
      return new Response(
        JSON.stringify({ received: true, ignored: true, eventType }),
        { status: 200, headers: responseHeaders }
      );
    }

    // 6. Extract Event Entities
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;
    const notes = paymentEntity?.notes || orderEntity?.notes || {};
    const eventCohortId = notes.cohort_id;
    const eventUserId = notes.user_id;
    const eventAmount = paymentEntity?.amount ?? orderEntity?.amount;
    const eventCurrency = paymentEntity?.currency || orderEntity?.currency || 'INR';

    if (!orderId || !paymentId) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'MISSING_IDS',
        message: 'Rejected webhook: missing order_id or payment_id',
      });
      return new Response(
        JSON.stringify({ error: 'Missing order_id or payment_id in webhook payload' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // 7. Authoritative Stored Order Verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: storedOrder, error: orderLookupError } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (orderLookupError || !storedOrder) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'ORDER_NOT_FOUND',
        message: `Rejected webhook: order ${orderId} does not exist in platform payment records`,
        metadata: { orderId },
      });
      return new Response(
        JSON.stringify({ error: 'Order not found in stored payment records' }),
        { status: 404, headers: responseHeaders }
      );
    }

    // Authoritative User check: Ensure payment belongs to the expected user
    if (eventUserId && storedOrder.user_id && eventUserId !== storedOrder.user_id) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'USER_MISMATCH',
        message: `Rejected webhook: user mismatch for order ${orderId}`,
        metadata: { eventUserId, storedUserId: storedOrder.user_id },
      });
      return new Response(
        JSON.stringify({ error: 'User mismatch for stored order' }),
        { status: 403, headers: responseHeaders }
      );
    }

    // Authoritative Cohort check: Ensure payment targets the expected cohort
    if (eventCohortId && storedOrder.cohort_id && eventCohortId !== storedOrder.cohort_id) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'COHORT_MISMATCH',
        message: `Rejected webhook: cohort mismatch for order ${orderId}`,
        metadata: { eventCohortId, storedCohortId: storedOrder.cohort_id },
      });
      return new Response(
        JSON.stringify({ error: 'Cohort mismatch for stored order' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Authoritative payment status verification: Must be captured
    if (paymentEntity?.status && paymentEntity.status !== 'captured') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'PAYMENT_NOT_CAPTURED',
        message: `Rejected webhook: payment status '${paymentEntity.status}' is not captured`,
      });
      return new Response(
        JSON.stringify({ error: `Payment status is '${paymentEntity.status}' (not captured)` }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (paymentEntity && 'captured' in paymentEntity && paymentEntity.captured === false) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'PAYMENT_NOT_CAPTURED',
        message: 'Rejected webhook: payment is authorized but not captured',
      });
      return new Response(
        JSON.stringify({ error: 'Payment is authorized but not captured' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Authoritative cohort price verification in smallest currency unit (paise)
    const { data: cohortRecord } = await supabase
      .from('cohorts')
      .select('id, price_inr')
      .eq('id', storedOrder.cohort_id)
      .single();

    if (!cohortRecord?.price_inr || cohortRecord.price_inr <= 0) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'FREE_ENROLLMENT_PROHIBITED',
        message: `Rejected webhook: cohort ${storedOrder.cohort_id} has invalid or zero price. Free enrollment is prohibited.`,
      });
      return new Response(
        JSON.stringify({ error: 'Cohort does not have a valid positive paid price. Free enrollment is prohibited.' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const expectedCohortPaise = cohortRecord.price_inr * 100;
    if (storedOrder.amount < expectedCohortPaise || storedOrder.amount <= 0 || (eventAmount !== undefined && (eventAmount < expectedCohortPaise || eventAmount <= 0))) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'PRICE_UNDERPAID',
        message: `Rejected webhook: payment amount does not meet cohort price (${expectedCohortPaise} paise)`,
      });
      return new Response(
        JSON.stringify({
          error: `Payment amount does not meet authoritative cohort price (${expectedCohortPaise} paise)`,
        }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Authoritative Amount check: Prevent underpaid spoofed payments
    if (eventAmount !== undefined && eventAmount !== null && storedOrder.amount !== null) {
      if (Number(eventAmount) !== Number(storedOrder.amount)) {
        logTelemetry({
          service: 'razorpay-webhook',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: eventType,
          deliveryLatencyMs,
          errorCode: 'AMOUNT_MISMATCH',
          message: `Rejected webhook: amount mismatch for order ${orderId} (event: ${eventAmount}, stored: ${storedOrder.amount})`,
        });
        return new Response(
          JSON.stringify({ error: 'Payment amount mismatch for stored order' }),
          { status: 400, headers: responseHeaders }
        );
      }
    }

    // Authoritative Currency check
    if (storedOrder.currency && eventCurrency) {
      if (String(eventCurrency).toUpperCase() !== String(storedOrder.currency).toUpperCase()) {
        logTelemetry({
          service: 'razorpay-webhook',
          level: 'warn',
          traceId,
          durationMs: getDuration(),
          event: eventType,
          deliveryLatencyMs,
          errorCode: 'CURRENCY_MISMATCH',
          message: `Rejected webhook: currency mismatch for order ${orderId}`,
        });
        return new Response(
          JSON.stringify({ error: 'Currency mismatch for stored order' }),
          { status: 400, headers: responseHeaders }
        );
      }
    }

    // Idempotency check: If order is already captured, acknowledge cleanly
    if (storedOrder.status === 'captured') {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'info',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        message: `Order ${orderId} is already captured. Idempotent return.`,
      });
      return new Response(
        JSON.stringify({ received: true, already_processed: true, order_id: orderId }),
        { status: 200, headers: responseHeaders }
      );
    }

    // 8. Execute privileged server-side enrollment RPC
    const { data: enrollmentData, error: rpcError } = await supabase.rpc(
      'record_successful_payment_and_enroll',
      {
        p_order_id: storedOrder.order_id,
        p_payment_id: paymentId,
        p_signature: signature,
        p_cohort_id: storedOrder.cohort_id,
        p_user_id: storedOrder.user_id,
        p_amount: storedOrder.amount,
        p_currency: storedOrder.currency || 'INR',
        p_metadata: {
          source: 'razorpay_webhook',
          trace_id: traceId,
          delivery_latency_ms: deliveryLatencyMs,
          event_id: event.id || null,
          event_type: eventType,
          verified_at: new Date().toISOString(),
          payment_method: paymentEntity?.method || null,
        },
      }
    );

    if (rpcError) {
      logTelemetry({
        service: 'razorpay-webhook',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: eventType,
        deliveryLatencyMs,
        errorCode: 'RPC_ENROLLMENT_FAILED',
        message: `Webhook enrollment RPC failed: ${rpcError.message}`,
        metadata: { rpcError },
      });
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to complete enrollment' }),
        { status: 500, headers: responseHeaders }
      );
    }

    logTelemetry({
      service: 'razorpay-webhook',
      level: 'info',
      traceId,
      durationMs: getDuration(),
      event: eventType,
      deliveryLatencyMs,
      message: `Successfully verified and enrolled user for order ${orderId}`,
      metadata: { orderId, paymentId, enrollmentId: enrollmentData?.enrollment_id },
    });

    return new Response(
      JSON.stringify({
        received: true,
        success: true,
        order_id: orderId,
        payment_id: paymentId,
        enrollment_id: enrollmentData?.enrollment_id,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logTelemetry({
      service: 'razorpay-webhook',
      level: 'error',
      traceId,
      durationMs: getDuration(),
      deliveryLatencyMs,
      errorCode: 'UNHANDLED_EXCEPTION',
      message: `Unhandled webhook exception: ${message}`,
      metadata: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
