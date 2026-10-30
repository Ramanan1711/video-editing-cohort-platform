import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { z } from 'https://deno.land/x/zod/mod.ts';

export const ReapExpiredReservationsSchema = z
  .object({
    dryRun: z.boolean().optional(),
  })
  .optional();

/**
 * Resolves allowed origins from the environment variable ALLOWED_ORIGINS (comma-separated).
 * Automatically trims whitespace, strips trailing slashes, and lowercases for reliable matching.
 * e.g. ALLOWED_ORIGINS="https://iunoware.com, https://academy.iunoware.com, https://platform.iunoware.com"
 */
export function getConfiguredOrigins(): string[] {
  const envVal = (typeof Deno !== 'undefined' ? Deno.env.get('ALLOWED_ORIGINS') : undefined) || '';
  return envVal
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://platform.iunoware.com',
  'https://staging.iunoware.com',
  'https://video-editing-cohort-platform.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

export function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Direct non-browser callers (crons or server-to-server)
  const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
  const configured = getConfiguredOrigins();
  const allowlist = [...DEFAULT_ALLOWED_ORIGINS, ...configured];
  if (allowlist.includes(normalizedOrigin)) return true;
  return (
    /^https:\/\/([a-zA-Z0-9-]+\.)*iunoware\.com$/.test(normalizedOrigin) ||
    /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(normalizedOrigin)
  );
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = isOriginAllowed(origin);
  const configured = getConfiguredOrigins();
  const defaultOrigin = configured[0] || 'https://platform.iunoware.com';
  const matchedOrigin = isAllowed && origin ? origin : defaultOrigin;

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Caller Authorization Check (Fail-Closed)
    // Permitted callers:
    // a) External scheduler / cron bearing matching x-cron-secret header
    // b) Internal service_role bearer token or apikey header
    // c) Authenticated staff user (role = 'admin' or 'mentor')
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized invocation of reap-expired-reservations' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate optional payload with runtime Zod contract
    const rawBodyText = await req.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(rawBodyText);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Malformed JSON payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const parseResult = ReapExpiredReservationsSchema.safeParse(rawJson);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Invoke database reaper RPC
    const { data: reapedCount, error: rpcError } = await supabase.rpc(
      'release_expired_cohort_reservations'
    );

    if (rpcError) {
      console.error('Failed to execute release_expired_cohort_reservations:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Reaper RPC execution failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reapedCount: reapedCount ?? 0,
        reapedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Unhandled error in reap-expired-reservations:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

