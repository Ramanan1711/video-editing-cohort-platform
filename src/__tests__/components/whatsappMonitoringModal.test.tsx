import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsAppMonitoringModal } from '../../components/internship/WhatsAppMonitoringModal';
import * as whatsappService from '../../lib/whatsappService';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../lib/whatsappService', async () => {
  const actual = await vi.importActual('../../lib/whatsappService');
  return {
    ...actual,
    listCohortWhatsAppLogs: vi.fn(),
    getCohortWhatsAppStats: vi.fn(),
    processPendingWhatsAppRetries: vi.fn(),
    retrySingleWhatsAppMessage: vi.fn(),
    dispatchWhatsAppMessage: vi.fn(),
    getWhatsAppProvider: vi.fn().mockReturnValue({ name: 'mock' }),
  };
});

describe('WhatsAppMonitoringModal Component', () => {
  const mockLogs: whatsappService.WhatsAppLog[] = [
    {
      id: 'log-1',
      user_id: 'u-1',
      student_name: 'Jordan Lee',
      student_email: 'jordan@test.com',
      recipient_phone: '919876543210',
      event_type: 'daily_challenge',
      message_body: '🚀 Day 1 challenge is live!',
      provider: 'mock',
      provider_message_id: 'wamid.mock_111',
      status: 'delivered',
      retry_count: 0,
      max_retries: 3,
      created_at: '2026-09-29T10:00:00Z',
      delivered_at: '2026-09-29T10:01:00Z',
    },
    {
      id: 'log-2',
      user_id: 'u-2',
      student_name: 'Sam Taylor',
      student_email: 'sam@test.com',
      recipient_phone: '919123456789',
      event_type: 'inactivity_nudge',
      message_body: '⚠️ Don\'t lose your streak!',
      provider: 'mock',
      provider_message_id: 'wamid.mock_222',
      status: 'failed',
      error_details: 'Gateway timeout (504)',
      retry_count: 2,
      max_retries: 3,
      next_retry_at: '2026-09-29T10:15:00Z',
      created_at: '2026-09-29T09:30:00Z',
    },
  ];

  const mockStats: whatsappService.WhatsAppCohortStats = {
    cohort_id: 'c-1',
    total_messages: 2,
    sent_count: 1,
    delivered_count: 1,
    read_count: 0,
    failed_count: 1,
    queued_count: 0,
    delivery_rate_pct: 50.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (whatsappService.getWhatsAppProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ name: 'mock' });
    (whatsappService.listCohortWhatsAppLogs as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    (whatsappService.getCohortWhatsAppStats as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);
  });

  it('renders WhatsApp delivery hub with metrics, provider badge, and log records', async () => {
    render(
      <WhatsAppMonitoringModal
        isOpen={true}
        onClose={vi.fn()}
        cohortId="c-1"
        cohortName="15-Day Kinetic Editing Sprint"
      />
    );

    expect(screen.getByText(/WhatsApp Delivery & Gateway Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider: MOCK/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
      expect(screen.getByText('Sam Taylor')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getAllByText(/Delivered/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Failed/i).length).toBeGreaterThan(0);
    });
  });

  it('triggers batch retry processing when clicking Run Retries button', async () => {
    (whatsappService.processPendingWhatsAppRetries as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      processedIds: ['log-2'],
    });

    render(
      <WhatsAppMonitoringModal
        isOpen={true}
        onClose={vi.fn()}
        cohortId="c-1"
        cohortName="15-Day Kinetic Editing Sprint"
      />
    );

    const runRetriesBtn = screen.getByRole('button', { name: /Run Retries/i });
    fireEvent.click(runRetriesBtn);

    await waitFor(() => {
      expect(whatsappService.processPendingWhatsAppRetries).toHaveBeenCalledWith(20);
    });
  });

  it('triggers single message re-dispatch for failed messages', async () => {
    (whatsappService.retrySingleWhatsAppMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      log: { ...mockLogs[1], status: 'sent', retry_count: 3 },
    });

    render(
      <WhatsAppMonitoringModal
        isOpen={true}
        onClose={vi.fn()}
        cohortId="c-1"
        cohortName="15-Day Kinetic Editing Sprint"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sam Taylor')).toBeInTheDocument();
    });

    const retryBtns = screen.getAllByRole('button', { name: /Retry/i });
    // There is "Run Retries" and the table row "Retry" button
    const tableRetryBtn = retryBtns.find((b) => b.textContent?.trim() === 'Retry');
    expect(tableRetryBtn).toBeDefined();

    if (tableRetryBtn) {
      fireEvent.click(tableRetryBtn);
      await waitFor(() => {
        expect(whatsappService.retrySingleWhatsAppMessage).toHaveBeenCalledWith('log-2');
      });
    }
  });
});
