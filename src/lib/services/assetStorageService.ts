import { supabase } from '../supabaseClient';

export type VisibilityRule = 'enrolled' | 'public' | 'after_completion';
export type ResourceType = 'video' | 'pdf' | 'document' | 'image' | 'project_file' | 'link' | 'other';

export interface LessonResource {
  id: string;
  lesson_id: string;
  name: string;
  url: string;
  visibility?: VisibilityRule;
  resource_type?: ResourceType;
  file_size?: number | null;
  created_at?: string;
}

export interface LessonResourceInput {
  lesson_id: string;
  name: string;
  url: string;
  visibility?: VisibilityRule;
  resource_type?: ResourceType;
  file_size?: number | null;
}

export function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'webm': return 'video/webm';
    case 'm4v': return 'video/x-m4v';
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'rtf': return 'application/rtf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'gif': return 'image/gif';
    case 'prproj': return 'application/x-premiere-project';
    case 'drp': return 'application/x-davinci-resolve-project';
    case 'fcpxml': return 'application/xml';
    case 'aep': return 'application/x-after-effects';
    case 'psd': return 'image/vnd.adobe.photoshop';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    case '7z': return 'application/x-7z-compressed';
    default: return 'application/octet-stream';
  }
}

export function detectResourceType(fileNameOrUrl: string): ResourceType {
  const clean = fileNameOrUrl.split('?')[0].toLowerCase();
  const ext = clean.split('.').pop() || '';
  if (['mp4', 'mov', 'webm', 'mkv', 'm4v'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) return 'document';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['prproj', 'drp', 'fcpxml', 'aep', 'psd', 'ai', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'project_file';
  if (fileNameOrUrl.startsWith('http://') || fileNameOrUrl.startsWith('https://')) return 'link';
  return 'other';
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Lesson Resources CRUD
export async function listLessonResources(lessonId: string): Promise<LessonResource[]> {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('id, lesson_id, name, url, visibility, resource_type, file_size, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    // Fallback if visibility or resource_type columns are not yet in the DB
    const fallback = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, name, url, created_at')
      .eq('lesson_id', lessonId)
      .order('name');
    if (fallback.error) return [];
    return (fallback.data ?? []).map((item) => ({
      ...item,
      visibility: 'enrolled' as VisibilityRule,
      resource_type: detectResourceType(item.url),
      file_size: null,
    }));
  }

  return (data ?? []).map((res) => ({
    ...res,
    visibility: (res.visibility as VisibilityRule) || 'enrolled',
    resource_type: (res.resource_type as ResourceType) || detectResourceType(res.url),
  })) as LessonResource[];
}

export async function listAllLessonResources(): Promise<LessonResource[]> {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('id, lesson_id, name, url, visibility, resource_type, file_size, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    const fallback = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, name, url, created_at')
      .order('created_at', { ascending: false });
    if (fallback.error) return [];
    return (fallback.data ?? []).map((item) => ({
      ...item,
      visibility: 'enrolled' as VisibilityRule,
      resource_type: detectResourceType(item.url),
      file_size: null,
    }));
  }

  return (data ?? []).map((res) => ({
    ...res,
    visibility: (res.visibility as VisibilityRule) || 'enrolled',
    resource_type: (res.resource_type as ResourceType) || detectResourceType(res.url),
  })) as LessonResource[];
}

export async function createLessonResource(input: LessonResourceInput): Promise<LessonResource> {
  const resourcePayload: Record<string, unknown> = {
    lesson_id: input.lesson_id,
    name: input.name.trim(),
    url: input.url.trim(),
    visibility: input.visibility ?? 'enrolled',
    resource_type: input.resource_type ?? detectResourceType(input.url),
    file_size: input.file_size ?? null,
  };

  let result = await supabase.from('lesson_resources').insert(resourcePayload).select().single();
  if (result.error && (result.error.message.includes('visibility') || result.error.message.includes('resource_type') || result.error.message.includes('file_size'))) {
    result = await supabase
      .from('lesson_resources')
      .insert({
        lesson_id: input.lesson_id,
        name: input.name.trim(),
        url: input.url.trim(),
      })
      .select('id, lesson_id, name, url, created_at')
      .single();
  }

  if (result.error) throw result.error;

  return {
    ...result.data,
    visibility: result.data.visibility ?? (input.visibility || 'enrolled'),
    resource_type: result.data.resource_type ?? (input.resource_type || detectResourceType(input.url)),
    file_size: result.data.file_size ?? input.file_size,
  } as LessonResource;
}

export async function updateLessonResource(id: string, input: Omit<LessonResourceInput, 'lesson_id'>): Promise<LessonResource> {
  const resourcePayload: Record<string, unknown> = {
    name: input.name.trim(),
    url: input.url.trim(),
    visibility: input.visibility ?? 'enrolled',
    resource_type: input.resource_type ?? detectResourceType(input.url),
    file_size: input.file_size ?? null,
  };

  let result = await supabase.from('lesson_resources').update(resourcePayload).eq('id', id).select().single();
  if (result.error && (result.error.message.includes('visibility') || result.error.message.includes('resource_type') || result.error.message.includes('file_size'))) {
    result = await supabase
      .from('lesson_resources')
      .update({
        name: input.name.trim(),
        url: input.url.trim(),
      })
      .select('id, lesson_id, name, url, created_at')
      .single();
  }

  if (result.error) throw result.error;

  return {
    ...result.data,
    visibility: result.data.visibility ?? (input.visibility || 'enrolled'),
    resource_type: result.data.resource_type ?? (input.resource_type || detectResourceType(input.url)),
    file_size: result.data.file_size ?? input.file_size,
  } as LessonResource;
}

export async function deleteLessonResource(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_resources').delete().eq('id', id);
  if (error) throw error;
}

// Storage asset uploads
export async function uploadCourseAsset(file: File, folder = 'lessons'): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || inferMimeType(file.name);
  const { error } = await supabase.storage.from('course-assets').upload(path, file, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  // Return the canonical private storage reference rather than a public CDN URL
  return `course-assets/${path}`;
}

export interface UploadSubmissionOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadSubmissionFile(
  userId: string,
  file: File,
  options?: UploadSubmissionOptions
): Promise<string> {
  if (options?.signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || inferMimeType(file.name);

  options?.onProgress?.(10);

  const { error: uploadError } = await supabase.storage.from('submissions').upload(path, file, {
    upsert: false,
    contentType,
  });

  if (options?.signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || (uploadError as { statusCode?: string }).statusCode === '404') {
      throw new Error(
        'Storage bucket "submissions" not found in Supabase. Please create the private "submissions" bucket in Supabase Dashboard (Storage -> New Bucket) or execute migration 20260921000003_storage_and_hardening.sql.'
      );
    }
    throw uploadError;
  }

  options?.onProgress?.(90);

  // The 'submissions' bucket is strictly private. Generate a signed expiring URL for immediate access
  // or return the canonical private storage path reference.
  const { data: signedData, error: signedError } = await supabase.storage
    .from('submissions')
    .createSignedUrl(path, 86400); // 24-hour expiration

  options?.onProgress?.(100);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Fallback to private object path reference
  return `submissions/${path}`;
}

/**
 * Resolves a secure, time-limited signed URL for private student submission files.
 * External submission links (YouTube, Vimeo, Frame.io, Google Drive) are preserved as-is.
 * Fails closed with an explicit error if URL signing fails for private storage.
 */
export async function getSecureSubmissionUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (!fileUrl) return '';

  // Preserve external third-party streaming/sharing links
  const isSupabaseStorage =
    fileUrl.includes('/storage/v1/object/') ||
    fileUrl.startsWith('submissions/') ||
    (fileUrl.includes('supabase.co') && fileUrl.includes('submissions'));

  if (!isSupabaseStorage && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    return fileUrl;
  }

  // Extract object path within the 'submissions' bucket
  let objectPath = fileUrl;
  if (fileUrl.includes('/submissions/')) {
    objectPath = fileUrl.split('/submissions/')[1];
  } else if (fileUrl.startsWith('submissions/')) {
    objectPath = fileUrl.slice('submissions/'.length);
  }

  // Strip query parameters or URL hashes
  objectPath = objectPath.split('?')[0].split('#')[0];
  objectPath = decodeURIComponent(objectPath);

  if (!objectPath || !objectPath.trim()) {
    throw new Error('Invalid submission storage path.');
  }

  const { data, error } = await supabase.storage
    .from('submissions')
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || 'Failed to generate secure signed URL for submission: access denied or file unavailable.'
    );
  }

  return data.signedUrl;
}

