import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InteractiveSprintCurriculum } from '../../components/home/InteractiveSprintCurriculum';
import { soundFx } from '../../lib/soundFx';

// Mock sound effects
vi.mock('../../lib/soundFx', () => ({
  soundFx: {
    playBlip: vi.fn(),
    playSweep: vi.fn(),
    playClick: vi.fn(),
  },
}));

describe('InteractiveSprintCurriculum Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    defaultTrack: 'video' | 'coding' | 'motion' = 'video',
    defaultDay: number = 1
  ) => {
    return render(
      <MemoryRouter>
        <InteractiveSprintCurriculum defaultTrack={defaultTrack} defaultDay={defaultDay} />
      </MemoryRouter>
    );
  };

  it('renders all 3 track switcher tabs with accessible roles and labels', () => {
    renderComponent('video', 1);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    expect(screen.getByRole('tab', { name: /🎬 Video Editing Track/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /💻 Full-Stack Software Track/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /✨ Motion & 3D Design Track/i })).toBeInTheDocument();
  });

  it('displays default video track curriculum, software stack, and phase objectives', () => {
    renderComponent('video', 1);

    // Track badge and description
    expect(screen.getByText('ProCut Visual Track')).toBeInTheDocument();
    expect(screen.getByText(/Video Editing & Post-Production Software Stack/i)).toBeInTheDocument();

    // Software stack strip
    expect(screen.getAllByText('Premiere Pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DaVinci Resolve').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Adobe Audition').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('After Effects').length).toBeGreaterThanOrEqual(1);

    // Phase 1, 2, 3 objectives
    expect(screen.getAllByText(/Phase 1: Drills & Foundations/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Phase 2: Production & Color Science/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Phase 3: Client Simulation & Capstone/i).length).toBeGreaterThanOrEqual(1);

    // Default Day 1 content in list and inspector
    const day1Matches = screen.getAllByText(/Day 01: Production Setup & First Kinetic Cut/i);
    expect(day1Matches.length).toBeGreaterThanOrEqual(1);

    // Rubric points & hours in inspector
    expect(screen.getAllByText(/2h sprint/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Strict directory architecture, zero dropped frames/i)).toBeInTheDocument();
  });

  it('dynamically swaps curriculum, software stack, and phase objectives when switching to Full-Stack Software Track', () => {
    renderComponent('video', 1);

    const codingTab = screen.getByRole('tab', { name: /Full-Stack Software Track/i });
    fireEvent.click(codingTab);

    // Sound effect played on tab switch
    expect(soundFx.playBlip).toHaveBeenCalled();

    // Track metadata swapped
    expect(screen.getByText('Production Engineering Track')).toBeInTheDocument();
    expect(screen.getByText(/Full-Stack Software Engineering Software Stack/i)).toBeInTheDocument();

    // Software stack swapped
    expect(screen.getAllByText('VS Code + Git').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('React 19')).toBeInTheDocument();
    expect(screen.getByText('Supabase + RLS')).toBeInTheDocument();
    expect(screen.getByText('TypeScript + Zod')).toBeInTheDocument();

    // Phase 1 title and tagline swapped
    expect(screen.getAllByText(/Phase 1: Drills & Architecture/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Git Flow, Relational Schemas & Zod APIs')).toBeInTheDocument();

    // Day 1 card swapped
    const codingDay1Matches = screen.getAllByText(
      /Day 01: Git Workflow, Dev Environment & Initial Commit/i
    );
    expect(codingDay1Matches.length).toBeGreaterThanOrEqual(1);

    // Coding rubric points
    expect(
      screen.getByText(/Clean branch hygiene, zero TypeScript errors in strict mode/i)
    ).toBeInTheDocument();
  });

  it('dynamically swaps curriculum to Motion & 3D Design Track when clicked', () => {
    renderComponent('video', 1);

    const motionTab = screen.getByRole('tab', { name: /Motion & 3D Design Track/i });
    fireEvent.click(motionTab);

    expect(soundFx.playBlip).toHaveBeenCalled();

    // Track metadata swapped
    expect(screen.getByText('Cinema 3D & Mograph Track')).toBeInTheDocument();
    expect(screen.getByText(/Motion Graphics & 3D Animation Software Stack/i)).toBeInTheDocument();

    // Software stack swapped
    expect(screen.getByText('Blender 4')).toBeInTheDocument();
    expect(screen.getByText('Cinema 4D')).toBeInTheDocument();
    expect(screen.getByText('Octane / Redshift')).toBeInTheDocument();

    // Phase 1 title and tagline swapped
    expect(screen.getAllByText(/Phase 1: Drills & Motion Principles/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Graph Easing, Kinetic Titles & Vector Morphs')).toBeInTheDocument();

    // Day 1 card swapped
    const motionDay1Matches = screen.getAllByText(
      /Day 01: Workspace Setup, Keyframe Curves & Velocity/i
    );
    expect(motionDay1Matches.length).toBeGreaterThanOrEqual(1);
  });

  it('allows selecting different days to inspect detailed briefs and rubrics', () => {
    renderComponent('video', 1);

    // Initially Day 1 is active
    expect(screen.getByTestId('inspector-day-indicator')).toHaveTextContent('DAY 01 / 15');

    // Click Day 2 card using the day 02 button
    const day2Button = screen.getByRole('button', { name: '02' });
    fireEvent.click(day2Button);

    expect(soundFx.playBlip).toHaveBeenCalled();

    // Card inspector counter and deliverable reflect Day 2
    expect(screen.getByTestId('inspector-day-indicator')).toHaveTextContent('DAY 02 / 15');
    const day2Deliverables = screen.getAllByText(
      /30-second high-retention timeline with J\/L audio bridges/i
    );
    expect(day2Deliverables.length).toBeGreaterThanOrEqual(1);
  });

  it('supports previous and next stepper navigation buttons in inspector', () => {
    renderComponent('video', 1);

    // Initially Day 1 is selected
    expect(screen.getByTestId('inspector-day-indicator')).toHaveTextContent('DAY 01 / 15');
    expect(screen.getByTestId('inspector-prev-day')).toBeDisabled();

    // Click Next Day button
    const nextButton = screen.getByTestId('inspector-next-day');
    expect(nextButton).not.toBeDisabled();
    fireEvent.click(nextButton);

    expect(screen.getByTestId('inspector-day-indicator')).toHaveTextContent('DAY 02 / 15');

    // Click Previous Day button
    const prevButton = screen.getByTestId('inspector-prev-day');
    expect(prevButton).not.toBeDisabled();
    fireEvent.click(prevButton);

    expect(screen.getByTestId('inspector-day-indicator')).toHaveTextContent('DAY 01 / 15');
    expect(screen.getByTestId('inspector-prev-day')).toBeDisabled();
  });

  it('allows filtering by sprint phases (Phase 1, 2, 3, or All)', () => {
    renderComponent('video', 1);

    // Initially all 15 day number buttons are rendered
    expect(screen.getByRole('button', { name: '01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '06' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument();

    // Filter to Phase 2 only (Days 6–10)
    const phase2FilterButton = screen.getByRole('button', { name: /Phase 2 · Production \(Days 6–10\)/i });
    fireEvent.click(phase2FilterButton);

    expect(screen.queryByRole('button', { name: '01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '06' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '15' })).not.toBeInTheDocument();

    // Reset filter to All
    const allFilterButton = screen.getByRole('button', { name: /All 15 Days/i });
    fireEvent.click(allFilterButton);

    expect(screen.getByRole('button', { name: '01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument();
  });
});
