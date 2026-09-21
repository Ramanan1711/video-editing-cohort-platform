import type { Lesson, Module, LessonProgress, Submission, Assignment } from './courseService';

export interface SmartRecommendation {
  id: string;
  type: 'next_lesson' | 'weak_skill' | 'deadline' | 'polish_tip';
  priority: 'high' | 'medium' | 'low';
  title: string;
  subtitle: string;
  actionText: string;
  actionType: 'navigate_lesson' | 'navigate_assignment' | 'open_modal' | 'view_tips';
  targetId?: string;
  tags?: string[];
}

export type StudioRecommendation = SmartRecommendation;

export interface RubricAverages {
  pacing: number;
  audio: number;
  color: number;
  storytelling: number;
  technical: number;
  lowestCategory: string | null;
  lowestScore: number;
}

export function computeRubricAverages(submissions: Submission[]): RubricAverages {
  const totals = { pacing: 0, audio: 0, color: 0, storytelling: 0, technical: 0 };
  const counts = { pacing: 0, audio: 0, color: 0, storytelling: 0, technical: 0 };

  for (const sub of submissions) {
    for (const f of sub.feedback_history ?? []) {
      if (f.rubric) {
        if (typeof f.rubric.pacing === 'number') {
          totals.pacing += f.rubric.pacing;
          counts.pacing++;
        }
        if (typeof f.rubric.audio === 'number') {
          totals.audio += f.rubric.audio;
          counts.audio++;
        }
        if (typeof f.rubric.color === 'number') {
          totals.color += f.rubric.color;
          counts.color++;
        }
        if (typeof f.rubric.storytelling === 'number') {
          totals.storytelling += f.rubric.storytelling;
          counts.storytelling++;
        }
        if (typeof f.rubric.technical === 'number') {
          totals.technical += f.rubric.technical;
          counts.technical++;
        }
      }
    }
  }

  const avgs = {
    pacing: counts.pacing ? totals.pacing / counts.pacing : 0,
    audio: counts.audio ? totals.audio / counts.audio : 0,
    color: counts.color ? totals.color / counts.color : 0,
    storytelling: counts.storytelling ? totals.storytelling / counts.storytelling : 0,
    technical: counts.technical ? totals.technical / counts.technical : 0,
  };

  const categories = Object.entries(avgs).filter(([, score]) => score > 0);
  if (!categories.length) {
    return { ...avgs, lowestCategory: null, lowestScore: 0 };
  }

  categories.sort((a, b) => a[1] - b[1]);
  return {
    ...avgs,
    lowestCategory: categories[0][0],
    lowestScore: Math.round(categories[0][1] * 10) / 10,
  };
}