/**
 * Checks whether an asset URL or storage path points to protected Supabase course assets
 * or contains a time-limited signed token.
 */
export function isSecurableAsset(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false;
  return (
    fileUrl.includes('/storage/v1/object/') ||
    fileUrl.startsWith('course-assets/') ||
    fileUrl.includes('course-assets') ||
    fileUrl.startsWith('lessons/') ||
    fileUrl.startsWith('resources/') ||
    fileUrl.includes('token=')
  );
}

/**
 * Resolves a secure, time-limited signed URL for private course assets or lesson downloads.
 * External URLs are returned as-is.
 * Fails closed with an explicit error if URL signing fails for private storage.
 */
export async function getSecureAssetUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  if (!fileUrl) return '';

  const isSupabaseStorage = isSecurableAsset(fileUrl);

  if (!isSupabaseStorage && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    return fileUrl;
  }

  let objectPath = fileUrl;
  if (fileUrl.includes('/course-assets/')) {
    objectPath = fileUrl.split('/course-assets/')[1];
  } else if (fileUrl.startsWith('course-assets/')) {
    objectPath = fileUrl.slice('course-assets/'.length);
  }

  objectPath = objectPath.split('?')[0].split('#')[0];
  objectPath = decodeURIComponent(objectPath).replace(/^\/+/, '');

  if (!objectPath || !objectPath.trim()) {
    throw new Error('Invalid course asset storage path.');
  }

  const { data, error } = await supabase.storage
    .from('course-assets')
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || 'Failed to generate secure signed URL for course asset: access denied or file unavailable.'
    );
  }

  return data.signedUrl;
}

/**
 * Validates access entitlements and returns a secure, time-limited signed download URL
 * for a lesson resource. Enforces enrollment and completion rules via server-side RPC.
 * Fails closed without falling back to raw URLs if authorization or entitlement fails.
 */
export async function getLessonResourceDownloadUrl(
  resourceId: string,
  fallbackUrl?: string,
  expiresIn = 3600
): Promise<string> {
  if (!resourceId) {
    if (fallbackUrl) {
      return getSecureAssetUrl(fallbackUrl, expiresIn);
    }
    return '';
  }

  const { data, error } = await supabase.rpc('get_lesson_resource_download_url', {
    p_resource_id: resourceId,
  });

  if (error) {
    const errMsg = error.message || 'Failed to resolve download URL.';
    throw new Error(errMsg);
  }

  const payload = data as { url?: string } | null;
  const targetUrl = payload?.url;
  if (!targetUrl) {
    throw new Error('No download URL available for this resource.');
  }

  return getSecureAssetUrl(targetUrl, expiresIn);
}

