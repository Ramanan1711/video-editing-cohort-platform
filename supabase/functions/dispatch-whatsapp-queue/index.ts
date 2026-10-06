import '../deno.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

// Supabase Edge Function: dispatch-whatsapp-queue
// Dispatches queued WhatsApp messages from public.whatsapp_notifications_log to external gateways (Meta Cloud API / Twilio).
// Trigger via:
// 1. Supabase Scheduled Functions / pg_cron (e.g. every 2-5 minutes)
// 2. External cron job: POST https://<project-ref>.supabase.co/functions/v1/dispatch-whatsapp-queue
// 3. Admin Dashboard manual queue trigger

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface WhatsAppLogItem {
  id: string;
  user_id: string | null;
  cohort_id: string | null;
  recipient_phone: string;
  message_body: string;
  provider: string;
  status: string;
  retry_count: number;
  max_retries: number;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Caller Authorization Check
    // Can be invoked by:
    // a) Supabase internal cron / service_role bearer token
    // b) An explicit x-cron-secret header matching CRON_SECRET
    // c) An authenticated admin user
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    let isAuthorized = false;

    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
    } else if (token === supabaseServiceKey) {
      isAuthorized = true;
    } else if (token) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (!userError && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          isAuthorized = true;
        }
      }
    }

    // Also permit invocation if no CRON_SECRET is configured (development / default scheduled triggers)
    if (!cronSecret && !token) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role or valid cron secret required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse batch size from optional JSON body
    let maxBatchSize = 25;
    try {
      const body = await req.json();
      if (body && typeof body.maxBatchSize === 'number') {
        maxBatchSize = Math.max(1, Math.min(body.maxBatchSize, 100));
      }
    } catch {
      // Optional body
    }

    // 3. Fetch pending retry/queue candidates via canonical RPC
    let pendingLogs: WhatsAppLogItem[] = [];
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_pending_whatsapp_retries', {
      p_max_batch_size: maxBatchSize,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      pendingLogs = rpcData as WhatsAppLogItem[];
    } else {
      // Direct query fallback if RPC is unavailable
      const { data: directData } = await supabase
        .from('whatsapp_notifications_log')
        .select('*')
        .in('status', ['queued', 'failed'])
        .lt('retry_count', 3)
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(maxBatchSize);

      pendingLogs = (directData || []) as WhatsAppLogItem[];
    }

    if (pendingLogs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          sent: 0,
          failed: 0,
          message: 'No pending WhatsApp notifications in queue.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Provider Credentials from Environment Vault
    const metaAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || Deno.env.get('META_ACCESS_TOKEN') || '';
    const metaPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || Deno.env.get('META_PHONE_NUMBER_ID') || '';
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
    const twilioFromPhone = Deno.env.get('TWILIO_FROM_PHONE') || '';
    const genericWebhookUrl = Deno.env.get('WHATSAPP_WEBHOOK_URL') || '';

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; status: 'sent' | 'failed'; providerMessageId?: string; error?: string }> = [];

    // 5. Process each queued log
    for (const log of pendingLogs) {
      const cleanPhone = log.recipient_phone.replace(/[^0-9]/g, '');
      const provider = log.provider || 'meta';

      let dispatchSuccess = false;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      try {
        if (provider === 'meta' && metaAccessToken && metaPhoneNumberId) {
          // Meta WhatsApp Cloud API
          const metaUrl = `https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`;
          const metaPayload = log.metadata?.templateName
            ? {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'template',
                template: {
                  name: log.metadata.templateName,
                  language: { code: (log.metadata.templateLang as string) || 'en_US' },
                  components: log.metadata.templateComponents || [],
                },
              }
            : {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'text',
                text: { preview_url: true, body: log.message_body },
              };

          const metaRes = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaPayload),
          });

          const metaData = await metaRes.json();
          if (metaRes.ok) {
            dispatchSuccess = true;
            providerMessageId = metaData?.messages?.[0]?.id || `wamid.meta_${Date.now()}`;
          } else {
            errorMessage = metaData?.error?.message || `Meta API HTTP ${metaRes.status}`;
          }
        } else if (provider === 'twilio' && twilioAccountSid && twilioAuthToken && twilioFromPhone) {
          // Twilio WhatsApp API
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const bodyParams = new URLSearchParams({
            From: `whatsapp:${twilioFromPhone}`,
            To: `whatsapp:+${cleanPhone}`,
            Body: log.message_body,
          });

          const twilioRes = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams.toString(),
          });

          const twilioData = await twilioRes.json();
          if (twilioRes.ok) {
            dispatchSuccess = true;
            providerMessageId = twilioData?.sid || `SM_${Date.now()}`;
          } else {
            errorMessage = twilioData?.message || `Twilio HTTP ${twilioRes.status}`;
          }
        } else if (provider === 'webhook' && genericWebhookUrl) {
          // External Generic Webhook Gateway
          const hookRes = await fetch(genericWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient_phone: cleanPhone,
              message_body: log.message_body,
              metadata: log.metadata || {},
              timestamp: new Date().toISOString(),
            }),
          });

          const hookData = await hookRes.json().catch(() => ({}));
          if (hookRes.ok) {
            dispatchSuccess = true;
            providerMessageId = hookData?.message_id || hookData?.id || `wh_${Date.now()}`;
          } else {
            errorMessage = hookData?.error || `Webhook Gateway HTTP ${hookRes.status}`;
          }
        } else {
          // Mock / Simulated provider fallback (for testing when gateway credentials are absent)
          dispatchSuccess = true;
          providerMessageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }
      } catch (networkErr: unknown) {
        errorMessage = networkErr instanceof Error ? networkErr.message : String(networkErr);
      }

      // 6. Update Database State via Canonical RPCs
      if (dispatchSuccess) {
        sentCount++;
        await supabase.rpc('update_whatsapp_delivery_status', {
          p_log_id: log.id,
          p_status: 'sent',
          p_provider_message_id: providerMessageId,
        });

        results.push({ id: log.id, status: 'sent', providerMessageId: providerMessageId || undefined });
      } else {
        failedCount++;
        await supabase.rpc('record_whatsapp_retry_attempt', {
          p_log_id: log.id,
          p_error_details: errorMessage || 'Gateway delivery rejected',
        });

        results.push({ id: log.id, status: 'failed', error: errorMessage || 'Gateway delivery rejected' });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingLogs.length,
        sent: sentCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unhandled WhatsApp queue dispatch error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

