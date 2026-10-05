import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization header
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

    // 2. Parse request payload
    const body = await req.json().catch(() => null);
    const cohortId = body?.cohortId;

    if (!cohortId || typeof cohortId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing cohortId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Invoke server-side checkout initialization RPC
    // Checks capacity + unexpired checkout reservations, enrollment dates, user account state
    const { data: checkoutData, error: checkoutError } = await supabase.rpc(
      'create_cohort_checkout_order',
      {
        p_cohort_id: cohortId,
        p_user_id: user.id,
      }
    );

    if (checkoutError || !checkoutData) {
      return new Response(
        JSON.stringify({ error: checkoutError?.message || 'Unable to initiate cohort checkout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountInPaise = Number(checkoutData.amount_paise) || 499900;
    const currency = String(checkoutData.currency || 'INR');
    const receipt = `rcpt_${user.id.slice(0, 8)}_${Date.now()}`;

    // 4. Create Razorpay Order
    let razorpayOrderId = '';

    if (razorpayKeyId && razorpayKeySecret) {
      const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt,
          notes: {
            cohort_id: cohortId,
            user_id: user.id,
            email: user.email || '',
            cohort_title: checkoutData.title || '',
          },
        }),
      });

      if (!rzpRes.ok) {
        const errorText = await rzpRes.text();
        console.error('Razorpay order creation error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Payment gateway error initiating order' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rzpData = await rzpRes.json();
      razorpayOrderId = rzpData.id;
    } else {
      // In development environments without live credentials, support test order ID
      const allowMock = Deno.env.get('ALLOW_DEV_MOCK_PAYMENTS') === 'true';
      if (!allowMock) {
        return new Response(
          JSON.stringify({ error: 'Payment gateway is not configured on this server' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      razorpayOrderId = `order_mock_${cohortId.slice(0, 8)}_${Date.now()}`;
    }

    // 5. Critical Gate: Record and PERSIST pending payment attempt with reservation TTL (15 minutes)
    // Fail-Closed: If database insert fails, abort immediately and return error.
    // Never return a Razorpay order without a corresponding persisted payment attempt in the database.
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: insertedPayment, error: insertOrderError } = await supabase
      .from('payments')
      .insert({
        order_id: razorpayOrderId,
        cohort_id: cohortId,
        user_id: user.id,
        amount: amountInPaise,
        currency,
        status: 'created',
        provider: 'razorpay',
        receipt,
        notes: {
          cohort_title: checkoutData.title,
          user_email: user.email,
          user_id: user.id,
          cohort_id: cohortId,
        },
        metadata: {
          initiated_at: new Date().toISOString(),
          user_email: user.email,
          cohort_title: checkoutData.title,
          cohort_price_inr: checkoutData.price_inr,
          created_via: 'create-razorpay-order',
        },
        expires_at: expiresAt,
      })
      .select('id, order_id, cohort_id, user_id, amount, status, created_at')
      .single();

    if (insertOrderError || !insertedPayment) {
      console.error('CRITICAL: Failed to persist pending payment attempt in database:', insertOrderError);
      return new Response(
        JSON.stringify({
          error: 'Unable to initiate checkout: payment attempt could not be recorded in database.',
          details: insertOrderError?.message || 'Database write unconfirmed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Return verified order details to frontend only after local payment record is securely persisted
    return new Response(
      JSON.stringify({
        success: true,
        orderId: razorpayOrderId,
        amount: amountInPaise,
        currency,
        keyId: razorpayKeyId || 'rzp_test_placeholder',
        cohortTitle: checkoutData.title,
        paymentRecordId: insertedPayment.id,
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
