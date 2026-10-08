import { formatFileSize, getSecureSubmissionUrl } from './assetStorageService';

export type SubmissionMode = 'file' | 'link';

export interface CloudPlatformMatch {
  platform: 'loom' | 'drive' | 'frameio' | 'youtube' | 'github' | 'figma' | 'vimeo' | 'generic';
  name: string;
  badgeText: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };
  placeholder: string;
  tip: string;
  icon: 'video' | 'cloud' | 'film' | 'play' | 'code' | 'layout' | 'link';
}

export function detectCloudPlatform(rawUrl: string): CloudPlatformMatch {
  const url = rawUrl.trim().toLowerCase();

  if (url.includes('loom.com/')) {
    return {
      platform: 'loom',
      name: 'Loom',
      badgeText: 'Loom Video Walkthrough',
      badgeStyle: {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800',
      },
      placeholder: 'https://www.loom.com/share/...',
      tip: "Verified Loom link. Ensure video visibility is set to 'Anyone with the link can view'.",
      icon: 'video',
    };
  }

  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    return {
      platform: 'drive',
      name: 'Google Drive',
      badgeText: 'Google Drive Export / Folder',
      badgeStyle: {
        bg: 'bg-blue-50 dark:bg-blue-950/60',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
      },
      placeholder: 'https://drive.google.com/file/d/... or /drive/folders/...',
      tip: "Google Drive link detected. Ensure file sharing is set to 'Anyone with the link can view'.",
      icon: 'cloud',
    };
  }

  if (url.includes('frame.io') || url.includes('f.io/')) {
    return {
      platform: 'frameio',
      name: 'Frame.io',
      badgeText: 'Frame.io Video Review Cut',
      badgeStyle: {
        bg: 'bg-purple-50 dark:bg-purple-950/60',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-200 dark:border-purple-800',
      },
      placeholder: 'https://app.frame.io/presentations/... or https://f.io/...',
      tip: 'Frame.io review cut detected. Mentors can leave second-by-second timecode feedback.',
      icon: 'film',
    };
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return {
      platform: 'youtube',
      name: 'YouTube',
      badgeText: 'YouTube Cut (Unlisted Recommended)',
      badgeStyle: {
        bg: 'bg-red-50 dark:bg-red-950/60',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
      },
      placeholder: 'https://youtu.be/... or https://youtube.com/watch?v=...',
      tip: "YouTube video detected. Keep privacy setting on 'Unlisted' so mentors can review securely.",
      icon: 'play',
    };
  }

  if (url.includes('github.com')) {
    return {
      platform: 'github',
      name: 'GitHub',
      badgeText: 'GitHub Pull Request / Repository',
      badgeStyle: {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-800 dark:text-slate-200',
        border: 'border-slate-300 dark:border-slate-700',
      },
      placeholder: 'https://github.com/organization/repo/pull/1...',
      tip: 'GitHub pull request or repo link detected for code review.',
      icon: 'code',
    };
  }

  if (url.includes('figma.com')) {
    return {
      platform: 'figma',
      name: 'Figma',
      badgeText: 'Figma Design Board / Prototype',
      badgeStyle: {
        bg: 'bg-pink-50 dark:bg-pink-950/60',
        text: 'text-pink-700 dark:text-pink-300',
        border: 'border-pink-200 dark:border-pink-800',
      },
      placeholder: 'https://www.figma.com/file/... or /proto/...',
      tip: 'Figma link detected. Ensure link sharing is enabled with view permissions.',
      icon: 'layout',
    };
  }

  if (url.includes('vimeo.com')) {
    return {
      platform: 'vimeo',
      name: 'Vimeo',
      badgeText: 'Vimeo Video Cut',
      badgeStyle: {
        bg: 'bg-teal-50 dark:bg-teal-950/60',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-200 dark:border-teal-800',
      },
      placeholder: 'https://vimeo.com/...',
      tip: 'Vimeo video detected. If password protected, provide the password in the notes below.',
      icon: 'video',
    };
  }

  return {
    platform: 'generic',
    name: 'External Link',
    badgeText: 'Cloud / Portfolio Link',
    badgeStyle: {
      bg: 'bg-slate-50 dark:bg-slate-900',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-800',
    },
    placeholder: 'https://...',
    tip: 'Make sure your link is publicly accessible to reviewers without login barriers.',
    icon: 'link',
  };
}

export type CohortTrackType = 'video' | 'coding' | 'non_coding' | 'general';

export interface TrackFilterConfig {
  track: 'video' | 'coding' | 'general';
  label: string;
  allowedExtensions: string[];
  acceptAttribute: string;
  maxSizeBytes: number;
  recommendedSizeLabel: string;
  guidanceTip: string;
  suggestedCloudPlatforms: string[];
}

export const VIDEO_EDITING_EXTENSIONS = [
  'mp4',
  'mov',
  'zip',
  'prproj',
  'drp',
  'wav',
  'mkv',
  'webm',
  'aep',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
];
export const CODING_EXTENSIONS = [
  'zip',
  'tar.gz',
  'tar',
  'gz',
  'py',
  'java',
  'ts',
  'json',
  'js',
  'tsx',
  'jsx',
  'cpp',
  'c',
  'rs',
  'go',
];
export const GENERAL_EXTENSIONS = [
  ...VIDEO_EDITING_EXTENSIONS,
  ...CODING_EXTENSIONS,
  'doc',
  'docx',
  'txt',
];