export function generateSmartRecommendations(
  modulesOrLessons: Module[] | Lesson[],
  progress: LessonProgress[],
  assignments: Assignment[],
  submissions: Submission[]
): SmartRecommendation[] {
  const recommendations: SmartRecommendation[] = [];
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const allLessons: Lesson[] =
    modulesOrLessons.length > 0 && 'lessons' in modulesOrLessons[0]
      ? (modulesOrLessons as Module[]).flatMap((m) => m.lessons)
      : (modulesOrLessons as Lesson[]);

  // 1. Next Lesson Recommendation
  const nextUncompletedLesson = allLessons.find((l) => !completedIds.has(l.id));
  if (nextUncompletedLesson) {
    recommendations.push({
      id: 'rec-next-lesson',
      type: 'next_lesson',
      priority: 'high',
      title: `Next Lesson: ${nextUncompletedLesson.title}`,
      subtitle: `${nextUncompletedLesson.duration_minutes ? `${nextUncompletedLesson.duration_minutes} mins • ` : ''}Pick up your timeline right where you left off.`,
      actionText: 'Start Lesson',
      actionType: 'navigate_lesson',
      targetId: nextUncompletedLesson.id,
      tags: ['Curriculum', 'In Progress'],
    });
  }

  // 2. Urgent / Upcoming Assignment Deadlines or Revisions
  const now = Date.now();
  const resubmitSubmission = submissions.find((s) => s.status === 'resubmit');
  if (resubmitSubmission) {
    recommendations.push({
      id: `rec-resubmit-${resubmitSubmission.id}`,
      type: 'deadline',
      priority: 'high',
      title: 'Action Needed: Revision Requested',
      subtitle: 'Your mentor left notes on your timeline cut. Review feedback and submit v2.',
      actionText: 'Review Critique',
      actionType: 'navigate_assignment',
      targetId: resubmitSubmission.assignment_id,
      tags: ['Revision', 'Mentor Feedback'],
    });
  } else {
    // Check for assignments due in < 48 hours
    for (const a of assignments) {
      if (a.deadline) {
        const dueTime = new Date(a.deadline).getTime();
        const diffHours = (dueTime - now) / (1000 * 60 * 60);
        const hasSubmitted = submissions.some((s) => s.assignment_id === a.id && s.status !== 'draft');

        if (!hasSubmitted && diffHours > 0 && diffHours <= 48) {
          recommendations.push({
            id: `rec-due-${a.id}`,
            type: 'deadline',
            priority: 'high',
            title: `Deadline Alert: ${a.title}`,
            subtitle: `Due in ${Math.round(diffHours)} hours. Submit your timeline before the mentor review window closes.`,
            actionText: 'Open Assignment',
            actionType: 'navigate_assignment',
            targetId: a.id,
            tags: ['Due Soon', 'SLA Target'],
          });
          break;
        }
      }
    }
  }

  // 3. Weak Skill Area Sentinel (Based on Mentor Rubric Scores)
  const rubricStats = computeRubricAverages(submissions);
  if (rubricStats.lowestCategory && rubricStats.lowestScore < 4.0) {
    const skillTips: Record<string, { label: string; tip: string }> = {
      pacing: {
        label: 'Pacing & Timeline Rhythm',
        tip: 'Mentor reviews suggest tightening dialogue gaps by 4-6 frames and cutting on character eye-movement.',
      },
      audio: {
        label: 'Audio Mixing & Ducking',
        tip: 'Lower background music -4dB to -6dB under spoken lines; ensure room tone bridges all audio transitions.',
      },
      color: {
        label: 'Color Grading & Balance',
        tip: 'Check vector scope skin-tone indicator; balance warm highlights against cool shadows for cinematic contrast.',
      },
      storytelling: {
        label: 'Narrative Arc & B-Roll Placement',
        tip: 'Lead transitions with J-Cuts (audio early) to pull the audience naturally into upcoming scene changes.',
      },
      technical: {
        label: 'Timeline Technical Hygiene',
        tip: 'Check timeline framerates for dropped frames and ensure peak audio limits never exceed -6dB True Peak.',
      },
    };

    const info = skillTips[rubricStats.lowestCategory] || {
      label: 'Craft Refinement',
      tip: 'Practice matching action across multiple camera perspectives to maintain continuity.',
    };

    recommendations.push({
      id: `rec-skill-${rubricStats.lowestCategory}`,
      type: 'weak_skill',
      priority: 'medium',
      title: `Skill Level-Up: ${info.label}`,
      subtitle: `${info.tip} (Current rubric score: ${rubricStats.lowestScore}/5.0)`,
      actionText: 'View Studio Guide',
      actionType: 'view_tips',
      tags: ['Rubric Analytics', 'Mentorship'],
    });
  }

  // 4. Pre-Submission Polish Checklist
  recommendations.push({
    id: 'rec-polish-tips',
    type: 'polish_tip',
    priority: 'low',
    title: 'Pre-Export Studio Checklist',
    subtitle: 'Always perform an audio solo check, verify safe margins, and check black levels before exporting timeline files.',
    actionText: 'Review Checklist',
    actionType: 'view_tips',
    tags: ['Quality Standard', 'Pro-Tip'],
  });

  return recommendations;
}
