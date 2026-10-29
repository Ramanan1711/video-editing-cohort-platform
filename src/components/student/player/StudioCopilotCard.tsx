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
    <div className="mb-6 rounded-2xl border border-orange-200/80 dark:border-white/10 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 dark:from-[#0e1424] dark:via-[#090d1a] dark:to-surface-base p-4.5 sm:p-5 shadow-2xs dark:shadow-xl dark:shadow-black/50 backdrop-blur-xl transition-colors">
      <div className="flex items-center justify-between border-b border-orange-100/70 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7.5 items-center justify-center rounded-xl bg-gradient-to-tr from-[#B92B27] via-[#D93830] to-[#F2B705] text-white shadow-2xs shrink-0">
            <Lightbulb size={15} />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Studio Copilot · Smart Learning Advisor
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Targeted recommendations grounded in your watch history, submissions, and mentor critique scores.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-800/60 px-2.5 py-0.5 text-[10px] font-extrabold text-orange-800 dark:text-orange-300 uppercase tracking-wider shadow-2xs">
          AI Guided
        </span>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        {studioRecommendations.map((rec, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-surface-elevated/40 backdrop-blur-md p-3.5 shadow-3xs dark:shadow-none dark:hover:border-white/20 transition-all"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-wider">
                {rec.type === 'next_lesson' ? (
                  <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                    <Compass size={12} /> Next Up
                  </span>
                ) : rec.type === 'weak_skill' ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Rubric Focus Area
                  </span>
                ) : rec.type === 'deadline' ? (
                  <span className="text-amber-600 dark:text-[#F2B705] flex items-center gap-1">
                    <Clock3 size={12} /> Urgent Deadline
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Sparkles size={12} /> Pro Polish Tip
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-white leading-tight">{rec.title}</h4>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{rec.subtitle}</p>
            </div>

            {rec.actionText && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10">
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
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:underline transition-colors cursor-pointer"
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

