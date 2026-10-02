import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyHmacSha256Hex(text: string, secret: string, expectedHex: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  const hex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex.toLowerCase() === expectedHex.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Bearer token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse payload
    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;
    const paymentId = body?.paymentId;
    const signature = body?.signature;
    const cohortId = body?.cohortId;

    if (!orderId || !paymentId || !signature || !cohortId) {
      return new Response(
        JSON.stringify({ error: 'Missing required payment verification parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify Razorpay cryptographic HMAC signature
    let isValid = false;

    if (razorpayKeySecret) {
      const payloadText = `${orderId}|${paymentId}`;
      isValid = await verifyHmacSha256Hex(payloadText, razorpayKeySecret, signature);
    } else {
      // In dev environment with mock payments allowed
      const allowMock = Deno.env.get('ALLOW_DEV_MOCK_PAYMENTS') === 'true';
      if (allowMock && orderId.startsWith('order_mock_')) {
        isValid = true;
      }
    }

    if (!isValid) {
      // Record failed payment attempt
      await supabase
        .from('payments')
        .update({
          payment_id: paymentId,
          signature,
          status: 'failed',
          metadata: { failure_reason: 'Invalid cryptographic signature' },
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      return new Response(
        JSON.stringify({ success: false, verified: false, error: 'Invalid payment signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch the order record from DB to verify user & cohort consistency
    const { data: paymentRecord, error: paymentLookupError } = await supabase
      .from('payments')
      .select('cohort_id, user_id, amount, currency')
      .eq('order_id', orderId)
      .single();

    if (paymentLookupError || !paymentRecord) {
      return new Response(
        JSON.stringify({ error: 'Order not found in database records' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentRecord.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Payment does not belong to the authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentRecord.cohort_id !== cohortId) {
      return new Response(
        JSON.stringify({ error: 'Order cohort does not match requested cohort' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Transactionally record successful payment and activate enrollment via RPC
    const { data: enrollmentData, error: enrollError } = await supabase.rpc(
      'record_successful_payment_and_enroll',
      {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_signature: signature,
        p_cohort_id: cohortId,
        p_user_id: user.id,
        p_amount: paymentRecord.amount,
        p_currency: paymentRecord.currency || 'INR',
        p_metadata: { verified_by: 'edge_function', user_email: user.email },
      }
    );

    if (enrollError || !enrollData) {
      console.error('Failed to record payment & enroll:', enrollError);
      return new Response(
        JSON.stringify({ error: enrollError?.message || 'Failed to complete enrollment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        enrollmentId: enrollmentData.enrollment_id,
        paymentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
