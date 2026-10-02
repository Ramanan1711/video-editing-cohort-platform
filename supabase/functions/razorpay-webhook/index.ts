import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

async function verifyWebhookSignature(rawBody: string, secret: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex.toLowerCase() === signature.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing service configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature if secret configured
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(rawBody, webhookSecret, signature);
      if (!isValid) {
        console.warn('Rejected Razorpay webhook with invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // Handle payment.captured or order.paid
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || orderEntity?.notes || {};
      const cohortId = notes.cohort_id;
      const userId = notes.user_id;
      const amount = paymentEntity?.amount || orderEntity?.amount;
      const currency = paymentEntity?.currency || orderEntity?.currency || 'INR';

      if (orderId && paymentId && cohortId && userId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { error: rpcError } = await supabase.rpc('record_successful_payment_and_enroll', {
          p_order_id: orderId,
          p_payment_id: paymentId,
          p_signature: signature || 'webhook_verified',
          p_cohort_id: cohortId,
          p_user_id: userId,
          p_amount: amount,
          p_currency: currency,
          p_metadata: { source: 'webhook', event_id: event.id, event_type: eventType },
        });

        if (rpcError) {
          console.error('Webhook enrollment RPC failed:', rpcError);
          return new Response(JSON.stringify({ error: rpcError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
