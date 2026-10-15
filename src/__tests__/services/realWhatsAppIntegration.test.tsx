import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DEFAULT_ACADEMY_WHATSAPP,
  DEFAULT_WHATSAPP_GROUP_FALLBACK_URL,
  formatWhatsAppTaskBlockerMessage,
  getWhatsAppProvider,
  ManualClickToChatProvider,
} from '../../lib/whatsappService';
import { WhatsAppSupportWidget } from '../../components/internship/WhatsAppSupportWidget';
import { WhatsAppBatchGroupBanner } from '../../components/student/WhatsAppBatchGroupBanner';
import { DynamicChallengeSubmissionBox } from '../../components/internship/DynamicChallengeSubmissionBox';

// Mock Toast
vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

describe('Real WhatsApp Integration & Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Academy WhatsApp Configuration & Constants', () => {
    it('resolves real academy phone number (919080995108) by default', () => {
      expect(DEFAULT_ACADEMY_WHATSAPP).toBe('919080995108');
      expect(DEFAULT_ACADEMY_WHATSAPP).not.toBe('919876543210');
    });

    it('resolves default fallback group URL', () => {
      expect(DEFAULT_WHATSAPP_GROUP_FALLBACK_URL).toBe(
        'https://chat.whatsapp.com/G7tEsqF5Mq1FzLzZHlpHjz?mode=gi_t'
      );
    });

    it('getWhatsAppProvider defaults to ManualClickToChatProvider when configured with manual', () => {
      const provider = getWhatsAppProvider('manual');
      expect(provider.name).toBe('manual');
      expect(provider).toBeInstanceOf(ManualClickToChatProvider);
    });

    it('formats contextual task blocker messages properly with student and cohort info', () => {
      const msg = formatWhatsAppTaskBlockerMessage(
        'Rahul Sharma',
        'Batch 15: Premiere Pro Mastery',
        3,
        'Sound Design & Audio Balancing',
        'Audio stems are clipping at -3dB in the dialogue track.'
      );

      expect(msg).toContain('Rahul Sharma');
      expect(msg).toContain('Batch 15: Premiere Pro Mastery');
      expect(msg).toContain('Day 3: Sound Design & Audio Balancing');
      expect(msg).toContain('Audio stems are clipping at -3dB in the dialogue track.');
      expect(msg).toContain('Could you please guide me?');
    });
  });

  describe('WhatsAppSupportWidget Real Link Verification', () => {
    it('uses DEFAULT_ACADEMY_WHATSAPP when mentorPhone is not passed', () => {
      render(
        <WhatsAppSupportWidget
          userId="user-test-123"
          studentName="Rahul Sharma"
          cohortName="Batch 15"
          currentDay={3}
        />
      );

      // Open floating support modal
      const openBtn = screen.getByRole('button', { name: /Open WhatsApp Mentor Support/i });
      fireEvent.click(openBtn);

      // Verify the phone number is displayed in the modal header
      expect(screen.getByText(/\+919080995108/)).toBeInTheDocument();
      expect(screen.queryByText(/9876543210/)).not.toBeInTheDocument();
    });

    it('launches real wa.me link with 919080995108 when clicking direct chat', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <WhatsAppSupportWidget
          userId="user-test-123"
          studentName="Rahul Sharma"
          cohortName="Batch 15"
          currentDay={3}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open WhatsApp Mentor Support/i }));

      const askBtn = screen.getByRole('button', { name: /Ask about Day 3 Challenge/i });
      fireEvent.click(askBtn);

      await vi.waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          expect.stringContaining('https://wa.me/919080995108?text='),
          '_blank',
          'noopener,noreferrer'
        );
      });
    });
  });

  describe('WhatsAppBatchGroupBanner Component', () => {
    it('renders the official batch community banner with correct cohort info and group link', () => {
      render(
        <WhatsAppBatchGroupBanner
          cohortId="cohort-15"
          cohortName="Batch 15: Premiere Pro"
          whatsappGroupUrl="https://chat.whatsapp.com/L1234567890ABCDEF"
          mentorPhone="919080995108"
          studentName="Rahul"
        />
      );

      expect(screen.getByText(/You are enrolled in Batch 15: Premiere Pro!/i)).toBeInTheDocument();

      const joinLink = screen.getByRole('link', { name: /Join WhatsApp Batch Group/i });
      expect(joinLink).toHaveAttribute('href', 'https://chat.whatsapp.com/L1234567890ABCDEF');

      const mentorLink = screen.getByRole('link', { name: /Mentor Help/i });
      expect(mentorLink.getAttribute('href')).toContain('https://wa.me/919080995108?text=');
    });

    it('falls back to DEFAULT_WHATSAPP_GROUP_FALLBACK_URL if cohort group link is empty', () => {
      render(
        <WhatsAppBatchGroupBanner
          cohortId="cohort-15"
          cohortName="Batch 15"
          whatsappGroupUrl={null}
        />
      );

      const joinLink = screen.getByRole('link', { name: /Join WhatsApp Batch Group/i });
      expect(joinLink).toHaveAttribute('href', DEFAULT_WHATSAPP_GROUP_FALLBACK_URL);
    });

    it('minimizes the banner when dismissed and persists to localStorage', () => {
      render(
        <WhatsAppBatchGroupBanner
          cohortId="cohort-15"
          cohortName="Batch 15"
          whatsappGroupUrl="https://chat.whatsapp.com/L1234567890ABCDEF"
        />
      );

      const dismissBtn = screen.getByRole('button', { name: /Dismiss WhatsApp Batch Group banner/i });
      fireEvent.click(dismissBtn);

      expect(localStorage.getItem('dismissed_wa_group_cohort-15')).toBe('true');
      expect(screen.getByText(/Show Details/i)).toBeInTheDocument();
    });
  });

  describe('DynamicChallengeSubmissionBox Real WhatsApp Link', () => {
    it('renders Ask Mentor on WhatsApp link directed to 919080995108 by default', () => {
      render(
        <DynamicChallengeSubmissionBox
          userId="test-user-123"
          challengeId="test-challenge-123"
          studentName="Rahul"
          cohortName="Batch 15"
          dayNumber={3}
          dayTitle="Audio Stem Balancing"
          onSubmit={vi.fn()}
        />
      );

      const askLink = screen.getByRole('link', { name: /Ask Mentor on WhatsApp/i });
      const href = askLink.getAttribute('href');

      expect(href).toContain('https://wa.me/919080995108?text=');
      expect(href).toContain(encodeURIComponent('Day 3: Audio Stem Balancing'));
      expect(href).not.toContain('9876543210');
    });
  });
});
