import { supabase } from './supabaseClient';

export type AdvertisementDisplayType = 'popup' | 'banner' | 'floating_card';

export interface Advertisement {
  id: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  badge_text?: string | null;
  display_type: AdvertisementDisplayType;
  is_active: boolean;
  priority: number;
  starts_at: string;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAdvertisementInput {
  title: string;
  tagline?: string;
  description?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  badge_text?: string;
  display_type?: AdvertisementDisplayType;
  is_active?: boolean;
  priority?: number;
  starts_at?: string;
  expires_at?: string | null;
}

export interface UpdateAdvertisementInput {
  title?: string;
  tagline?: string | null;
  description?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  badge_text?: string | null;
  display_type?: AdvertisementDisplayType;
  is_active?: boolean;
  priority?: number;
  starts_at?: string;
  expires_at?: string | null;
}

// Local storage fallback key for resilience when Supabase table is unreachable or during offline preview
const LOCAL_STORAGE_ADS_KEY = 'iunoware_offline_ads';

function getLocalAds(): Advertisement[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAds(ads: Advertisement[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_ADS_KEY, JSON.stringify(ads));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Fetch all active, non-expired advertisements for the Homepage.
 */
export async function getActiveAdvertisements(): Promise<Advertisement[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('homepage_advertisements')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const ads = data as Advertisement[];
      return Promise.all(
        ads.map(async (ad) => {
          if (ad.image_url) {
            const resolved = await resolveAdvertisementImageUrl(ad.image_url);
            return { ...ad, image_url: resolved };
          }
          return ad;
        })
      );
    }
  } catch {
    // Fall back to local storage if network or table fails
  }

  const local = getLocalAds();
  const now = Date.now();
  const activeLocal = local.filter((ad) => {
    if (!ad.is_active) return false;
    if (ad.expires_at && new Date(ad.expires_at).getTime() <= now) return false;
    if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return false;
    return true;
  });

  return Promise.all(
    activeLocal.map(async (ad) => {
      if (ad.image_url) {
        const resolved = await resolveAdvertisementImageUrl(ad.image_url);
        return { ...ad, image_url: resolved };
      }
      return ad;
    })
  );
}

/**
 * List all advertisements (active and inactive) for Admin Operations.
 */
export async function listAdvertisements(): Promise<Advertisement[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_advertisements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const ads = data as Advertisement[];
      return Promise.all(
        ads.map(async (ad) => {
          if (ad.image_url) {
            const resolved = await resolveAdvertisementImageUrl(ad.image_url);
            return { ...ad, image_url: resolved };
          }
          return ad;
        })
      );
    }
  } catch {
    // Fall back to local storage
  }

  const local = getLocalAds();
  return Promise.all(
    local.map(async (ad) => {
      if (ad.image_url) {
        const resolved = await resolveAdvertisementImageUrl(ad.image_url);
        return { ...ad, image_url: resolved };
      }
      return ad;
    })
  );
}

/**
 * Create a new advertisement.
 */
