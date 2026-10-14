import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-correlation-id, x-request-id',
  'Access-Control-Expose-Headers': 'x-correlation-id',
};

interface StructuredTelemetry {
  timestamp: string;
  service: string;
  level: 'info' | 'warn' | 'error';
  traceId: string;
  durationMs: number;
  event: string;
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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      logTelemetry({
        service: 'unlock-challenges',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'auth_check',
        errorCode: 'CONFIG_MISSING',
        message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
      });
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables' }),
        { status: 500, headers: responseHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Caller Authorization Check (Fail-Closed)
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization') || '';
    const apiKeyHeader = req.headers.get('apikey') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let isAuthorized = false;

    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
    } else if (token === supabaseServiceKey || apiKeyHeader === supabaseServiceKey) {
      isAuthorized = true;
    } else if (token) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (!userError && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin' || profile?.role === 'mentor') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      logTelemetry({
        service: 'unlock-challenges',
        level: 'warn',
        traceId,
        durationMs: getDuration(),
        event: 'auth_check',
        errorCode: 'UNAUTHORIZED',
        message: 'Unauthorized caller attempted to trigger challenge unlock',
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Valid cron secret, service_role key, or admin/mentor authorization required.',
        }),
        { status: 401, headers: responseHeaders }
      );
    }

    // Parse optional body for cohort-specific unlock
    let cohortId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.cohort_id === 'string') {
        cohortId = body.cohort_id;
      }
    } catch {
      // Body is optional
    }

    if (cohortId) {
      const { data, error } = await supabase.rpc('unlock_cohort_daily_challenges', {
        p_cohort_id: cohortId,
      });

      if (error) {
        logTelemetry({
          service: 'unlock-challenges',
          level: 'error',
          traceId,
          durationMs: getDuration(),
          event: 'unlock_cohort_challenges',
          errorCode: 'RPC_ERROR',
          message: `Failed to unlock challenges for cohort ${cohortId}: ${error.message}`,
          metadata: { cohortId, error },
        });
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 400,
          headers: responseHeaders,
        });
      }

      logTelemetry({
        service: 'unlock-challenges',
        level: 'info',
        traceId,
        durationMs: getDuration(),
        event: 'unlock_cohort_challenges',
        message: `Unlocked challenges for cohort ${cohortId}`,
        metadata: { cohortId, result: data },
      });

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Default: Unlock all scheduled challenges across all cohorts in their respective local timezones
    const { data, error } = await supabase.rpc('unlock_scheduled_daily_challenges');

    if (error) {
      logTelemetry({
        service: 'unlock-challenges',
        level: 'error',
        traceId,
        durationMs: getDuration(),
        event: 'unlock_scheduled_challenges',
        errorCode: 'RPC_ERROR',
        message: `Failed to execute scheduled challenge unlock: ${error.message}`,
        metadata: { error },
      });
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    logTelemetry({
      service: 'unlock-challenges',
      level: 'info',
      traceId,
      durationMs: getDuration(),
      event: 'unlock_scheduled_challenges',
      message: `Completed timezone-aware scheduled challenge unlock: ${data?.total_unlocked ?? 0} challenges unlocked`,
      metadata: { result: data },
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logTelemetry({
      service: 'unlock-challenges',
      level: 'error',
      traceId,
      durationMs: getDuration(),
      event: 'unhandled_exception',
      errorCode: 'UNHANDLED_EXCEPTION',
      message: `Unhandled exception in unlock-challenges: ${message}`,
      metadata: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
