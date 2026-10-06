import { useState } from 'react';
import { TiltCard } from './TiltCard';

export interface FreelanceEarningsCalculatorProps {
  publishedPrice?: number;
  publishedCurrency?: string;
}

export function FreelanceEarningsCalculator({
  publishedPrice = 4999,
  publishedCurrency = 'INR',
}: FreelanceEarningsCalculatorProps) {
  const [projectRate, setProjectRate] = useState<number>(15000);

  return (
    <section className="border-t border-white/10 bg-[#070b16] py-20 lg:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
            Interactive Career Calculator
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Project Your Return on 15 Days of Proof-of-Work
          </h2>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            When you graduate with verified code repositories or finished commercial cuts, your freelance market value changes immediately.
          </p>
        </div>

        <TiltCard
          maxTilt={5}
          glareColor="rgba(249, 115, 22, 0.15)"
          className="max-w-3xl mx-auto p-7 sm:p-10 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-3xl shadow-2xl shadow-orange-950/20"
        >
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                <span>Expected Client Project Fee / Milestone Rate:</span>
                <span className="text-xl font-black text-orange-400 font-mono">
                  ₹{projectRate.toLocaleString('en-IN')} INR
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="75000"
                step="1000"
                value={projectRate}
                onChange={(e) => setProjectRate(Number(e.target.value))}
                className="w-full accent-orange-500 h-2 bg-white/10 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-bold">
                <span>₹5,000 (Entry Freelancer)</span>
                <span>₹25,000 (Junior Pro)</span>
                <span>₹75,000+ (Production Lead)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-center">
              <div className="rounded-xl bg-white/[0.03] p-4 border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cohort Investment</p>
                <p className="text-2xl font-black text-white mt-1 font-mono">₹{publishedPrice.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">One-time enrollment ({publishedCurrency})</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4 border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time to Break Even</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {projectRate >= publishedPrice ? '1 Single Project' : `${Math.ceil(publishedPrice / projectRate)} Projects`}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">&lt; 1 client engagement</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4 border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. 90-Day ROI*</p>
                <p className="text-2xl font-black text-orange-400 mt-1 font-mono">
                  {publishedPrice > 0 ? `${Math.round(((projectRate * 3 - publishedPrice) / publishedPrice) * 100)}%` : '0%'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Based on 3 client deliverables</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed text-center">
              *Illustrative Freelance Projection: Calculated using your estimated project fee against the one-time ₹{publishedPrice.toLocaleString('en-IN')} {publishedCurrency} cohort fee. Actual earnings depend on personal client acquisition, market rates, and delivered production quality.
            </p>
          </div>
        </TiltCard>
      </div>
    </section>
  );
}
