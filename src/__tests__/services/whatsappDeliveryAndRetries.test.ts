import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MetaWhatsAppProvider,
  TwilioWhatsAppProvider,
  WebhookWhatsAppProvider,
  MockWhatsAppProvider,
  getWhatsAppProvider,
  dispatchWhatsAppMessage,
  processPendingWhatsAppRetries,
  syncWhatsAppDeliveryStatus,
  retrySingleWhatsAppMessage,
  getCohortWhatsAppStats,
} from '../../lib/whatsappService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('WhatsApp Automated Provider Integration, Delivery Tracking & Retries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Adapters', () => {
    it('MockWhatsAppProvider returns successful sent status with pseudo wamid', async () => {
      const provider = new MockWhatsAppProvider();
      const res = await provider.send('+91 98765 43210', 'Hello from test');

      expect(res.success).toBe(true);
      expect(res.status).toBe('sent');
      expect(res.providerMessageId).toMatch(/^wamid\.mock_/);
      expect(res.statusCode).toBe(200);
    });

    it('MockWhatsAppProvider simulates gateway service outage when requested', async () => {
      const provider = new MockWhatsAppProvider(true);
      const res = await provider.send('+91 98765 43210', 'Hello from test');

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.statusCode).toBe(503);
      expect(res.error).toContain('Simulated WhatsApp Gateway Service Unavailable');
    });

    it('MetaWhatsAppProvider formats payloads and parses message ID on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: 'wamid.HBgLMTA...' }],
        }),
      });
      globalThis.fetch = mockFetch;

      const provider = new MetaWhatsAppProvider('phone-id-123', 'access-token-xyz');
      const res = await provider.send('919876543210', 'Test Meta Message');

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('wamid.HBgLMTA...');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/phone-id-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token-xyz',
          }),
        })
      );
    });

    it('TwilioWhatsAppProvider formats Basic auth and form urlencoded payloads', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          sid: 'SM1234567890abcdef',
        }),
      });
      globalThis.fetch = mockFetch;

      const provider = new TwilioWhatsAppProvider('AC_SID', 'AUTH_TOKEN', '14155238886');
      const res = await provider.send('+919876543210', 'Test Twilio Message');

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('SM1234567890abcdef');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC_SID/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
          }),
        })
      );
    });

    it('WebhookWhatsAppProvider dispatches payload to external gateway endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          message_id: 'gw_msg_999',
        }),
      });
      globalThis.fetch = mockFetch;

      const provider = new WebhookWhatsAppProvider('https://custom-gateway.io/api/send', 'secret_key');
      const res = await provider.send('919876543210', 'Hello Custom Gateway');

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('gw_msg_999');
    });

    it('getWhatsAppProvider defaults to mock provider if environment variables are not configured', () => {
      const provider = getWhatsAppProvider('mock');
      expect(provider.name).toBe('mock');
    });
  });

  describe('Automated Dispatch Engine & Opt-Out Enforcement', () => {
    it('dispatches message through authoritative RPC and provider when user has opted in', async () => {
      const mockRpc = vi.fn().mockImplementation((fn: string) => {
        if (fn === 'dispatch_whatsapp_message') {
          return Promise.resolve({
            data: {
              id: '00000000-0000-0000-0000-000000000001',
              user_id: 'u-1',
              cohort_id: 'c-1',
              recipient_phone: '919876543210',
              event_type: 'daily_challenge',
              message_body: 'Day 1 task is live!',
              provider: 'mock',
              status: 'queued',
              retry_count: 0,
              max_retries: 3,
            },
            error: null,
          });
        }
        if (fn === 'record_whatsapp_retry_attempt') {
          return Promise.resolve({
            data: {
              id: '00000000-0000-0000-0000-000000000001',
              status: 'sent',
              provider_message_id: 'wamid.mock_123',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockRpc);

      const result = await dispatchWhatsAppMessage({
        userId: 'u-1',
        cohortId: 'c-1',
        phone: '+91 98765 43210',
        eventType: 'daily_challenge',
        message: 'Day 1 task is live!',
        provider: 'mock',
      });

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('dispatch_whatsapp_message', expect.objectContaining({
        p_user_id: 'u-1',
        p_recipient_phone: '919876543210',
        p_event_type: 'daily_challenge',
      }));
    });

    it('rejects dispatch and returns cancelled status when user opted out of WhatsApp', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'cancelled-log-1',
          user_id: 'u-optout',
          status: 'cancelled',
          error_details: 'Recipient opted out of WhatsApp notifications',
        },
        error: null,
      });

      const result = await dispatchWhatsAppMessage({
        userId: 'u-optout',
        phone: '+91 98765 43210',
        eventType: 'inactivity_nudge',
        message: 'Keep your streak!',
      });

      expect(result.success).toBe(false);
      expect(result.log.status).toBe('cancelled');
      expect(result.error).toContain('opted out');
    });
  });

  describe('Automated Queue Retries & Delivery Sync', () => {
    it('processes batch of pending retries and calculates retry counts', async () => {
      const mockCandidate = {
        id: 'retry-candidate-1',
        user_id: 'u-1',
        recipient_phone: '919876543210',
        message_body: 'Retry task drop',
        provider: 'mock',
        status: 'queued',
        retry_count: 1,
        max_retries: 3,
        metadata: {},
      };

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: string) => {
        if (fn === 'get_pending_whatsapp_retries') {
          return Promise.resolve({ data: [mockCandidate], error: null });
        }
        if (fn === 'record_whatsapp_retry_attempt') {
          return Promise.resolve({ data: { ...mockCandidate, status: 'sent' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const summary = await processPendingWhatsAppRetries(10);

      expect(summary.attempted).toBe(1);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.processedIds).toContain('retry-candidate-1');
    });

    it('syncs inbound webhook delivery receipts to delivered and read states', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: '00000000-0000-0000-0000-000000000001' },
              error: null,
            }),
          }),
        }),
      });

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: '00000000-0000-0000-0000-000000000001', status: 'delivered' },
        error: null,
      });

      const synced = await syncWhatsAppDeliveryStatus(
        'wamid.HBgLMTA...',
        'delivered',
        null,
        '2026-09-29T14:00:00Z'
      );

      expect(synced).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('update_whatsapp_delivery_status', expect.objectContaining({
        p_provider_message_id: 'wamid.HBgLMTA...',
        p_status: 'delivered',
      }));
    });

    it('retries single failed message on demand from admin/mentor console', async () => {
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'failed-log-uuid',
                recipient_phone: '919876543210',
                message_body: 'Retry single note',
                provider: 'mock',
                status: 'failed',
                retry_count: 1,
                max_retries: 3,
                metadata: {},
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          id: 'failed-log-uuid',
          status: 'sent',
          retry_count: 2,
        },
        error: null,
      });

      const res = await retrySingleWhatsAppMessage('failed-log-uuid');
      expect(res.success).toBe(true);
      expect(res.log.status).toBe('sent');
    });

    it('computes cohort WhatsApp telemetry and delivery rates', async () => {
      (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          cohort_id: 'cohort-uuid',
          total_messages: 50,
          sent_count: 50,
          delivered_count: 48,
          read_count: 42,
          failed_count: 1,
          queued_count: 1,
          delivery_rate_pct: 96.0,
        },
        error: null,
      });

      const stats = await getCohortWhatsAppStats('cohort-uuid');

      expect(stats.total_messages).toBe(50);
      expect(stats.delivery_rate_pct).toBe(96.0);
      expect(stats.delivered_count).toBe(48);
      expect(stats.read_count).toBe(42);
    });
  });
});
