import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InternshipReportModal } from '../../components/internship/InternshipReportModal';
import * as reportService from '../../lib/internshipReportService';

vi.mock('../../lib/internshipReportService', async () => {
  const actual = await vi.importActual('../../lib/internshipReportService');
  return {
    ...actual,
    getStudentInternshipReport: vi.fn(),
    generateInternshipReport: vi.fn(),
    updateInternshipReport: vi.fn(),
    publishInternshipReport: vi.fn(),
  };
});

describe('InternshipReportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no report exists yet and allows generation', async () => {
    vi.mocked(reportService.getStudentInternshipReport).mockResolvedValueOnce(null);
    vi.mocked(reportService.generateInternshipReport).mockResolvedValueOnce({
      id: 'rep-new-1',
      cohort_id: 'c1',
      student_id: 's1',
      student_name: 'Alex Rivera',
      cohort_name: 'Editing Cohort',
      title: 'Internship Performance & Evaluation Report',
      status: 'draft',
      composite_score: 88.0,
      grade: 'A',
      attendance_rate_pct: 100,
      completed_drills_count: 14,
      total_drills_count: 15,
      technical_rating: 4,
      consistency_rating: 5,
      creative_rating: 4,
      summary_notes: 'Great work',
      strengths: 'Fast pacing',
      growth_areas: 'Audio mastering',
      recommendation: 'strongly_recommend',
      lor_eligible: true,
      telemetry_snapshot: {
        total_drills: 15,
        completed_drills: 14,
        drill_avg_score: 90,
        total_lessons: 10,
        completed_lessons: 10,
        total_assignments: 2,
        approved_assignments: 2,
        total_sessions: 3,
        attended_sessions: 3,
        drills_list: [],
      },
      generated_at: '2026-09-29T10:00:00Z',
    });

    render(
      <InternshipReportModal
        isOpen={true}
        onClose={() => {}}
        cohortId="c1"
        cohortName="Editing Cohort"
        studentId="s1"
        studentName="Alex Rivera"
        canEdit={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No Evaluation Report On File')).toBeDefined();
    });

    const genButton = screen.getByRole('button', { name: /Generate Formal Report/i });
    fireEvent.click(genButton);

    await waitFor(() => {
      expect(reportService.generateInternshipReport).toHaveBeenCalledWith('c1', 's1');
      expect(screen.getByText('88%')).toBeDefined();
      expect(screen.getByText('A')).toBeDefined();
      expect(screen.getByText('LOR Certified')).toBeDefined();
    });
  });

  it('renders existing report card with telemetry and allows editing ratings', async () => {
    const existingReport: reportService.InternshipReport = {
      id: 'rep-existing-1',
      cohort_id: 'c1',
      student_id: 's1',
      student_name: 'Alex Rivera',
      cohort_name: 'Editing Cohort',
      title: 'Internship Performance & Evaluation Report',
      status: 'draft',
      composite_score: 94.0,
      grade: 'A+',
      attendance_rate_pct: 100,
      completed_drills_count: 15,
      total_drills_count: 15,
      technical_rating: 5,
      consistency_rating: 5,
      creative_rating: 5,
      summary_notes: 'Flawless execution',
      strengths: 'High retention cuts and audio design',
      growth_areas: 'None',
      recommendation: 'strongly_recommend',
      lor_eligible: true,
      telemetry_snapshot: {
        total_drills: 15,
        completed_drills: 15,
        drill_avg_score: 98,
        total_lessons: 10,
        completed_lessons: 10,
        total_assignments: 2,
        approved_assignments: 2,
        total_sessions: 3,
        attended_sessions: 3,
        drills_list: [
          { day_number: 1, title: 'First Cut', status: 'accepted', score: 100, feedback: 'Great!' },
        ],
      },
      generated_at: '2026-09-29T10:00:00Z',
    };

    vi.mocked(reportService.getStudentInternshipReport).mockResolvedValueOnce(existingReport);
    vi.mocked(reportService.updateInternshipReport).mockResolvedValueOnce({
      ...existingReport,
      strengths: 'Updated strengths statement',
    });

    render(
      <InternshipReportModal
        isOpen={true}
        onClose={() => {}}
        cohortId="c1"
        cohortName="Editing Cohort"
        studentId="s1"
        studentName="Alex Rivera"
        canEdit={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('94%')).toBeDefined();
      expect(screen.getByText('A+')).toBeDefined();
      expect(screen.getByText('LOR Certified')).toBeDefined();
    });

    // Enter edit mode
    const editBtn = screen.getByText('Edit Ratings');
    fireEvent.click(editBtn);

    expect(screen.getByText('Key Strengths & Highlights')).toBeDefined();
    const saveBtn = screen.getByRole('button', { name: 'Save Evaluation' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(reportService.updateInternshipReport).toHaveBeenCalled();
    });
  });

  it('publishes report when clicking publish button', async () => {
    const existingReport: reportService.InternshipReport = {
      id: 'rep-pub-1',
      cohort_id: 'c1',
      student_id: 's1',
      title: 'Internship Performance & Evaluation Report',
      status: 'draft',
      composite_score: 90.0,
      grade: 'A+',
      attendance_rate_pct: 100,
      completed_drills_count: 15,
      total_drills_count: 15,
      technical_rating: 5,
      consistency_rating: 5,
      creative_rating: 5,
      summary_notes: null,
      strengths: null,
      growth_areas: null,
      recommendation: 'strongly_recommend',
      lor_eligible: true,
      telemetry_snapshot: {
        total_drills: 15,
        completed_drills: 15,
        drill_avg_score: 90,
        total_lessons: 0,
        completed_lessons: 0,
        total_assignments: 0,
        approved_assignments: 0,
        total_sessions: 0,
        attended_sessions: 0,
        drills_list: [],
      },
      generated_at: '2026-09-29T10:00:00Z',
    };

    vi.mocked(reportService.getStudentInternshipReport).mockResolvedValueOnce(existingReport);
    vi.mocked(reportService.publishInternshipReport).mockResolvedValueOnce({
      ...existingReport,
      status: 'published',
      published_at: '2026-09-29T11:00:00Z',
    });

    render(
      <InternshipReportModal
        isOpen={true}
        onClose={() => {}}
        cohortId="c1"
        cohortName="Editing Cohort"
        studentId="s1"
        studentName="Alex Rivera"
        canEdit={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Publish Report Card')).toBeDefined();
    });

    const pubButton = screen.getByRole('button', { name: 'Publish Report Card' });
    fireEvent.click(pubButton);

    await waitFor(() => {
      expect(reportService.publishInternshipReport).toHaveBeenCalledWith('rep-pub-1');
    });
  });
});
