import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 1. Authenticate user from Authorization Bearer token
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

    // 2. Parse and validate request parameters
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

    // 3. Cryptographic Signature Verification
    let isSignatureValid = false;

    if (razorpayKeySecret) {
      const payloadText = `${orderId}|${paymentId}`;
      isSignatureValid = await verifyHmacSha256Hex(payloadText, razorpayKeySecret, signature);
    } else {
      const allowMock = Deno.env.get('ALLOW_DEV_MOCK_PAYMENTS') === 'true';
      if (allowMock && orderId.startsWith('order_mock_')) {
        isSignatureValid = true;
      }
    }

    if (!isSignatureValid) {
      // Record failed payment attempt in database
      await supabase
        .from('payments')
        .update({
          payment_id: paymentId,
          signature,
          status: 'failed',
          metadata: { failure_reason: 'Cryptographic signature mismatch' },
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      return new Response(
        JSON.stringify({ success: false, verified: false, error: 'Invalid payment signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch the stored order record from DB to verify order ownership & cohort scoping
    const { data: paymentRecord, error: paymentLookupError } = await supabase
      .from('payments')
      .select('cohort_id, user_id, amount, currency, status, order_id')
      .eq('order_id', orderId)
      .single();

    if (paymentLookupError || !paymentRecord) {
      return new Response(
        JSON.stringify({ error: 'Order not found in platform payment records' }),
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

    // 5. Authoritative Cohort Price Verification in smallest currency unit (paise)
    const { data: cohortRecord, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, price_inr, currency')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohortRecord) {
      return new Response(
        JSON.stringify({ error: 'Cohort not found in database records' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce paid-only launch policy: free or zero-priced cohorts are rejected
    if (!cohortRecord.price_inr || cohortRecord.price_inr <= 0) {
      return new Response(
        JSON.stringify({ error: 'Cohort does not have a valid positive paid price. Free enrollment is prohibited.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedCohortPaise = cohortRecord.price_inr * 100;
    if (paymentRecord.amount < expectedCohortPaise || paymentRecord.amount <= 0) {
      console.warn(`Payment underpaid: storedOrder=${paymentRecord.amount}, required=${expectedCohortPaise}`);
      return new Response(
        JSON.stringify({
          error: `Payment amount (${paymentRecord.amount} paise) does not match authoritative cohort price (${expectedCohortPaise} paise)`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        console.error('Failed to fetch payment status from Razorpay API:', errorText);
        return new Response(
          JSON.stringify({ error: 'Unable to verify payment status with payment gateway' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rzpPayment = await rzpRes.json();
      providerStatus = rzpPayment.status;
      verifiedPaymentAmount = Number(rzpPayment.amount);
      verifiedCurrency = rzpPayment.currency || 'INR';

      // (a) Validate actual payment status: MUST be 'captured'
      // Rejects failed, created, or authorized-but-uncaptured payments
      if (providerStatus !== 'captured' || !rzpPayment.captured) {
        console.warn(`Payment rejected: provider status '${providerStatus}' (captured=${rzpPayment.captured})`);
        await supabase
          .from('payments')
          .update({
            payment_id: paymentId,
            status: providerStatus === 'failed' ? 'failed' : 'uncaptured',
            metadata: {
              provider_status: providerStatus,
              captured: rzpPayment.captured,
              failure_reason: 'Payment status is not captured',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        return new Response(
          JSON.stringify({
            error: `Payment is not captured. Current payment status is '${providerStatus}'.`,
            status: providerStatus,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (b) Validate order ID matches expected order
      if (rzpPayment.order_id && rzpPayment.order_id !== orderId) {
        console.warn(`Provider order ID mismatch: provider=${rzpPayment.order_id}, expected=${orderId}`);
        return new Response(
          JSON.stringify({ error: 'Payment order ID does not match expected order' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (c) Validate amount against stored order & cohort pricing
      if (verifiedPaymentAmount !== paymentRecord.amount || verifiedPaymentAmount < expectedCohortPaise) {
        console.warn(`Provider amount mismatch: provider=${verifiedPaymentAmount}, expected=${expectedCohortPaise}`);
        return new Response(
          JSON.stringify({
            error: `Payment amount (${verifiedPaymentAmount} paise) does not match required cohort fee (${expectedCohortPaise} paise)`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (d) Validate currency
      if (verifiedCurrency.toUpperCase() !== (paymentRecord.currency || 'INR').toUpperCase()) {
        console.warn(`Currency mismatch: provider=${verifiedCurrency}, expected=${paymentRecord.currency}`);
        return new Response(
          JSON.stringify({ error: 'Payment currency mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const allowMock = Deno.env.get('ALLOW_DEV_MOCK_PAYMENTS') === 'true';
      if (!allowMock || !orderId.startsWith('order_mock_')) {
        return new Response(
          JSON.stringify({ error: 'Payment gateway credentials are not configured on this server' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
          user_email: user.email,
          provider_status: providerStatus,
          verified_at: new Date().toISOString(),
        },
      }
    );

    if (enrollError || !enrollmentData) {
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
