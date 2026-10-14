import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { z } from 'https://deno.land/x/zod/mod.ts';

export const CreateOrderSchema = z
  .object({
    cohort_id: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    cohortId: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    currency: z.enum(['INR', 'USD']).default('INR'),
  })
  .refine((data) => Boolean(data.cohort_id || data.cohortId), {
    message: 'Missing cohortId parameter',
    path: ['cohortId'],
  })
  .transform((data) => ({
    cohort_id: (data.cohort_id || data.cohortId) as string,
    cohortId: (data.cohortId || data.cohort_id) as string,
    currency: data.currency,
  }));

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
      service: 'create-razorpay-order',
      level: 'warn',
      traceId,
      durationMs: getDuration(),
      event: 'order.create',
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
        service: 'create-razorpay-order',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'CONFIG_MISSING',
        message: 'Missing Supabase service configuration',
      });
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service configuration' }),
        { status: 500, headers: responseHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      logTelemetry({
        service: 'create-razorpay-order',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
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
        service: 'create-razorpay-order',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'AUTH_INVALID',
        message: 'Invalid authentication session or user not found',
        metadata: { error: userError?.message },
      });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication session' }),
        { status: 401, headers: responseHeaders }
      );
    }

    // 2. Parse request payload with runtime Zod validation
    const rawBody = await req.json().catch(() => null);
    const parseResult = CreateOrderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      logTelemetry({
        service: 'create-razorpay-order',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'INVALID_PAYLOAD',
        message: 'Invalid request payload for order creation',
        metadata: { error: parseResult.error.flatten() },
      });
      return new Response(
        JSON.stringify({ error: parseResult.error.flatten() }),
        { status: 400, headers: responseHeaders }
      );
    }

    const { cohortId } = parseResult.data;

    // 3. Invoke atomic checkout initialization RPC
    // Serializes concurrent requests via row lock, cleans expired reservations, and atomically reserves capacity
    const { data: checkoutData, error: checkoutError } = await supabase.rpc(
      'create_cohort_checkout_order',
      {
        p_cohort_id: cohortId,
        p_user_id: user.id,
      }
    );

    if (checkoutError || !checkoutData) {
      logTelemetry({
        service: 'create-razorpay-order',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'CHECKOUT_RESERVATION_FAILED',
        message: `Failed to initiate atomic cohort reservation: ${checkoutError?.message}`,
        metadata: { cohortId, userId: user.id, error: checkoutError },
      });
      return new Response(
        JSON.stringify({ error: checkoutError?.message || 'Unable to initiate cohort checkout' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const reservationId = checkoutData.reservation_id;
    const amountInPaise = Number(checkoutData.amount_paise);
    const priceInr = Number(checkoutData.price_inr);
    const currency = String(checkoutData.currency || 'INR');
    const receipt = checkoutData.receipt || `rcpt_${user.id.slice(0, 8)}_${Date.now()}`;

    // Enforce paid-only launch policy: free or zero-priced cohorts are prohibited from checkout
    if (!amountInPaise || amountInPaise <= 0 || !priceInr || priceInr <= 0) {
      if (reservationId) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              release_reason: 'free_enrollment_rejected',
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId);
      }
      logTelemetry({
        service: 'create-razorpay-order',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'FREE_ENROLLMENT_PROHIBITED',
        message: `Free enrollment rejected for cohort ${cohortId}`,
        metadata: { cohortId, amountInPaise, priceInr },
      });
      return new Response(
        JSON.stringify({ error: 'Free enrollment is prohibited under the platform paid-only policy. Cohorts must have a valid positive price.' }),
        { status: 400, headers: responseHeaders }
      );
    }

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
            trace_id: traceId,
          },
        }),
      });

      if (!rzpRes.ok) {
        const errorText = await rzpRes.text();
        logTelemetry({
          service: 'create-razorpay-order',
          level: 'error',
          traceId,
          durationMs: getDuration(),
          event: 'order.create',
          errorCode: 'GATEWAY_ERROR',
          message: 'Razorpay API returned error creating order',
          metadata: { statusCode: rzpRes.status, errorText: errorText.slice(0, 500) },
        });

        // Release the atomic seat reservation on gateway failure
        if (reservationId) {
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              metadata: {
                release_reason: 'gateway_order_creation_failed',
                error_response: errorText.slice(0, 500),
                failed_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', reservationId);
        }

        return new Response(
          JSON.stringify({ error: 'Payment gateway error initiating order' }),
          { status: 502, headers: responseHeaders }
        );
      }

      const rzpData = await rzpRes.json();
      razorpayOrderId = rzpData.id;
    } else {
      // Gateway is unconfigured: fail closed immediately and release the seat reservation
      if (reservationId) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              release_reason: 'gateway_unconfigured',
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId);
      }

      logTelemetry({
        service: 'create-razorpay-order',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'order.create',
        errorCode: 'GATEWAY_UNCONFIGURED',
        message: 'Payment gateway credentials are not configured on this server',
      });

      return new Response(
        JSON.stringify({ error: 'Payment gateway credentials are not configured on this server' }),
        { status: 503, headers: responseHeaders }
      );
    }

    // 5. Critical Gate: Link provider order ID to the atomically reserved payment row
    let paymentRecordId = reservationId;

    if (reservationId) {
      const { error: updateOrderError } = await supabase
        .from('payments')
        .update({
          order_id: razorpayOrderId,
          notes: {
            cohort_title: checkoutData.title,
            user_email: user.email,
            user_id: user.id,
            cohort_id: cohortId,
          },
          metadata: {
            initiated_at: new Date().toISOString(),
            trace_id: traceId,
            user_email: user.email,
            cohort_title: checkoutData.title,
            cohort_price_inr: checkoutData.price_inr,
            created_via: 'create-razorpay-order',
            razorpay_order_id: razorpayOrderId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId);

      if (updateOrderError) {
        logTelemetry({
          service: 'create-razorpay-order',
          level: 'error',
          traceId,
          durationMs: getDuration(),
          event: 'order.create',
          errorCode: 'RESERVATION_LINK_FAILED',
          message: `CRITICAL: Failed to link order ID to atomic reservation: ${updateOrderError.message}`,
          metadata: { reservationId, razorpayOrderId, error: updateOrderError },
        });

        // Release reservation
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              release_reason: 'failed_to_link_order_id',
              error: updateOrderError.message,
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId);

        return new Response(
          JSON.stringify({
            error: 'Unable to initiate checkout: payment attempt could not be recorded in database.',
            details: updateOrderError.message,
          }),
          { status: 500, headers: responseHeaders }
        );
      }
    } else {
      // Fallback for legacy database environments without atomic reservation RPC
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
            trace_id: traceId,
            user_email: user.email,
            cohort_title: checkoutData.title,
            cohort_price_inr: checkoutData.price_inr,
            created_via: 'create-razorpay-order',
          },
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (insertOrderError || !insertedPayment) {
        logTelemetry({
          service: 'create-razorpay-order',
          level: 'error',
          traceId,
          durationMs: getDuration(),
          event: 'order.create',
          errorCode: 'FALLBACK_INSERT_FAILED',
          message: 'CRITICAL: Failed to persist pending payment attempt in database',
          metadata: { error: insertOrderError },
        });

        return new Response(
          JSON.stringify({
            error: 'Unable to initiate checkout: payment attempt could not be recorded in database.',
            details: insertOrderError?.message || 'Database write unconfirmed',
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      paymentRecordId = insertedPayment.id;
    }

    logTelemetry({
      service: 'create-razorpay-order',
      level: 'info',
      traceId,
      durationMs: getDuration(),
      event: 'order.create',
      message: `Created order ${razorpayOrderId} for cohort ${cohortId} (user: ${user.id})`,
      metadata: { orderId: razorpayOrderId, cohortId, amount: amountInPaise, paymentRecordId },
    });

    // 6. Return verified order details to frontend only after local payment record is securely persisted
    return new Response(
      JSON.stringify({
        success: true,
        orderId: razorpayOrderId,
        amount: amountInPaise,
        currency,
        keyId: razorpayKeyId || 'rzp_test_placeholder',
        cohortTitle: checkoutData.title,
        paymentRecordId,
        expiresAt: checkoutData.expires_at,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logTelemetry({
      service: 'create-razorpay-order',
      level: 'error',
      traceId,
      durationMs: getDuration(),
      event: 'order.create',
      errorCode: 'UNHANDLED_EXCEPTION',
      message: `Unhandled exception in create-razorpay-order: ${message}`,
      metadata: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