export async function createAdvertisement(
  input: CreateAdvertisementInput,
  createdBy?: string
): Promise<Advertisement> {
  const resolvedImageUrl = input.image_url ? await resolveAdvertisementImageUrl(input.image_url) : null;
  const payload = {
    title: input.title.trim(),
    tagline: input.tagline?.trim() || null,
    description: input.description?.trim() || null,
    image_url: resolvedImageUrl,
    cta_text: input.cta_text?.trim() || 'Learn More',
    cta_link: input.cta_link?.trim() || '#pricing',
    badge_text: input.badge_text?.trim() || 'SPECIAL OFFER',
    display_type: input.display_type || 'popup',
    is_active: input.is_active !== undefined ? input.is_active : true,
    priority: Number(input.priority) || 0,
    starts_at: input.starts_at || new Date().toISOString(),
    expires_at: input.expires_at || null,
    created_by: createdBy || null,
  };

  try {
    const { data, error } = await supabase
      .from('homepage_advertisements')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data as Advertisement;
    }
  } catch {
    // Fall through to local fallback
  }

  // Fallback simulation
  const newAd: Advertisement = {
    id: `ad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const current = getLocalAds();
  saveLocalAds([newAd, ...current]);
  return newAd;
}

/**
 * Update an existing advertisement.
 */
export async function updateAdvertisement(
  id: string,
  input: UpdateAdvertisementInput
): Promise<Advertisement> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.tagline !== undefined) updates.tagline = input.tagline?.trim() || null;
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.image_url !== undefined) {
    updates.image_url = input.image_url ? await resolveAdvertisementImageUrl(input.image_url) : null;
  }
  if (input.cta_text !== undefined) updates.cta_text = input.cta_text?.trim() || 'Learn More';
  if (input.cta_link !== undefined) updates.cta_link = input.cta_link?.trim() || '#pricing';
  if (input.badge_text !== undefined) updates.badge_text = input.badge_text?.trim() || null;
  if (input.display_type !== undefined) updates.display_type = input.display_type;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.priority !== undefined) updates.priority = Number(input.priority) || 0;
  if (input.starts_at !== undefined) updates.starts_at = input.starts_at;
  if (input.expires_at !== undefined) updates.expires_at = input.expires_at || null;

  try {
    const { data, error } = await supabase
      .from('homepage_advertisements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      return data as Advertisement;
    }
  } catch {
    // Fall through to local fallback
  }

  const current = getLocalAds();
  const idx = current.findIndex((a) => a.id === id);
  if (idx !== -1) {
    const updated = { ...current[idx], ...updates } as Advertisement;
    current[idx] = updated;
    saveLocalAds(current);
    return updated;
  }

  throw new Error(`Advertisement ${id} not found.`);
}

/**
 * Toggle advertisement active status with a single click.
 */
export async function toggleAdvertisementActive(
  id: string,
  isActive: boolean
): Promise<Advertisement> {
  return updateAdvertisement(id, { is_active: isActive });
}

/**
 * Delete an advertisement.
 */
export async function deleteAdvertisement(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('homepage_advertisements')
      .delete()
      .eq('id', id);

    if (!error) return;
  } catch {
    // Fall through to local fallback
  }

  const current = getLocalAds();
  saveLocalAds(current.filter((a) => a.id !== id));
}

/**
 * Resolves an advertisement image URL to an accessible URL.
 * If the image is stored in course-assets, creates a long-lived signed URL so it doesn't fail with 400 Bad Request.
 */
export async function resolveAdvertisementImageUrl(fileUrl: string | null | undefined): Promise<string> {
  if (!fileUrl || !fileUrl.trim()) return '';

  const cleanUrl = fileUrl.trim();

  // If already a signed URL with active token query param, return as is
  if (cleanUrl.includes('/object/sign/') && cleanUrl.includes('token=')) {
    return cleanUrl;
  }

  // If external non-Supabase URL (e.g. Unsplash, Cloudinary), return as is
  if (!cleanUrl.includes('/course-assets/') && !cleanUrl.startsWith('course-assets/')) {
    return cleanUrl;
  }

  // Extract relative storage path inside course-assets
  let objectPath = cleanUrl;
  if (cleanUrl.includes('/course-assets/')) {
    objectPath = cleanUrl.split('/course-assets/')[1];
  } else if (cleanUrl.startsWith('course-assets/')) {
    objectPath = cleanUrl.slice('course-assets/'.length);
  }
  objectPath = objectPath.split('?')[0].split('#')[0];
  objectPath = decodeURIComponent(objectPath).replace(/^\/+/, '');

  if (!objectPath) return cleanUrl;

  try {
    const { data: signed, error: signErr } = await supabase.storage
      .from('course-assets')
      .createSignedUrl(objectPath, 60 * 60 * 24 * 365); // 1-year valid signed URL

    if (!signErr && signed?.signedUrl) {
      return signed.signedUrl;
    }
  } catch {
    // Return original url if signing fails
  }

  return cleanUrl;
}

/**
 * Upload an advertisement image file to Supabase storage.
 * Returns a long-lived signed URL that can be viewed publicly without 400 Bad Request.
 */
export async function uploadAdvertisementImage(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `advertisements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('course-assets')
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (!uploadError) {
      // Create a 1-year signed URL so private bucket returns 200 OK
      const { data: signedData, error: signedError } = await supabase.storage
        .from('course-assets')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
      }
    }
  } catch (err) {
    console.error('Storage upload error:', err);
  }

  // Fall back to FileReader base64 or Object URL for local/offline resilience
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(file));
    };
    reader.onerror = () => {
      resolve(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  });
}
