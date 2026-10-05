import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

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
    console.error('Error verifying webhook signature:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    // 1. Critical Pre-Flight: Database & service configuration check
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Webhook failed: Missing Supabase service configuration');
      return new Response(JSON.stringify({ error: 'Missing service configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Critical Security Gate: Mandatory webhook secret check
    // Fail closed: Webhooks MUST be rejected if the secret is not configured
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim() === '') {
      console.error('CRITICAL: RAZORPAY_WEBHOOK_SECRET is missing or empty. Rejecting webhook request.');
      return new Response(
        JSON.stringify({ error: 'Webhook secret is not configured on this server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Mandatory Signature Header Check
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature || signature.trim() === '') {
      console.warn('Rejected Razorpay webhook: missing x-razorpay-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Exact Raw Request Body Verification
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Empty request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidSignature = await verifyWebhookSignature(rawBody, webhookSecret.trim(), signature.trim());
    if (!isValidSignature) {
      console.warn('Rejected Razorpay webhook: cryptographic signature mismatch');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
}

interface RazorpayWebhookEvent {
  id?: string;
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

    // 5. Parse Webhook Event JSON
    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventType = event.event;

    // Acknowledge non-capture events safely without granting access
    if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return new Response(
        JSON.stringify({ received: true, ignored: true, eventType }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.warn('Rejected webhook: missing order_id or payment_id');
      return new Response(
        JSON.stringify({ error: 'Missing order_id or payment_id in webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.warn(`Rejected webhook: order ${orderId} does not exist in platform payment records`);
      return new Response(
        JSON.stringify({ error: 'Order not found in stored payment records' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative User check: Ensure payment belongs to the expected user
    if (eventUserId && storedOrder.user_id && eventUserId !== storedOrder.user_id) {
      console.warn(`Rejected webhook: user mismatch for order ${orderId}`);
      return new Response(
        JSON.stringify({ error: 'User mismatch for stored order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative Cohort check: Ensure payment targets the expected cohort
    if (eventCohortId && storedOrder.cohort_id && eventCohortId !== storedOrder.cohort_id) {
      console.warn(`Rejected webhook: cohort mismatch for order ${orderId}`);
      return new Response(
        JSON.stringify({ error: 'Cohort mismatch for stored order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative payment status verification: Must be captured
    if (paymentEntity?.status && paymentEntity.status !== 'captured') {
      console.warn(`Rejected webhook: payment status '${paymentEntity.status}' is not captured`);
      return new Response(
        JSON.stringify({ error: `Payment status is '${paymentEntity.status}' (not captured)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentEntity && 'captured' in paymentEntity && paymentEntity.captured === false) {
      console.warn('Rejected webhook: payment is authorized but not captured');
      return new Response(
        JSON.stringify({ error: 'Payment is authorized but not captured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative cohort price verification in smallest currency unit (paise)
    const { data: cohortRecord } = await supabase
      .from('cohorts')
      .select('id, price_inr')
      .eq('id', storedOrder.cohort_id)
      .single();

    if (cohortRecord?.price_inr) {
      const expectedCohortPaise = cohortRecord.price_inr * 100;
      if (storedOrder.amount < expectedCohortPaise || (eventAmount !== undefined && eventAmount < expectedCohortPaise)) {
        console.warn(`Rejected webhook: payment amount does not meet cohort price (${expectedCohortPaise} paise)`);
        return new Response(
          JSON.stringify({
            error: `Payment amount does not meet authoritative cohort price (${expectedCohortPaise} paise)`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Authoritative Amount check: Prevent underpaid spoofed payments
    if (eventAmount !== undefined && eventAmount !== null && storedOrder.amount !== null) {
      if (Number(eventAmount) !== Number(storedOrder.amount)) {
        console.warn(`Rejected webhook: amount mismatch for order ${orderId} (event: ${eventAmount}, stored: ${storedOrder.amount})`);
        return new Response(
          JSON.stringify({ error: 'Payment amount mismatch for stored order' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Authoritative Currency check
    if (storedOrder.currency && eventCurrency) {
      if (String(eventCurrency).toUpperCase() !== String(storedOrder.currency).toUpperCase()) {
        console.warn(`Rejected webhook: currency mismatch for order ${orderId}`);
        return new Response(
          JSON.stringify({ error: 'Currency mismatch for stored order' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Idempotency check: If order is already captured, acknowledge cleanly
    if (storedOrder.status === 'captured') {
      return new Response(
        JSON.stringify({ received: true, already_processed: true, order_id: orderId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          event_id: event.id || null,
          event_type: eventType,
          verified_at: new Date().toISOString(),
          payment_method: paymentEntity?.method || null,
        },
      }
    );

    if (rpcError) {
      console.error('Webhook enrollment RPC failed:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to complete enrollment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        received: true,
        success: true,
        order_id: orderId,
        payment_id: paymentId,
        enrollment_id: enrollmentData?.enrollment_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unhandled webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
