import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboard } from '../../pages/StudentDashboard';
import { ThemeProvider } from '../../context/ThemeContext';
import * as courseService from '../../lib/courseService';
import * as internshipService from '../../lib/internshipService';

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-student-1', email: 'student@example.com' },
    profile: {
      id: 'test-student-1',
      full_name: 'Alex Rivera',
      role: 'student',
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/courseService', () => ({
  listCohorts: vi.fn(),
  listModules: vi.fn(),
  getStudentCourseData: vi.fn(),
  listMySubmissions: vi.fn().mockResolvedValue([]),
  listStudentLiveSessions: vi.fn().mockResolvedValue([]),
  listStudentAnnouncements: vi.fn().mockResolvedValue([]),
  listAssignments: vi.fn().mockResolvedValue([]),
  listLessonResources: vi.fn().mockResolvedValue([]),
  getLessonResourceDownloadUrl: vi.fn().mockResolvedValue('https://signed.download/file.zip'),
  getSecureAssetUrl: vi.fn().mockImplementation((url: string) => Promise.resolve(url)),
  isSecurableAsset: vi.fn().mockImplementation((url: string) => Boolean(url && (url.includes('course-assets') || url.includes('token=')))),
  markLessonComplete: vi.fn().mockResolvedValue(true),
  updateLessonWatchProgress: vi.fn().mockResolvedValue(undefined),
  parseVideoUrl: vi.fn().mockReturnValue({ type: 'youtube', id: 'dQw4w9WgXcQ' }),
  calculateLearningTime: vi.fn().mockReturnValue('1h 30m'),
  calculateStreak: vi.fn().mockReturnValue(3),
  formatFileSize: vi.fn().mockReturnValue('15 MB'),
  getStudentUnifiedProgress: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/internshipService', () => ({
  getStudentSprintDays: vi.fn(),
  getStudentUnifiedProgress: vi.fn().mockResolvedValue(null),
  submitDailyChallenge: vi.fn().mockResolvedValue({}),
  gradeDailyChallenge: vi.fn().mockResolvedValue({}),
  getSecureChallengeSubmissionUrl: vi.fn().mockImplementation((url: string) => Promise.resolve(url)),
}));

vi.mock('../../lib/gamificationService', () => ({
  calculateGamificationProfile: vi.fn().mockReturnValue({
    level: 2,
    tierTitle: 'Lead Cutter',
    totalXp: 350,
    progressPercent: 60,
    badges: [],
    recentHeatmap: [],
  }),
  syncGamificationProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/recommendationService', () => ({
  generateSmartRecommendations: vi.fn().mockReturnValue([]),
}));

