import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DynamicChallengeSubmissionBox } from '../../components/internship/DynamicChallengeSubmissionBox';
import * as assetStorageService from '../../lib/services/assetStorageService';

vi.mock('../../lib/services/assetStorageService', async () => {
  const actual = await vi.importActual('../../lib/services/assetStorageService');
  return {
    ...actual,
    uploadSubmissionFile: vi.fn(),
    getSecureSubmissionUrl: vi.fn().mockImplementation((url: string) => Promise.resolve(`${url}?token=signed-1h`)),
  };
});

describe('DynamicChallengeSubmissionBox Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tabbed mode selector with Direct File Upload and Cloud Link tabs', () => {
    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole('button', { name: /direct file upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cloud \/ external link/i })).toBeInTheDocument();
    expect(screen.getByText(/drag & drop your export file here/i)).toBeInTheDocument();
  });

  it('switches between Direct File Upload and Cloud Link tabs smoothly', () => {
    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        onSubmit={mockOnSubmit}
      />
    );

    const cloudTab = screen.getByRole('button', { name: /cloud \/ external link/i });
    fireEvent.click(cloudTab);

    expect(screen.getByPlaceholderText(/https:\/\/loom\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/supported:/i)).toBeInTheDocument();

    const fileTab = screen.getByRole('button', { name: /direct file upload/i });
    fireEvent.click(fileTab);

    expect(screen.getByText(/drag & drop your export file here/i)).toBeInTheDocument();
  });

  it('auto-detects Loom, Google Drive, Frame.io, YouTube, GitHub, and Figma links with badges and tips', () => {
    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        initialUrl="https://loom.com/share/abc-123"
        onSubmit={mockOnSubmit}
      />
    );

    // Initialized on cloud link tab due to URL
    const input = screen.getByPlaceholderText(/https:\/\/loom\.com/i);
    expect(screen.getByText(/loom video walkthrough/i)).toBeInTheDocument();
    expect(screen.getByText(/verified loom link/i)).toBeInTheDocument();

    // Change to Google Drive
    fireEvent.change(input, { target: { value: 'https://drive.google.com/file/d/123/view' } });
    expect(screen.getByText(/google drive export \/ folder/i)).toBeInTheDocument();

    // Change to Frame.io
    fireEvent.change(input, { target: { value: 'https://app.frame.io/presentations/xyz-456' } });
    expect(screen.getByText(/frame\.io video review cut/i)).toBeInTheDocument();

    // Change to YouTube
    fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    expect(screen.getByText(/youtube cut/i)).toBeInTheDocument();

    // Change to GitHub
    fireEvent.change(input, { target: { value: 'https://github.com/org/repo/pull/12' } });
    expect(screen.getByText(/github pull request \/ repository/i)).toBeInTheDocument();

    // Change to Figma
    fireEvent.change(input, { target: { value: 'https://www.figma.com/file/board-123' } });
    expect(screen.getByText(/figma design board \/ prototype/i)).toBeInTheDocument();
  });

  it('submits external cloud link with normalized HTTPS and reflection notes', async () => {
    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        onSubmit={mockOnSubmit}
      />
    );

    // Switch to cloud link
    fireEvent.click(screen.getByRole('button', { name: /cloud \/ external link/i }));

    const urlInput = screen.getByPlaceholderText(/https:\/\/loom\.com/i);
    fireEvent.change(urlInput, { target: { value: 'loom.com/share/test12345' } });

    const notesInput = screen.getByPlaceholderText(/describe how you approached the challenge/i);
    fireEvent.change(notesInput, { target: { value: 'Completed audio mastering and color grading.' } });

    const submitBtn = screen.getByRole('button', { name: /submit challenge/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionUrl: 'https://loom.com/share/test12345',
          notes: 'Completed audio mastering and color grading.',
          fileType: expect.stringContaining('Loom'),
        })
      );
    });
  });

  it('handles direct file drop, validates file, and uploads to storage before submitting', async () => {
    vi.mocked(assetStorageService.uploadSubmissionFile).mockResolvedValueOnce(
      'https://xyz.supabase.co/storage/v1/object/public/submissions/user-123/final_cut.mp4'
    );

    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        onSubmit={mockOnSubmit}
      />
    );

    const testFile = new File(['dummy binary video bytes'], 'day07_commercial_edit.mp4', {
      type: 'video/mp4',
    });

    const dropZone = screen.getByText(/drag & drop your export file here/i).closest('div');
    expect(dropZone).not.toBeNull();

    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [testFile],
      },
    });

    // File card should appear
    expect(await screen.findByText('day07_commercial_edit.mp4')).toBeInTheDocument();
    expect(screen.getByText('MP4 Video Cut')).toBeInTheDocument();
    expect(screen.getByText('Validated')).toBeInTheDocument();

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /submit challenge/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(assetStorageService.uploadSubmissionFile).toHaveBeenCalledWith('user-123', testFile);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionUrl: 'https://xyz.supabase.co/storage/v1/object/public/submissions/user-123/final_cut.mp4',
          fileName: 'day07_commercial_edit.mp4',
        })
      );
    });
  });

  it('displays validation error if file exceeds 100MB and offers button to switch to Cloud Link tab', async () => {
    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        onSubmit={mockOnSubmit}
      />
    );

    const oversizedFile = {
      name: 'huge_prores_raw.mov',
      size: 150 * 1024 * 1024,
      type: 'video/quicktime',
    } as unknown as File;

    const dropZone = screen.getByText(/drag & drop your export file here/i).closest('div');
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [oversizedFile],
      },
    });

    expect(await screen.findByText(/exceeds the 100\.0 MB direct upload limit/i)).toBeInTheDocument();

    const switchBtn = screen.getByRole('button', { name: /switch to cloud link tab/i });
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);

    // Should switch to cloud link tab
    expect(screen.getByPlaceholderText(/https:\/\/loom\.com/i)).toBeInTheDocument();
  });

  it('renders existing file attachment with expiring signed URL resolution', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <DynamicChallengeSubmissionBox
        userId="user-123"
        challengeId="ch-456"
        initialUrl="https://xyz.supabase.co/storage/v1/object/submissions/user-123/cut.mp4"
        isExistingSubmission={true}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText(/previously attached deliverable/i)).toBeInTheDocument();
    expect(screen.getByText(/private storage • expiring token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replace file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update submission/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(assetStorageService.getSecureSubmissionUrl).toHaveBeenCalledWith(
        'https://xyz.supabase.co/storage/v1/object/submissions/user-123/cut.mp4',
        3600
      );
    });

    const inspectLink = screen.getByRole('link', { name: /inspect/i });
    fireEvent.click(inspectLink);

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('token=signed-1h'),
        '_blank',
        'noopener,noreferrer'
      );
    });
    windowOpenSpy.mockRestore();
  });
});

