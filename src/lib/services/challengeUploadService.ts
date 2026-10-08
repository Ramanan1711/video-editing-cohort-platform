import { formatFileSize } from './assetStorageService';

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

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category: 'video' | 'image' | 'archive' | 'document' | 'other';
  label: string;
}

export const MAX_CHALLENGE_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function validateDeliverableFile(
  file: File,
  maxBytes = MAX_CHALLENGE_FILE_SIZE_BYTES
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
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the ${formatFileSize(
        maxBytes
      )} direct upload limit. For large multi-GB raw project timelines or footage cuts, please share via the Cloud Link tab.`,
      category: 'other',
      label: 'Oversized',
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)) {
    return { valid: true, category: 'video', label: `${ext.toUpperCase()} Video Cut` };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return { valid: true, category: 'image', label: `${ext.toUpperCase()} Image / Thumbnail` };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { valid: true, category: 'archive', label: `${ext.toUpperCase()} Project Archive` };
  }
  if (['prproj', 'drp', 'fcpxml', 'aep', 'psd'].includes(ext)) {
    return { valid: true, category: 'archive', label: `${ext.toUpperCase()} Project File` };
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
    clean.endsWith('.png') ||
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.zip') ||
    clean.endsWith('.pdf') ||
    clean.endsWith('.prproj') ||
    clean.endsWith('.drp')
  );
}

