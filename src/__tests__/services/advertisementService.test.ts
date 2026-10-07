import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAdvertisement,
  deleteAdvertisement,
  getActiveAdvertisements,
  listAdvertisements,
  resolveAdvertisementImageUrl,
  toggleAdvertisementActive,
  updateAdvertisement,
  uploadAdvertisementImage,
  type Advertisement,
} from '../../lib/advertisementService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

describe('Advertisement Service (Authoritative CRUD & Public Delivery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('lists active advertisements ordered by priority and recency', async () => {
    const mockAds: Advertisement[] = [
      {
        id: 'ad-1',
        title: 'Flash Sale 50% Off',
        tagline: 'Limited spots available',
        description: 'Join the top tier cohort with master mentors.',
        image_url: 'https://example.com/banner.jpg',
        cta_text: 'Claim Offer',
        cta_link: '#pricing',
        badge_text: 'FLASH SALE',
        display_type: 'popup',
        is_active: true,
        priority: 10,
        starts_at: '2026-01-01T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ];

    const orderMock2 = vi.fn().mockResolvedValue({ data: mockAds, error: null });
    const orderMock1 = vi.fn().mockReturnValue({ order: orderMock2 });
    const orMock = vi.fn().mockReturnValue({ order: orderMock1 });
    const lteMock = vi.fn().mockReturnValue({ or: orMock });
    const eqMock = vi.fn().mockReturnValue({ lte: lteMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock,
    } as unknown as ReturnType<typeof supabase.from>);

    const active = await getActiveAdvertisements();
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe('Flash Sale 50% Off');
    expect(active[0].priority).toBe(10);
  });

  it('creates a new advertisement and returns the record', async () => {
    const newAdData = {
      title: 'New VFX Bootcamp',
      tagline: 'Weekend intensive',
      description: 'Master After Effects & Nuke.',
      cta_text: 'Enroll Now',
      cta_link: '/register',
      badge_text: 'NEW BATCH',
      display_type: 'popup' as const,
      is_active: true,
      priority: 5,
    };

    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'ad-new-123', ...newAdData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });

    vi.mocked(supabase.from).mockReturnValue({
      insert: insertMock,
    } as unknown as ReturnType<typeof supabase.from>);

    const created = await createAdvertisement(newAdData, 'admin-user-1');
    expect(created.id).toBe('ad-new-123');
    expect(created.title).toBe('New VFX Bootcamp');
    expect(insertMock).toHaveBeenCalled();
  });

  it('updates and toggles advertisement active status', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'ad-1', title: 'Updated Title', is_active: false },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });

    vi.mocked(supabase.from).mockReturnValue({
      update: updateMock,
    } as unknown as ReturnType<typeof supabase.from>);

    const updated = await updateAdvertisement('ad-1', { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');

    const toggled = await toggleAdvertisementActive('ad-1', false);
    expect(toggled.is_active).toBe(false);
  });

  it('deletes an advertisement by id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

    vi.mocked(supabase.from).mockReturnValue({
      delete: deleteMock,
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(deleteAdvertisement('ad-1')).resolves.not.toThrow();
    expect(deleteMock).toHaveBeenCalled();
  });

  it('uploads image to storage and resolves url', async () => {
    const mockFile = new File(['image-bytes'], 'banner.png', { type: 'image/png' });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://supabase.co/storage/banner.png' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://supabase.co/storage/banner.png?token=123' }, error: null }),
    } as unknown as ReturnType<typeof supabase.storage.from>);

    const url = await uploadAdvertisementImage(mockFile);
    expect(url).toContain('https://supabase.co/storage/banner.png');
  });

  it('falls back seamlessly to local storage when database query fails', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockImplementation(() => {
        throw new Error('Supabase network error');
      }),
      insert: vi.fn().mockImplementation(() => {
        throw new Error('Supabase network error');
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const ad = await createAdvertisement({
      title: 'Offline Fallback Ad',
      description: 'Works during disconnected testing.',
      is_active: true,
      priority: 2,
    });

    expect(ad.id).toBeDefined();
    expect(ad.title).toBe('Offline Fallback Ad');

    const all = await listAdvertisements();
    expect(all.some((a) => a.title === 'Offline Fallback Ad')).toBe(true);

    const active = await getActiveAdvertisements();
    expect(active.some((a) => a.title === 'Offline Fallback Ad')).toBe(true);
  });

  describe('resolveAdvertisementImageUrl (400 Bad Request Fix & Resolution)', () => {
    it('converts public course-assets URLs into long-lived signed URLs', async () => {
      const publicUrl =
        'https://betuukklywzbikcbtdvz.supabase.co/storage/v1/object/public/course-assets/advertisements/1791367797295-utow3o-Gemini_Generated_Image_9268839268839268.png';
      const expectedSignedUrl =
        'https://betuukklywzbikcbtdvz.supabase.co/storage/v1/object/sign/course-assets/advertisements/1791367797295-utow3o-Gemini_Generated_Image_9268839268839268.png?token=mocktoken';

      const createSignedUrlMock = vi.fn().mockResolvedValue({
        data: { signedUrl: expectedSignedUrl },
        error: null,
      });

      vi.mocked(supabase.storage.from).mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      } as unknown as ReturnType<typeof supabase.storage.from>);

      const result = await resolveAdvertisementImageUrl(publicUrl);
      expect(result).toBe(expectedSignedUrl);
      expect(createSignedUrlMock).toHaveBeenCalledWith(
        'advertisements/1791367797295-utow3o-Gemini_Generated_Image_9268839268839268.png',
        31536000
      );
    });

    it('preserves already signed URLs without redundant signing calls', async () => {
      const alreadySigned =
        'https://betuukklywzbikcbtdvz.supabase.co/storage/v1/object/sign/course-assets/advertisements/image.png?token=validtoken';
      const createSignedUrlMock = vi.fn();

      vi.mocked(supabase.storage.from).mockReturnValue({
        createSignedUrl: createSignedUrlMock,
      } as unknown as ReturnType<typeof supabase.storage.from>);

      const result = await resolveAdvertisementImageUrl(alreadySigned);
      expect(result).toBe(alreadySigned);
      expect(createSignedUrlMock).not.toHaveBeenCalled();
    });

    it('preserves external image URLs directly', async () => {
      const externalUrl = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809';
      const result = await resolveAdvertisementImageUrl(externalUrl);
      expect(result).toBe(externalUrl);
    });

    it('returns empty string for null, undefined, or blank values', async () => {
      expect(await resolveAdvertisementImageUrl(null)).toBe('');
      expect(await resolveAdvertisementImageUrl(undefined)).toBe('');
      expect(await resolveAdvertisementImageUrl('   ')).toBe('');
    });
  });
});