export const VIDEO_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB (Recommended max or streaming link)
export const CODING_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (Recommended max or GitHub repo/PR)
export const MAX_CHALLENGE_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB baseline default

export function resolveCohortTrack(
  trackType?: string | null,
  cohortName?: string | null
): 'video' | 'coding' | 'general' {
  const normTrack = (trackType || '').toLowerCase().trim();
  const normName = (cohortName || '').toLowerCase().trim();

  if (normTrack === 'coding') return 'coding';
  if (normTrack === 'video' || normTrack === 'non_coding') return 'video';
  if (normTrack === 'general') return 'general';

  // If trackType was explicitly given and unrecognized, or not provided, check cohort naming
  if (
    normName.includes('python') ||
    normName.includes('java') ||
    normName.includes('code') ||
    normName.includes('react') ||
    normName.includes('web') ||
    normName.includes('backend') ||
    normName.includes('frontend') ||
    normName.includes('fullstack') ||
    normName.includes('typescript')
  ) {
    return 'coding';
  }

  if (
    normName.includes('video') ||
    normName.includes('edit') ||
    normName.includes('premiere') ||
    normName.includes('after effects') ||
    normName.includes('davinci') ||
    normName.includes('cinesprint') ||
    normName.includes('cinematography') ||
    normName.includes('color grading')
  ) {
    return 'video';
  }

  return 'general';
}

export function getTrackFilterConfig(
  trackType?: string | null,
  cohortName?: string | null
): TrackFilterConfig {
  const resolved = resolveCohortTrack(trackType, cohortName);

  if (resolved === 'coding') {
    return {
      track: 'coding',
      label: 'Coding & Architecture Track',
      allowedExtensions: CODING_EXTENSIONS,
      acceptAttribute: '.zip,.tar.gz,.tar,.gz,.py,.java,.ts,.json,.js,.tsx,.jsx,.cpp,.c,.rs,.go',
      maxSizeBytes: CODING_MAX_FILE_SIZE_BYTES,
      recommendedSizeLabel: '50 MB (or direct GitHub repository / PR URL)',
      guidanceTip:
        'Coding cohorts accept .zip, .tar.gz, .py, .java, .ts, or .json source deliverables, or a direct GitHub repository / PR URL for code review.',
      suggestedCloudPlatforms: ['GitHub', 'Google Drive'],
    };
  }

  if (resolved === 'video') {
    return {
      track: 'video',
      label: 'Video Production & Editing Track',
      allowedExtensions: VIDEO_EDITING_EXTENSIONS,
      acceptAttribute: '.mp4,.mov,.zip,.prproj,.drp,.wav,.mkv,.webm,.aep,.png,.jpg,.jpeg,.webp,.pdf',
      maxSizeBytes: VIDEO_MAX_FILE_SIZE_BYTES,
      recommendedSizeLabel: '500 MB (or Frame.io / Drive / Loom / YouTube streaming link)',
      guidanceTip:
        'Video Editing cohorts accept .mp4, .mov, .zip, .prproj, .drp, or .wav exports (recommended up to 500 MB, or streaming link).',
      suggestedCloudPlatforms: ['Frame.io', 'Loom', 'Google Drive', 'YouTube'],
    };
  }

  return {
    track: 'general',
    label: 'General Production Track',
    allowedExtensions: GENERAL_EXTENSIONS,
    acceptAttribute: '.mp4,.mov,.webm,.zip,.prproj,.drp,.wav,.py,.java,.ts,.json,.png,.jpg,.webp,.pdf',
    maxSizeBytes: MAX_CHALLENGE_FILE_SIZE_BYTES,
    recommendedSizeLabel: '100 MB (or cloud link)',
    guidanceTip: 'Accepts video renders, project timelines, and deliverables up to 100 MB.',
    suggestedCloudPlatforms: ['Frame.io', 'Google Drive', 'Loom', 'GitHub', 'YouTube'],
  };
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category: 'video' | 'audio' | 'code' | 'archive' | 'document' | 'image' | 'other';
  label: string;
}

