import { describe, it, expect } from 'vitest';
import {
  detectCloudPlatform,
  validateDeliverableFile,
  isDirectFileUrl,
  MAX_CHALLENGE_FILE_SIZE_BYTES,
} from '../../lib/services/challengeUploadService';

describe('challengeUploadService - Cloud Platform Auto-Detection', () => {
  it('accurately detects Loom video walkthrough links', () => {
    const res = detectCloudPlatform('https://www.loom.com/share/9b10620894564883bb85df649811abdc');
    expect(res.platform).toBe('loom');
    expect(res.name).toBe('Loom');
    expect(res.badgeText).toContain('Loom');
    expect(res.icon).toBe('video');
  });

  it('accurately detects Google Drive links', () => {
    const driveFile = detectCloudPlatform('https://drive.google.com/file/d/1yW-9_abcdef/view?usp=sharing');
    expect(driveFile.platform).toBe('drive');
    expect(driveFile.name).toBe('Google Drive');

    const driveFolder = detectCloudPlatform('https://drive.google.com/drive/folders/1ABC_xyz');
    expect(driveFolder.platform).toBe('drive');

    const docs = detectCloudPlatform('https://docs.google.com/document/d/123');
    expect(docs.platform).toBe('drive');
  });

  it('accurately detects Frame.io video review presentation links', () => {
    const frameFull = detectCloudPlatform('https://app.frame.io/presentations/b34e2c88-5188-4171-8bc6-f6ab0e5c8e22');
    expect(frameFull.platform).toBe('frameio');
    expect(frameFull.name).toBe('Frame.io');
    expect(frameFull.icon).toBe('film');

    const frameShort = detectCloudPlatform('https://f.io/xYz123aB');
    expect(frameShort.platform).toBe('frameio');
  });

  it('accurately detects YouTube links (standard & short URLs)', () => {
    const ytWatch = detectCloudPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(ytWatch.platform).toBe('youtube');
    expect(ytWatch.name).toBe('YouTube');

    const ytShort = detectCloudPlatform('https://youtu.be/dQw4w9WgXcQ?si=abcdef');
    expect(ytShort.platform).toBe('youtube');
  });

  it('accurately detects GitHub pull requests and repositories', () => {
    const pr = detectCloudPlatform('https://github.com/procuthub/client-app/pull/142');
    expect(pr.platform).toBe('github');
    expect(pr.name).toBe('GitHub');

    const repo = detectCloudPlatform('https://github.com/my-user/premiere-motion-graphics');
    expect(repo.platform).toBe('github');
  });

  it('accurately detects Figma design boards and prototypes', () => {
    const figmaFile = detectCloudPlatform('https://www.figma.com/file/abcdef123456/Sprint-Storyboards');
    expect(figmaFile.platform).toBe('figma');
    expect(figmaFile.name).toBe('Figma');

    const figmaProto = detectCloudPlatform('https://www.figma.com/proto/abcdef123456/Prototype');
    expect(figmaProto.platform).toBe('figma');
  });

  it('accurately detects Vimeo video links', () => {
    const vimeo = detectCloudPlatform('https://vimeo.com/76979871');
    expect(vimeo.platform).toBe('vimeo');
    expect(vimeo.name).toBe('Vimeo');
  });

  it('falls back to generic external web link for portfolio or other URLs', () => {
    const generic = detectCloudPlatform('https://myeditorportfolio.com/showreel-day-07.html');
    expect(generic.platform).toBe('generic');
    expect(generic.name).toBe('External Link');
  });
});

describe('challengeUploadService - Deliverable File Validation', () => {
  it('rejects empty 0-byte file with clear feedback', () => {
    const emptyFile = new File([], 'rough_cut.mp4', { type: 'video/mp4' });
    const res = validateDeliverableFile(emptyFile);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('0 Bytes');
  });

  it('rejects oversized files exceeding 100MB limit with guidance to use Cloud Link', () => {
    // Mock a 150MB file
    const oversizedFile = {
      name: '4k_raw_prores.mov',
      size: 150 * 1024 * 1024,
      type: 'video/quicktime',
    } as unknown as File;

    const res = validateDeliverableFile(oversizedFile, MAX_CHALLENGE_FILE_SIZE_BYTES);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('direct upload limit');
    expect(res.error).toContain('Cloud Link tab');
  });

  it('validates video exports (.mp4, .mov, .webm)', () => {
    const mp4 = new File(['mock content'], 'final_color_grade.mp4', { type: 'video/mp4' });
    const resMp4 = validateDeliverableFile(mp4);
    expect(resMp4.valid).toBe(true);
    expect(resMp4.category).toBe('video');
    expect(resMp4.label).toContain('MP4 Video Cut');

    const mov = new File(['mock content'], 'commercial_edit.mov', { type: 'video/quicktime' });
    const resMov = validateDeliverableFile(mov);
    expect(resMov.valid).toBe(true);
    expect(resMov.category).toBe('video');
  });

  it('validates image exports (.png, .jpg, .webp)', () => {
    const png = new File(['mock content'], 'youtube_thumbnail_v2.png', { type: 'image/png' });
    const res = validateDeliverableFile(png);
    expect(res.valid).toBe(true);
    expect(res.category).toBe('image');
    expect(res.label).toContain('PNG Image');
  });

  it('validates project archives (.zip) and NLE project files (.prproj, .drp)', () => {
    const zip = new File(['mock content'], 'motion_graphics_assets.zip', { type: 'application/zip' });
    const resZip = validateDeliverableFile(zip);
    expect(resZip.valid).toBe(true);
    expect(resZip.category).toBe('archive');

    const prproj = new File(['mock content'], 'sequence_cut.prproj', { type: 'application/octet-stream' });
    const resPr = validateDeliverableFile(prproj);
    expect(resPr.valid).toBe(true);
    expect(resPr.category).toBe('archive');
  });

  it('validates PDF storyboards and documents', () => {
    const pdf = new File(['mock content'], 'storyboard_deck.pdf', { type: 'application/pdf' });
    const res = validateDeliverableFile(pdf);
    expect(res.valid).toBe(true);
    expect(res.category).toBe('document');
  });
});

describe('challengeUploadService - isDirectFileUrl', () => {
  it('detects Supabase storage paths and raw media endpoints as direct file URLs', () => {
    expect(isDirectFileUrl('https://xyz.supabase.co/storage/v1/object/public/submissions/u1/cut.mp4')).toBe(true);
    expect(isDirectFileUrl('submissions/u1/cut.mp4')).toBe(true);
    expect(isDirectFileUrl('https://mycdn.com/export.mov?token=123')).toBe(true);
    expect(isDirectFileUrl('https://files.com/project.zip')).toBe(true);
  });

  it('identifies streaming, code and cloud links as non-direct file URLs', () => {
    expect(isDirectFileUrl('https://loom.com/share/123')).toBe(false);
    expect(isDirectFileUrl('https://drive.google.com/file/d/123/view')).toBe(false);
    expect(isDirectFileUrl('https://github.com/org/repo/pull/1')).toBe(false);
    expect(isDirectFileUrl('https://app.frame.io/presentations/123')).toBe(false);
  });
});
