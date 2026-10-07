import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdvertisementsTab } from '../../components/admin/tabs/AdvertisementsTab';
import { HomepageAdvertisementModal } from '../../components/home/HomepageAdvertisementModal';
import * as adService from '../../lib/advertisementService';

vi.mock('../../context/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Advertisement UI Components', () => {
  const mockAds: adService.Advertisement[] = [
    {
      id: 'ad-promo-1',
      title: '50% Off Flash Sale',
      tagline: 'First 20 Students Only',
      description: 'Get comprehensive curriculum access and live mentor critiques.',
      image_url: 'https://images.unsplash.com/photo-test.jpg',
      cta_text: 'Claim 50% Off',
      cta_link: '#pricing',
      badge_text: 'FLASH SALE',
      display_type: 'popup',
      is_active: true,
      priority: 10,
      starts_at: '2026-01-01T00:00:00Z',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'ad-promo-2',
      title: 'Weekend Masterclass',
      tagline: 'Sound Design Secrets',
      description: 'Audio mixing in Premiere.',
      image_url: null,
      cta_text: 'Join Workshop',
      cta_link: '/workshops',
      badge_text: 'WORKSHOP',
      display_type: 'banner',
      is_active: false,
      priority: 5,
      starts_at: '2026-01-01T00:00:00Z',
      created_at: '2026-10-02T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('AdvertisementsTab (Admin Operations)', () => {
    it('renders list of advertisements and metric cards', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onToggle = vi.fn().mockResolvedValue(undefined);

      render(
        <AdvertisementsTab
          advertisements={mockAds}
          loading={false}
          onSaveAdvertisement={onSave}
          onDeleteAdvertisement={onDelete}
          onToggleActive={onToggle}
        />
      );

      expect(screen.getByText('Homepage Ads & Promotional Campaigns')).toBeInTheDocument();
      expect(screen.getByText('50% Off Flash Sale')).toBeInTheDocument();
      expect(screen.getByText('Weekend Masterclass')).toBeInTheDocument();
      expect(screen.getByText('Total Campaigns')).toBeInTheDocument();
    });

    it('opens create modal, allows form input and calls onSaveAdvertisement', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onToggle = vi.fn().mockResolvedValue(undefined);

      render(
        <AdvertisementsTab
          advertisements={mockAds}
          loading={false}
          onSaveAdvertisement={onSave}
          onDeleteAdvertisement={onDelete}
          onToggleActive={onToggle}
        />
      );

      const newBtn = screen.getByRole('button', { name: /new advertisement/i });
      fireEvent.click(newBtn);

      expect(screen.getByText('Publish Homepage Advertisement')).toBeInTheDocument();

      const titleInput = screen.getByPlaceholderText(/e\.g\. Masterclass 50% Off Flash Pass/i);
      fireEvent.change(titleInput, { target: { value: 'Color Grading Masterclass' } });

      const submitBtn = screen.getByRole('button', { name: /publish advertisement/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Color Grading Masterclass',
          }),
          undefined
        );
      });
    });

    it('toggles active status when toggle button is clicked', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onToggle = vi.fn().mockResolvedValue(undefined);

      render(
        <AdvertisementsTab
          advertisements={mockAds}
          loading={false}
          onSaveAdvertisement={onSave}
          onDeleteAdvertisement={onDelete}
          onToggleActive={onToggle}
        />
      );

      // ad-promo-2 is paused, should have "Enable"
      const enableBtn = screen.getByRole('button', { name: /enable/i });
      fireEvent.click(enableBtn);

      expect(onToggle).toHaveBeenCalledWith('ad-promo-2', true);
    });
  });

  describe('HomepageAdvertisementModal (Homepage Visitor Experience)', () => {
    it('fetches active ads and displays popup lightbox when not dismissed', async () => {
      vi.spyOn(adService, 'getActiveAdvertisements').mockResolvedValue([mockAds[0]]);

      render(
        <MemoryRouter>
          <HomepageAdvertisementModal />
        </MemoryRouter>
      );

      // The modal opens after a 1.2s timeout
      await waitFor(
        () => {
          expect(screen.getByText('50% Off Flash Sale')).toBeInTheDocument();
          expect(screen.getByText('Claim 50% Off')).toBeInTheDocument();
        },
        { timeout: 2500 }
      );
    });

    it('stores dismiss timestamp in localStorage when "Don\'t show again today" is clicked', async () => {
      vi.spyOn(adService, 'getActiveAdvertisements').mockResolvedValue([mockAds[0]]);

      render(
        <MemoryRouter>
          <HomepageAdvertisementModal />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('50% Off Flash Sale')).toBeInTheDocument();
        },
        { timeout: 2500 }
      );

      const dismissBtn = screen.getByRole('button', { name: /don't show again today/i });
      fireEvent.click(dismissBtn);

      expect(localStorage.getItem(`iunoware_dismissed_ad_${mockAds[0].id}`)).toBeTruthy();
      expect(screen.queryByText('50% Off Flash Sale')).not.toBeInTheDocument();
    });
  });
});