export function validateDeliverableFile(
  file: File,
  trackOrMaxBytes?: string | number,
  customMaxBytes?: number,
  cohortName?: string
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.', category: 'other', label: 'Unknown' };
  }
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Selected file is empty (0 Bytes). Please export a valid render.',
      category: 'other',
      label: 'Empty',
    };
  }

  let effectiveTrack: string;
  let effectiveMaxBytes: number | undefined;

  if (typeof trackOrMaxBytes === 'number') {
    effectiveMaxBytes = trackOrMaxBytes;
    effectiveTrack = 'general';
  } else if (typeof trackOrMaxBytes === 'string') {
    effectiveTrack = trackOrMaxBytes;
    effectiveMaxBytes = customMaxBytes;
  } else {
    // Default when no 2nd argument passed
    effectiveTrack = 'general';
    effectiveMaxBytes = customMaxBytes ?? MAX_CHALLENGE_FILE_SIZE_BYTES;
  }

  const config = getTrackFilterConfig(effectiveTrack, cohortName);
  const maxBytes = effectiveMaxBytes ?? config.maxSizeBytes;

  const fileNameLower = file.name.toLowerCase();
  const ext = fileNameLower.endsWith('.tar.gz')
    ? 'tar.gz'
    : fileNameLower.split('.').pop() || '';

  // Course-Aware Extension Enforcement
  if (typeof trackOrMaxBytes === 'string' && trackOrMaxBytes !== 'general') {
    const isExtensionAllowed = config.allowedExtensions.includes(ext);
    if (!isExtensionAllowed) {
      if (config.track === 'video') {
        return {
          valid: false,
          error: `Video Editing cohorts only accept .mp4, .mov, .zip, .prproj, .drp, or .wav exports. For large timelines over 500MB, please share via Frame.io, Loom, or Google Drive on the Cloud Link tab.`,
          category: 'other',
          label: 'Unsupported Format',
        };
      }
      if (config.track === 'coding') {
        return {
          valid: false,
          error: `Coding cohorts only accept .zip, .tar.gz, .py, .java, .ts, or .json source deliverables, or a direct GitHub repository / PR URL.`,
          category: 'other',
          label: 'Unsupported Format',
        };
      }
    }
  }

  // Size validation with course-specific guidance
  if (file.size > maxBytes) {
    if (config.track === 'video') {
      return {
        valid: false,
        error: `File size (${formatFileSize(file.size)}) exceeds the recommended ${formatFileSize(
          maxBytes
        )} limit. For large multi-GB raw project timelines or footage cuts, please share a streaming link (Frame.io, Loom, Drive, YouTube) via the Cloud Link tab.`,
        category: 'other',
        label: 'Oversized',
      };
    }
    if (config.track === 'coding') {
      return {
        valid: false,
        error: `File size (${formatFileSize(file.size)}) exceeds the ${formatFileSize(
          maxBytes
        )} limit for code archives. Please submit your direct GitHub repository or Pull Request URL via the Cloud Link tab.`,
        category: 'other',
        label: 'Oversized',
      };
    }
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the ${formatFileSize(
        maxBytes
      )} direct upload limit. Please share via the Cloud Link tab.`,
      category: 'other',
      label: 'Oversized',
    };
  }

  // Categorization
  if (['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)) {
    return { valid: true, category: 'video', label: `${ext.toUpperCase()} Video Cut` };
  }
  if (['wav', 'mp3', 'aac', 'flac'].includes(ext)) {
    return { valid: true, category: 'audio', label: `${ext.toUpperCase()} Master Audio Stem` };
  }
  if (['py', 'java', 'ts', 'js', 'tsx', 'jsx', 'cpp', 'c', 'rs', 'go'].includes(ext)) {
    return { valid: true, category: 'code', label: `${ext.toUpperCase()} Source File` };
  }
  if (ext === 'json') {
    return { valid: true, category: 'code', label: 'JSON Config / Payload' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tar.gz'].includes(ext)) {
    const isCode = config.track === 'coding';
    return {
      valid: true,
      category: 'archive',
      label: isCode ? `${ext.toUpperCase()} Code Archive` : `${ext.toUpperCase()} Project Archive`,
    };
  }
  if (['prproj', 'drp', 'fcpxml', 'aep', 'psd'].includes(ext)) {
    return { valid: true, category: 'archive', label: `${ext.toUpperCase()} Timeline Project File` };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return { valid: true, category: 'image', label: `${ext.toUpperCase()} Image / Thumbnail` };
  }
  if (ext === 'pdf') {
    return { valid: true, category: 'document', label: 'PDF Storyboard / Document' };
  }

  return { valid: true, category: 'other', label: `${ext.toUpperCase() || 'FILE'} Deliverable` };
}

export function isDirectFileUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.includes('storage/v1/object') ||
    clean.includes('submissions/') ||
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.wav') ||
    clean.endsWith('.mp3') ||
    clean.endsWith('.png') ||
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.zip') ||
    clean.endsWith('.tar.gz') ||
    clean.endsWith('.tar') ||
    clean.endsWith('.gz') ||
    clean.endsWith('.py') ||
    clean.endsWith('.java') ||
    clean.endsWith('.ts') ||
    clean.endsWith('.json') ||
    clean.endsWith('.pdf') ||
    clean.endsWith('.prproj') ||
    clean.endsWith('.drp') ||
    clean.endsWith('.aep')
  );
}

/**
 * Automatically generates a secure, expiring signed URL for mentor grading
 * or deliverable inspection.
 * External links (Drive, Loom, Frame.io, YouTube, GitHub, Figma) are returned directly.
 * Private Supabase storage objects have a fresh time-limited token issued (default 1 hour).
 */
export async function getExpiringMentorGradingUrl(
  submissionUrl: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!submissionUrl) return '';
  return getSecureSubmissionUrl(submissionUrl, expiresInSeconds);
}

