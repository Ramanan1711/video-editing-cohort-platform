import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ModuleLessonModal } from '../../pages/AdminCourses/modals/ModuleLessonModal';
import { AdminCoursesContext } from '../../pages/AdminCourses/context/adminCoursesContextValue';
import type { LessonEditorState, EditorState } from '../../pages/AdminCourses/types';

describe('ModuleLessonModal Video Thumbnail Provision', () => {
  const initialLessonEditor: LessonEditorState = {
    type: 'lesson',
    moduleId: 'mod-1',
    title: 'New Cutting Dynamics Lesson',
    description: 'Lesson description',
    videoUrl: '',
    thumbnailUrl: '',
    durationMinutes: '15',
    position: 1,
    status: 'draft',
  };

  const TestWrapper: React.FC<{ initialEditor?: EditorState }> = ({ initialEditor = initialLessonEditor }) => {
    const [editor, setEditor] = useState<EditorState | null>(initialEditor);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadThumbnailFile, setUploadThumbnailFile] = useState<File | null>(null);
    const handleSave = vi.fn(async (e: React.FormEvent) => {
      e.preventDefault();
    });

    return (
      <AdminCoursesContext.Provider
        value={{
          user: { id: 'admin-1', email: 'admin@iunoware.com' } as any,
          profile: { id: 'admin-1', role: 'admin', admin_role: 'parent_super_admin' } as any,
          cohorts: [],
          courses: [],
          modules: [],
          assignments: [],
          resources: [],
          loading: false,
          retrying: false,
          saving: false,
          uploadingStatus: null,
          error: null,
          appError: null,
          success: null,
          search: '',
          setSearch: vi.fn(),
          statusFilter: 'all',
          setStatusFilter: vi.fn(),
          expandedCohortId: null,
          setExpandedCohortId: vi.fn(),
          expandedLessonId: null,
          setExpandedLessonId: vi.fn(),
          editor,
          setEditor,
          uploadFile,
          setUploadFile,
          uploadThumbnailFile,
          setUploadThumbnailFile,
          challengesByCohort: {},
          setChallengesByCohort: vi.fn(),
          cohortActiveTab: {},
          loadingChallengesCohortId: null,
          showUploadChallengeModal: false,
          setShowUploadChallengeModal: vi.fn(),
          uploadModalCohortId: undefined,
          setUploadModalCohortId: vi.fn(),
          courseChallengesByCohort: {},
          setCourseChallengesByCohort: vi.fn(),
          loadingCourseChallengesCohortId: null,
          bulkImportTargetCohort: null,
          setBulkImportTargetCohort: vi.fn(),
          filteredCohorts: [],
          totalLessons: 1,
          isAdmin: true,
          isMentor: false,
          assignmentsByLesson: new Map(),
          resourcesByLesson: new Map(),
          canManageCurriculum: true,
          canPublish: true,
          canManageCohorts: true,
          loadData: vi.fn(),
          handleRetry: vi.fn(),
          loadChallengesForCohort: vi.fn(),
          loadCourseChallengesForCohort: vi.fn(),
          handleDeleteCourseChallenge: vi.fn(),
          handleSwitchCohortTab: vi.fn(),
          openCohortEditor: vi.fn(),
          openModuleEditor: vi.fn(),
          openLessonEditor: vi.fn(),
          openAssignmentEditor: vi.fn(),
          openResourceEditor: vi.fn(),
          openChallengeEditor: vi.fn(),
          handleDeleteChallenge: vi.fn(),
          handleClearCohortChallenges: vi.fn(),
          handleSave,
        } as any}
      >
        <ModuleLessonModal />
      </AdminCoursesContext.Provider>
    );
  };

  it('renders Video Thumbnail Cover section with Existing Video Type fallback when empty', () => {
    render(<TestWrapper />);

    expect(screen.getByText('Video Thumbnail Cover')).toBeInTheDocument();
    expect(screen.getByText('Existing Video Type')).toBeInTheDocument();
    expect(screen.getByText('Default video player poster')).toBeInTheDocument();
  });

  it('automatically detects YouTube video URL and displays existing type YouTube cover preview', () => {
    render(<TestWrapper />);

    const videoInput = screen.getByLabelText(/External Video URL/i);
    fireEvent.change(videoInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });

    expect(screen.getByText('Auto-detected (YouTube)')).toBeInTheDocument();
    const previewImg = screen.getByAltText('Thumbnail preview') as HTMLImageElement;
    expect(previewImg.src).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(screen.getByText(/Existing type \(YouTube cover\)/i)).toBeInTheDocument();
  });

  it('prioritizes custom thumbnail URL over existing type when provided', () => {
    render(<TestWrapper />);

    const videoInput = screen.getByLabelText(/External Video URL/i);
    fireEvent.change(videoInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });

    const thumbInput = screen.getByLabelText(/Custom Thumbnail URL/i);
    fireEvent.change(thumbInput, { target: { value: 'https://cdn.example.com/custom-poster.jpg' } });

    expect(screen.getByText('Custom Thumbnail')).toBeInTheDocument();
    const previewImg = screen.getByAltText('Thumbnail preview') as HTMLImageElement;
    expect(previewImg.src).toBe('https://cdn.example.com/custom-poster.jpg');
    expect(screen.getByText(/Taking custom thumbnail/i)).toBeInTheDocument();

    // Clicking Clear button resets back to YouTube auto-detected
    const clearBtn = screen.getByTitle('Clear custom thumbnail URL');
    fireEvent.click(clearBtn);

    expect(screen.getByText('Auto-detected (YouTube)')).toBeInTheDocument();
    const revertedImg = screen.getByAltText('Thumbnail preview') as HTMLImageElement;
    expect(revertedImg.src).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('handles custom thumbnail file upload and allow clearing it', () => {
    render(<TestWrapper />);

    const thumbFileInput = screen.getByLabelText('Upload Thumbnail Image') as HTMLInputElement;

    const mockFile = new File(['fake-image-bytes'], 'cool-cover.png', { type: 'image/png' });
    fireEvent.change(thumbFileInput, { target: { files: [mockFile] } });

    expect(screen.getAllByText(/cool-cover.png/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();

    // Click remove
    fireEvent.click(screen.getByRole('button', { name: /Remove/i }));
    expect(screen.queryByText(/cool-cover.png/i)).not.toBeInTheDocument();
  });
});
