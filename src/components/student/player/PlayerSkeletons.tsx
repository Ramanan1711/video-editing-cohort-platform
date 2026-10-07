import { type ReactNode } from 'react';
import { BookOpen } from 'lucide-react';

export function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
        {icon}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function EmptyState({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white text-center ${large ? 'px-6 py-24' : 'px-4 py-8'}`}>
      <BookOpen className="mx-auto mb-3 text-slate-300" size={large ? 30 : 22} />
      <p className="mx-auto max-w-xs text-xs sm:text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-10 animate-pulse rounded-xl bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

export function PlayerSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-video animate-pulse bg-slate-200" />
      <div className="space-y-4 p-8">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

