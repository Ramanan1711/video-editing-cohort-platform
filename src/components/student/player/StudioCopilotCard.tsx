import { AlertCircle, Clock3, Compass, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';
import type { StudioRecommendation } from '../../../lib/recommendationService';
import type { Lesson } from '../../../lib/courseService';

export interface StudioCopilotCardProps {
  studioRecommendations: StudioRecommendation[];
  allLessons: Lesson[];
  selectLesson: (lesson: Lesson) => void;
  onTabChange: (tab: 'curriculum' | 'internship_sprint' | 'assignments' | 'calendar' | 'community' | 'sessions' | 'announcements') => void;
  onOpenAchievements: () => void;
}

export function StudioCopilotCard({
  studioRecommendations,
  allLessons,
  selectLesson,
  onTabChange,
  onOpenAchievements,
}: StudioCopilotCardProps) {
  if (studioRecommendations.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50/40 via-white to-amber-50/40 p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-orange-100/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-2xs">
            <Lightbulb size={15} />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-950">
              Studio Copilot · Smart Learning Advisor
            </h3>
            <p className="text-[11px] text-slate-500">
              Targeted recommendations grounded in your watch history, submissions, and mentor critique scores.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-extrabold text-orange-800 uppercase tracking-wider">
          AI Guided
        </span>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        {studioRecommendations.map((rec, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-3xs"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-wider">
                {rec.type === 'next_lesson' ? (
                  <span className="text-orange-600 flex items-center gap-1">
                    <Compass size={12} /> Next Up
                  </span>
                ) : rec.type === 'weak_skill' ? (
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Rubric Focus Area
                  </span>
                ) : rec.type === 'deadline' ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Clock3 size={12} /> Urgent Deadline
                  </span>
                ) : (
                  <span className="text-blue-600 flex items-center gap-1">
                    <Sparkles size={12} /> Pro Polish Tip
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-950 leading-tight">{rec.title}</h4>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{rec.subtitle}</p>
            </div>

            {rec.actionText && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (rec.actionType === 'navigate_lesson' && rec.targetId) {
                      const target = allLessons.find((l) => l.id === rec.targetId);
                      if (target) {
                        selectLesson(target);
                        onTabChange('curriculum');
                      }
                    } else if (rec.actionType === 'navigate_assignment') {
                      onTabChange('assignments');
                    } else if (rec.actionType === 'open_modal') {
                      onOpenAchievements();
                    } else {
                      onTabChange('assignments');
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                >
                  <span>{rec.actionText}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

