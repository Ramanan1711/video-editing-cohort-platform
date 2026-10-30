import { describe, it, expect } from 'vitest';
import {
  sniffFileMimeType,
  ALLOWED_SUBMISSION_MIME_TYPES,
} from '../../lib/services/assetStorageService';

describe('3.2 Security Audit & Attack Vectors Hardening', () => {
  describe('Storage File Type Spoofing & Stored XSS Prevention', () => {
    it('defines the required whitelist of allowed submission MIME types', () => {
      expect(ALLOWED_SUBMISSION_MIME_TYPES).toContain('video/mp4');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).toContain('video/quicktime');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).toContain('application/zip');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).toContain('application/x-zip-compressed');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).not.toContain('text/html');
      expect(ALLOWED_SUBMISSION_MIME_TYPES).not.toContain('image/svg+xml');
    });

    it('identifies valid PDF file by %PDF- magic bytes', async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      const file = new File([pdfBytes], 'assignment.pdf', { type: 'application/pdf' });
      const detected = await sniffFileMimeType(file);
      expect(detected).toBe('application/pdf');
    });

    it('identifies valid ZIP archive by PK magic bytes', async () => {
      const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // PK\x03\x04
      const file = new File([zipBytes], 'project.zip', { type: 'application/zip' });
      const detected = await sniffFileMimeType(file);
      expect(detected).toBe('application/zip');
    });

    it('identifies valid MP4 container by ftyp box', async () => {
      // 4 bytes length + 'ftyp' (0x66, 0x74, 0x79, 0x70) + 'isom'
      const mp4Bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, // box length 32
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x69, 0x73, 0x6f, 0x6d, // 'isom'
        0x00, 0x00, 0x02, 0x00,
      ]);
      const file = new File([mp4Bytes], 'cut.mp4', { type: 'video/mp4' });
      const detected = await sniffFileMimeType(file);
      expect(detected).toBe('video/mp4');
    });

    it('identifies valid QuickTime MOV container by ftyp qt box', async () => {
      const movBytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x14, // length
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x71, 0x74, 0x20, 0x20, // 'qt  '
      ]);
      const file = new File([movBytes], 'final_cut.mov', { type: 'video/quicktime' });
      const detected = await sniffFileMimeType(file);
      expect(detected).toBe('video/quicktime');
    });

    it('blocks HTML/script payload disguised as an MP4 video (Stored XSS attempt)', async () => {
      const htmlPayload = '<!DOCTYPE html><html><head><script>alert("XSS")</script></head><body>evil</body></html>';
      const file = new File([htmlPayload], 'cut.mp4', { type: 'video/mp4' });

      await expect(sniffFileMimeType(file)).rejects.toThrow(
        /executable markup or script tags/i
      );
    });

    it('blocks Windows executable binary disguised as a ZIP file', async () => {
      // DOS executable signature 'MZ' (0x4D, 0x5A)
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const file = new File([exeBytes], 'submission.zip', { type: 'application/zip' });

      await expect(sniffFileMimeType(file)).rejects.toThrow(
        /Executable binary detected/i
      );
    });

    it('blocks Linux ELF executable binary disguised as a PDF file', async () => {
      // ELF signature \x7fELF (0x7F, 0x45, 0x4C, 0x46)
      const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const file = new File([elfBytes], 'report.pdf', { type: 'application/pdf' });

      await expect(sniffFileMimeType(file)).rejects.toThrow(
        /Executable binary detected/i
      );
    });

    it('rejects files smaller than 4 bytes', async () => {
      const tinyBytes = new Uint8Array([0x01, 0x02]);
      const file = new File([tinyBytes], 'tiny.mp4', { type: 'video/mp4' });

      await expect(sniffFileMimeType(file)).rejects.toThrow(
        /File is too small/i
      );
    });
  });

  describe('CORS Origin Allowlist Verification', () => {
    const DEFAULT_ALLOWED_ORIGINS = [
      'https://platform.iunoware.com',
      'https://staging.iunoware.com',
      'https://video-editing-cohort-platform.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
    ];

    function parseEnvOrigins(envString?: string): string[] {
      return (envString || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
        .filter(Boolean);
    }

    function isOriginAllowed(origin: string, envAllowedOrigins?: string): boolean {
      if (!origin) return true;
      const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();
      const configured = parseEnvOrigins(envAllowedOrigins);
      const allowlist = [...DEFAULT_ALLOWED_ORIGINS, ...configured];
      if (allowlist.includes(normalized)) return true;
      return (
        /^https:\/\/([a-zA-Z0-9-]+\.)*iunoware\.com$/.test(normalized) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(normalized)
      );
    }

    it('permits authorized production and staging origins', () => {
      expect(isOriginAllowed('https://platform.iunoware.com')).toBe(true);
      expect(isOriginAllowed('https://staging.iunoware.com')).toBe(true);
      expect(isOriginAllowed('https://admin.iunoware.com')).toBe(true);
      expect(isOriginAllowed('https://iunoware.com')).toBe(true);
      expect(isOriginAllowed('https://video-editing-cohort-platform.vercel.app')).toBe(true);
      expect(isOriginAllowed('https://video-editing-cohort-platform-git-feat.vercel.app')).toBe(true);
    });

    it('permits dynamic origins configured via ALLOWED_ORIGINS environment variable with whitespace and trailing slashes', () => {
      const customEnv = ' https://custom-domain.com/ , https://learn.partner.org/ ';
      expect(isOriginAllowed('https://custom-domain.com', customEnv)).toBe(true);
      expect(isOriginAllowed('https://custom-domain.com/', customEnv)).toBe(true);
      expect(isOriginAllowed('https://learn.partner.org', customEnv)).toBe(true);
    });

    it('permits local development ports', () => {
      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:5173')).toBe(true);
    });

    it('strictly rejects malicious third-party origins', () => {
      expect(isOriginAllowed('https://malicious-attacker.com')).toBe(false);
      expect(isOriginAllowed('https://evil-iunoware.com')).toBe(false);
      expect(isOriginAllowed('http://platform.iunoware.com.attacker.com')).toBe(false);
      expect(isOriginAllowed('https://not-iunoware.com')).toBe(false);
    });
  });
});

