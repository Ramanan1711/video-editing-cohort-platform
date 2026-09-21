export function DashboardSkeleton({
  cardsCount = 4,
  showChart = true,
}: {
  cardsCount?: number;
  showChart?: boolean;
}) {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading dashboard content">
      {/* KPI Cards Grid */}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${cardsCount}`}>
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-md bg-slate-200" />
              <div className="size-8 rounded-xl bg-slate-100" />
            </div>
            <div className="mt-4 h-8 w-16 rounded-lg bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded-md bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      {showChart && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-5 w-40 rounded-md bg-slate-200" />
              <div className="h-8 w-24 rounded-xl bg-slate-100" />
            </div>
            <div className="h-64 rounded-2xl bg-slate-100/70" />
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
            <div className="h-5 w-32 rounded-md bg-slate-200 border-b border-slate-100 pb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="size-9 shrink-0 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewQueueSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading review queue">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5"
        >
          {/* Header Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2">
                <div className="h-4 w-36 rounded bg-slate-200" />
                <div className="h-3 w-52 rounded bg-slate-100" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-24 rounded-full bg-slate-200" />
              <div className="h-7 w-20 rounded-full bg-slate-100" />
            </div>
          </div>

          {/* Video Player Box Placeholder */}
          <div className="rounded-2xl bg-slate-900/10 p-4 space-y-3">
            <div className="aspect-video w-full rounded-xl bg-slate-900/80 flex items-center justify-center">
              <div className="size-12 rounded-full bg-white/20" />
            </div>
            <div className="h-10 rounded-xl bg-white border border-slate-200" />
          </div>

          {/* Rubric Grid */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
            <div className="h-4 w-44 rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="h-20 rounded-xl bg-white border border-slate-200 p-2.5" />
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-3 pt-2">
            <div className="h-9 w-28 rounded-xl bg-slate-100" />
            <div className="h-9 w-32 rounded-xl bg-orange-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs animate-pulse" aria-busy="true">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex justify-between gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 w-24 rounded bg-slate-200" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-slate-200" />
                <div className="h-2.5 w-44 rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100 hidden sm:block" />
            <div className="h-8 w-24 rounded-xl bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CurriculumSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      {[1, 2, 3].map((m) => (
        <div key={m} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-6 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((l) => (
              <div key={l} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-md bg-slate-200" />
                  <div className="h-3 w-48 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-12 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse" aria-busy="true">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="h-6 w-36 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="size-8 rounded-lg bg-slate-100" />
          <div className="size-8 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-50 p-2 space-y-1">
            <div className="h-3 w-4 rounded bg-slate-200" />
            {i % 4 === 0 && <div className="h-2 w-full rounded bg-orange-200" />}
          </div>
        ))}
      </div>
    </div>
  );
}
