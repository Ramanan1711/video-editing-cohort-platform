import { SupabaseClient } from '@supabase/supabase-js';

export interface RazorpayEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
  method?: string;
}

export interface RazorpayWebhookEvent {
  id?: string;
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

export interface WebhookHandlerOptions {
  supabase: SupabaseClient;
  webhookSecret: string | undefined | null;
  signature: string | undefined | null;
  rawBody: string;
}

export interface WebhookHandlerResult {
  status: number;
  data: {
    success?: boolean;
    received?: boolean;
    already_processed?: boolean;
    ignored?: boolean;
    eventType?: string;
    order_id?: string;
    payment_id?: string;
    enrollment_id?: string;
    error?: string;
  };
}

/**
 * Computes and verifies Razorpay HMAC-SHA256 signature against the exact raw request body.
 * Constant-time comparison prevents timing side-channel attacks.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  secret: string,
  signature: string
): Promise<boolean> {
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

    // Timing-safe constant-time string comparison
    let mismatch = 0;
    for (let i = 0; i < calculatedHex.length; i++) {
      mismatch |= calculatedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}

/**
 * Authoritatively handles inbound Razorpay webhook events.
 * Fail-Closed:
 * 1. Fails if webhook secret is unconfigured.
 * 2. Fails if signature header is missing or cryptographically invalid.
 * 3. Fails if raw body is tampered with or malformed.
 * 4. Fails if the referenced order does not exist in platform records.
 * 5. Fails if event parameters (user, cohort, amount, currency) deviate from authoritative stored order.
 * 6. Safely handles duplicate/idempotent delivery without duplicate enrollment.
 */
export async function handleRazorpayWebhook({
  supabase,
  webhookSecret,
  signature,
  rawBody,
}: WebhookHandlerOptions): Promise<WebhookHandlerResult> {
  // 1. Mandatory secret verification
  if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim() === '') {
    return {
      status: 500,
      data: { error: 'Webhook secret is not configured on this server' },
    };
  }

  // 2. Mandatory signature presence check
  if (!signature || signature.trim() === '') {
    return {
      status: 401,
      data: { error: 'Missing webhook signature header' },
    };
  }

  // 3. Mandatory raw body presence
  if (!rawBody || rawBody.trim() === '') {
    return {
      status: 400,
      data: { error: 'Empty request body' },
    };
  }

  // 4. Cryptographic HMAC verification against exact raw body
  const isSignatureValid = await verifyWebhookSignature(rawBody, webhookSecret.trim(), signature.trim());
  if (!isSignatureValid) {
    return {
      status: 401,
      data: { error: 'Invalid webhook signature' },
    };
  }

  // 5. Parse event JSON payload
  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return {
      status: 400,
      data: { error: 'Malformed JSON payload' },
    };
  }

  const eventType = event.event;

  // Non-capture events acknowledged safely without granting course access
  if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
    return {
      status: 200,
      data: { received: true, ignored: true, eventType },
    };
  }

  // 6. Extract payload entities
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
    return {
      status: 400,
      data: { error: 'Missing order_id or payment_id in webhook payload' },
    };
  }

  // 7. Validate event against stored order in database
  const { data: storedOrder, error: orderLookupError } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (orderLookupError || !storedOrder) {
    return {
      status: 404,
      data: { error: 'Order not found in stored payment records' },
    };
  }

  // Authoritative user verification
  if (eventUserId && storedOrder.user_id && eventUserId !== storedOrder.user_id) {
    return {
      status: 403,
      data: { error: 'User mismatch for stored order' },
    };
  }

  // Authoritative cohort verification
  if (eventCohortId && storedOrder.cohort_id && eventCohortId !== storedOrder.cohort_id) {
    return {
      status: 400,
      data: { error: 'Cohort mismatch for stored order' },
    };
  }

  // Authoritative amount verification
  if (eventAmount !== undefined && eventAmount !== null && storedOrder.amount !== null) {
    if (Number(eventAmount) !== Number(storedOrder.amount)) {
      return {
        status: 400,
        data: { error: 'Payment amount mismatch for stored order' },
      };
    }
  }

  // Authoritative currency verification
  if (storedOrder.currency && eventCurrency) {
    if (String(eventCurrency).toUpperCase() !== String(storedOrder.currency).toUpperCase()) {
      return {
        status: 400,
        data: { error: 'Currency mismatch for stored order' },
      };
    }
  }

  // Idempotency: If order already captured, acknowledge without re-enrolling
  if (storedOrder.status === 'captured') {
    return {
      status: 200,
      data: { received: true, already_processed: true, order_id: orderId },
    };
  }

  // 8. Execute authoritative backend enrollment RPC
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
    return {
      status: 500,
      data: { error: rpcError.message || 'Failed to complete enrollment' },
    };
  }

  return {
    status: 200,
    data: {
      received: true,
      success: true,
      order_id: orderId,
      payment_id: paymentId,
      enrollment_id: enrollmentData?.enrollment_id,
    },
  };
}