describe('Student Learning Dashboard - Reactive Course Switcher', () => {
  const cohortVideo = {
    id: 'cohort-video-1',
    name: 'Premiere Pro Masterclass',
    title: 'Premiere Pro Masterclass',
    description: 'Learn high-end video editing workflows',
    status: 'published' as const,
  };

  const cohortJava = {
    id: 'cohort-java-2',
    name: 'Java Backend Cohort',
    title: 'Java Backend Cohort',
    description: 'Modern Java and Spring microservices',
    status: 'published' as const,
  };

  const videoModules = [
    {
      id: 'mod-v1',
      cohort_id: 'cohort-video-1',
      title: 'Module 1: Timeline Basics',
      description: null,
      position: 1,
      lessons: [
        {
          id: 'les-v1',
          module_id: 'mod-v1',
          title: 'Lesson 1: J-Cuts and L-Cuts',
          position: 1,
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration_minutes: 20,
        },
      ],
    },
  ];

  const javaModules = [
    {
      id: 'mod-j1',
      cohort_id: 'cohort-java-2',
      title: 'Module 1: Java Foundations',
      description: null,
      position: 1,
      lessons: [
        {
          id: 'les-j1',
          module_id: 'mod-j1',
          title: 'Lesson 1: JVM & Memory Model',
          position: 1,
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration_minutes: 25,
        },
      ],
    },
  ];

  const videoSprintDays = {
    days: [
      {
        dayNumber: 1,
        title: 'Rough Cut Assembly & Audio Sync',
        isUnlocked: true,
        challenge: {
          id: 'chal-v1',
          day_number: 1,
          title: 'Rough Cut Assembly & Audio Sync',
          instructions: 'Assemble the rough cut without jump cuts.',
          required_deliverable: 'MP4 Video Export',
        },
        submission: {
          id: 'sub-v1',
          challenge_id: 'chal-v1',
          submission_url: 'https://dropbox.com/roughcut.mp4',
          status: 'accepted' as const,
          score: 95,
          mentor_feedback: 'Excellent pacing and audio sync!',
        },
        status: 'accepted' as const,
        score: 95,
      },
      {
        dayNumber: 2,
        title: 'Dialogue Audio Stem Leveling',
        isUnlocked: true,
        challenge: {
          id: 'chal-v2',
          day_number: 2,
          title: 'Dialogue Audio Stem Leveling',
          instructions: 'Equalize voice tracks to -14 LUFS.',
          required_deliverable: 'WAV Stem Export',
        },
        submission: null,
        status: 'todo' as const,
        score: null,
      },
    ],
    completedCount: 1,
    streakCount: 3,
    overallScore: 95,
    totalDays: 15,
    progressPercent: 7,
  };

  const javaSprintDays = {
    days: [
      {
        dayNumber: 1,
        title: 'Git Repository & Maven Build Scaffold',
        isUnlocked: true,
        challenge: {
          id: 'chal-j1',
          day_number: 1,
          title: 'Git Repository & Maven Build Scaffold',
          instructions: 'Initialize Spring Boot repository with Dockerfile.',
          required_deliverable: 'GitHub Repository URL',
        },
        submission: {
          id: 'sub-j1',
          challenge_id: 'chal-j1',
          submission_url: 'https://github.com/alexrivera/java-service',
          status: 'pending' as const,
          score: null,
          mentor_feedback: null,
        },
        status: 'pending' as const,
        score: null,
      },
      {
        dayNumber: 2,
        title: 'REST Controller & DTO Validation',
        isUnlocked: true,
        challenge: {
          id: 'chal-j2',
          day_number: 2,
          title: 'REST Controller & DTO Validation',
          instructions: 'Create student CRUD endpoints.',
          required_deliverable: 'Pull Request URL',
        },
        submission: null,
        status: 'todo' as const,
        score: null,
      },
    ],
    completedCount: 0,
    streakCount: 0,
    overallScore: null,
    totalDays: 15,
    progressPercent: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(courseService.listCohorts).mockResolvedValue([cohortVideo, cohortJava] as unknown as courseService.Cohort[]);
    vi.mocked(courseService.listModules).mockResolvedValue([...videoModules, ...javaModules] as unknown as courseService.Module[]);

    vi.mocked(courseService.getStudentCourseData).mockImplementation(((_userId: string, cohortId?: string) => {
      const activeId = cohortId || cohortVideo.id;
      if (activeId === cohortJava.id) {
        return Promise.resolve({
          cohort: cohortJava,
          modules: javaModules,
          progress: [],
          enrolledCohorts: [cohortVideo, cohortJava],
        });
      }
      return Promise.resolve({
        cohort: cohortVideo,
        modules: videoModules,
        progress: [],
        enrolledCohorts: [cohortVideo, cohortJava],
      });
    }) as unknown as typeof courseService.getStudentCourseData);

    vi.mocked(internshipService.getStudentSprintDays).mockImplementation(((_userId: string, cohortId: string) => {
      if (cohortId === cohortJava.id) {
        return Promise.resolve(javaSprintDays);
      }
      return Promise.resolve(videoSprintDays);
    }) as unknown as typeof internshipService.getStudentSprintDays);
  });

  const renderDashboard = (initialEntries = ['/student/dashboard?view=player&tab=internship_sprint']) => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <StudentDashboard />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders workspace course switcher dropdown with multiple enrolled cohorts', async () => {
    renderDashboard();

    const switcher = (await screen.findByTestId('workspace-course-switcher')) as HTMLSelectElement;
    expect(switcher).toBeInTheDocument();
    expect(switcher).not.toBeDisabled();

    // Verify option values and labels
    const options = Array.from(switcher.options).map((opt) => ({
      value: opt.value,
      text: opt.text,
    }));

    expect(options).toEqual([
      { value: 'cohort-video-1', text: 'Premiere Pro Masterclass' },
      { value: 'cohort-java-2', text: 'Java Backend Cohort' },
    ]);

    // Active cohort defaults to Premiere Pro Masterclass
    expect(switcher.value).toBe('cohort-video-1');

    // Video Sprint challenges rendered initially
    expect(screen.getByText('Rough Cut Assembly & Audio Sync')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('dynamically switches cohort and reactively reloads sprint challenges, streak, and status chips without page reload', async () => {
    renderDashboard();

    const switcher = (await screen.findByTestId('workspace-course-switcher')) as HTMLSelectElement;
    expect(switcher.value).toBe('cohort-video-1');

    // Verify initial video editing challenge is visible
    expect(await screen.findByText('Rough Cut Assembly & Audio Sync')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByText('Git Repository & Maven Build Scaffold')).not.toBeInTheDocument();

    // Change course from Premiere Pro Masterclass to Java Backend Cohort
    fireEvent.change(switcher, { target: { value: 'cohort-java-2' } });

    // Assert that the course data and sprint days for Java Backend Cohort are fetched
    await waitFor(() => {
      expect(courseService.getStudentCourseData).toHaveBeenCalledWith(
        'test-student-1',
        'cohort-java-2'
      );
      expect(internshipService.getStudentSprintDays).toHaveBeenCalledWith(
        'test-student-1',
        'cohort-java-2'
      );
    });

    // The SprintChallengeTracker should now display Java challenges
    await waitFor(() => {
      expect(screen.getByText('Git Repository & Maven Build Scaffold')).toBeInTheDocument();
    });

    // Status chip should be "In Review" for the Java challenge (status: pending)
    expect(screen.getByText('In Review')).toBeInTheDocument();

    // The old Video Editing challenge should no longer be rendered
    expect(screen.queryByText('Rough Cut Assembly & Audio Sync')).not.toBeInTheDocument();

    // Switch back to Premiere Pro Masterclass
    fireEvent.change(switcher, { target: { value: 'cohort-video-1' } });

    await waitFor(() => {
      expect(screen.getByText('Rough Cut Assembly & Audio Sync')).toBeInTheDocument();
    });

    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByText('Git Repository & Maven Build Scaffold')).not.toBeInTheDocument();
  });
});
